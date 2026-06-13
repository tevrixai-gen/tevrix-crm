import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { webhookInbox, tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyHmac } from "@/lib/dograh/hmac";
import { decryptSecret } from "@/lib/crypto/secrets";
import { rateLimit } from "@/lib/rate-limit";

const SKIP_VERIFICATION = process.env.WEBHOOK_SKIP_VERIFICATION === "true";

// POST /api/webhooks/dograh — receives events from the Dograh engine
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = rateLimit(`webhook:${ip}`, 600, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const rawBody = await req.text();

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // --- Normalize: detect which format we received ---
  let eventType: string;
  let externalId: string;
  let eventData: Record<string, unknown>;
  let dograhOrgId: string | null = null;

  if (raw.event_type && raw.external_id) {
    // Format 1: CRM-native envelope
    eventType = raw.event_type as string;
    externalId = raw.external_id as string;
    eventData = (raw.data as Record<string, unknown>) ?? raw;
    dograhOrgId = (req.headers.get("x-dograh-org-id") ?? raw.dograh_org_id) as string | null;
  } else if (raw.workflow_run_id) {
    // Format 2: Dograh webhook-node payload (template-rendered context)
    const runId = raw.workflow_run_id as number;
    eventType = "call.completed";
    externalId = `dograh-run-${runId}`;

    const gc = (raw.gathered_context ?? {}) as Record<string, unknown>;
    const ic = (raw.initial_context ?? {}) as Record<string, unknown>;
    const costInfo = (raw.cost_info ?? {}) as Record<string, unknown>;

    eventData = {
      run_id: runId,
      workflow_id: raw.workflow_id,
      workflow_name: raw.workflow_name,
      campaign_id: raw.campaign_id ?? null,
      phone_number: (ic.phone_number ?? ic.phone ?? gc.phone_number ?? gc.phone ?? null) as string | null,
      status: (gc.call_disposition ?? "completed") as string,
      duration: costInfo.call_duration_seconds ?? null,
      disposition_code: (gc.call_disposition ?? gc.disposition ?? "completed") as string,
      transcript: null,
      gathered_data: gc,
      recording_url: raw.recording_url ?? null,
      cost: costInfo.total_cost_usd ?? null,
      completed_at: raw.call_time ?? new Date().toISOString(),
    };
  } else {
    return NextResponse.json(
      { error: "Unrecognized payload format — need event_type+external_id or workflow_run_id" },
      { status: 400 }
    );
  }

  // --- Resolve tenant first (needed for auth on both formats) ---
  let resolvedTenant: { id: string; dograhOrgId: string | null; dograhWebhookSecret: string | null } | null = null;

  if (dograhOrgId) {
    const rows = await db
      .select({
        id: tenants.id,
        dograhOrgId: tenants.dograhOrgId,
        dograhWebhookSecret: tenants.dograhWebhookSecret,
      })
      .from(tenants)
      .where(eq(tenants.dograhOrgId, dograhOrgId))
      .limit(1);
    resolvedTenant = rows[0] ?? null;
  }

  if (!resolvedTenant && eventData.workflow_id) {
    const wfId = String(eventData.workflow_id);
    const rows = await db
      .select({
        id: tenants.id,
        dograhOrgId: tenants.dograhOrgId,
        dograhWebhookSecret: tenants.dograhWebhookSecret,
      })
      .from(tenants)
      .where(eq(tenants.dograhWorkflowId, wfId))
      .limit(1);
    resolvedTenant = rows[0] ?? null;
  }

  // --- Auth: HMAC or Bearer verification (runs for ALL formats) ---
  if (!SKIP_VERIFICATION) {
    if (!resolvedTenant) {
      return NextResponse.json({ error: "Unknown tenant" }, { status: 401 });
    }

    const rawSecret = resolvedTenant.dograhWebhookSecret;
    if (!rawSecret) {
      return NextResponse.json(
        { error: "Webhook secret not configured for this tenant" },
        { status: 401 }
      );
    }

    let secret: string;
    try {
      secret = decryptSecret(rawSecret);
    } catch {
      return NextResponse.json({ error: "Webhook secret decryption failed" }, { status: 500 });
    }

    const signature = req.headers.get("x-webhook-signature") ?? "";
    const bearer = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";

    const hmacValid = verifyHmac(rawBody, signature, secret);
    const bearerValid = bearer.length > 0 && bearer.length === secret.length &&
      timingSafeEqual(Buffer.from(bearer), Buffer.from(secret));

    if (!hmacValid && !bearerValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  dograhOrgId = resolvedTenant?.dograhOrgId ?? dograhOrgId;

  // Insert into inbox (idempotent — unique constraint on source+external_id)
  try {
    await db.insert(webhookInbox).values({
      source: "dograh",
      externalId,
      eventType,
      payload: { ...eventData, dograh_org_id: dograhOrgId },
      status: "pending",
    });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes("webhook_inbox_idempotency")
    ) {
      return NextResponse.json({ status: "duplicate" }, { status: 202 });
    }
    throw err;
  }

  return NextResponse.json({ status: "accepted" }, { status: 202 });
}
