import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { webhookInbox, tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyHmac } from "@/lib/dograh/hmac";

// POST /api/webhooks/dograh — receives events from the Dograh engine
// HMAC-verified, idempotent (unique source+external_id), returns 202
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-webhook-signature") ?? "";

  let payload: {
    tenant_id?: string;
    dograh_org_id?: string;
    event_type: string;
    external_id: string;
    data: Record<string, unknown>;
  };

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.event_type || !payload.external_id) {
    return NextResponse.json(
      { error: "event_type and external_id required" },
      { status: 400 }
    );
  }

  // Resolve tenant by dograh_org_id header or payload
  const dograhOrgId =
    req.headers.get("x-dograh-org-id") ?? payload.dograh_org_id;

  if (dograhOrgId) {
    const tenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.dograhOrgId, dograhOrgId))
      .limit(1);

    if (tenant[0]?.dograhWebhookSecret) {
      if (!verifyHmac(rawBody, signature, tenant[0].dograhWebhookSecret)) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }
  }

  // Insert into inbox (idempotent — unique constraint on source+external_id)
  try {
    await db.insert(webhookInbox).values({
      source: "dograh",
      externalId: payload.external_id,
      eventType: payload.event_type,
      payload: payload.data ?? payload,
      status: "pending",
    });
  } catch (err: unknown) {
    // Unique violation = already received, that's fine
    if (
      err instanceof Error &&
      err.message.includes("webhook_inbox_idempotency")
    ) {
      return NextResponse.json({ status: "duplicate" }, { status: 202 });
    }
    throw err;
  }

  // Return 202 immediately — processing happens async via projector
  return NextResponse.json({ status: "accepted" }, { status: 202 });
}
