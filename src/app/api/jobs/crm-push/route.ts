import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { crmSyncEvents, crmConnections, calls, leads, campaigns } from "@/lib/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";
import { getAdapter } from "@/lib/crm";
import type { CrmPushPayload } from "@/lib/crm/adapter";
import { requireJobAuth } from "@/lib/auth/require-job-auth";

const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  const authError = requireJobAuth(req);
  if (authError) return authError;

  const body = await req.json().catch(() => null);
  if (!body?.syncEventId) {
    return NextResponse.json({ error: "Missing syncEventId" }, { status: 400 });
  }

  const [event] = await db
    .select()
    .from(crmSyncEvents)
    .where(eq(crmSyncEvents.id, body.syncEventId))
    .limit(1);

  if (!event || event.status === "succeeded" || event.status === "dead_lettered") {
    return NextResponse.json({ skipped: true });
  }

  const [connection] = await db
    .select()
    .from(crmConnections)
    .where(eq(crmConnections.id, event.connectionId))
    .limit(1);

  if (!connection || connection.status !== "active") {
    await db
      .update(crmSyncEvents)
      .set({ status: "dead_lettered", error: "Connection inactive or deleted" })
      .where(eq(crmSyncEvents.id, event.id));
    return NextResponse.json({ skipped: true, reason: "connection_inactive" });
  }

  // Load call + lead data
  const [call] = await db.select().from(calls).where(eq(calls.id, event.callId)).limit(1);
  if (!call) {
    await db
      .update(crmSyncEvents)
      .set({ status: "dead_lettered", error: "Call not found" })
      .where(eq(crmSyncEvents.id, event.id));
    return NextResponse.json({ skipped: true, reason: "call_not_found" });
  }

  let leadRow = null;
  if (call.leadId) {
    const [l] = await db.select().from(leads).where(eq(leads.id, call.leadId)).limit(1);
    leadRow = l ?? null;
  }

  let campaignName: string | null = null;
  if (call.campaignId) {
    const [c] = await db
      .select({ name: campaigns.name })
      .from(campaigns)
      .where(eq(campaigns.id, call.campaignId))
      .limit(1);
    campaignName = c?.name ?? null;
  }

  const adapter = getAdapter(connection.kind);
  if (!adapter) {
    await db
      .update(crmSyncEvents)
      .set({ status: "dead_lettered", error: `No adapter for kind: ${connection.kind}` })
      .where(eq(crmSyncEvents.id, event.id));
    return NextResponse.json({ skipped: true, reason: "no_adapter" });
  }

  let config: Record<string, unknown> = {};
  if (connection.configCiphertext) {
    try {
      config = JSON.parse(decryptSecret(connection.configCiphertext));
    } catch (err) {
      await db
        .update(crmSyncEvents)
        .set({ status: "dead_lettered", error: "Failed to decrypt config" })
        .where(eq(crmSyncEvents.id, event.id));
      return NextResponse.json({ error: "decrypt_failed" }, { status: 500 });
    }
  }

  const payload: CrmPushPayload = {
    leadName: leadRow?.name ?? null,
    leadPhone: call.phone,
    leadEmail: leadRow?.email ?? null,
    outcome: call.outcome ?? "connected",
    summary: call.summary,
    gatheredData: call.gatheredData as Record<string, unknown> | null,
    callDurationSeconds: call.durationSeconds,
    callDate: (call.endedAt ?? call.createdAt).toISOString(),
    campaignName,
  };

  const attempts = event.attempts + 1;

  try {
    const result = await adapter.push(payload, config);

    if (result.ok) {
      await db
        .update(crmSyncEvents)
        .set({
          status: "succeeded",
          attempts,
          lastAttemptAt: new Date(),
          externalRef: result.externalRef ?? null,
          error: null,
        })
        .where(eq(crmSyncEvents.id, event.id));

      await db
        .update(crmConnections)
        .set({ lastSyncAt: new Date(), lastError: null, updatedAt: new Date() })
        .where(eq(crmConnections.id, connection.id));

      return NextResponse.json({ ok: true, externalRef: result.externalRef });
    }

    if (attempts >= MAX_ATTEMPTS) {
      await db
        .update(crmSyncEvents)
        .set({
          status: "dead_lettered",
          attempts,
          lastAttemptAt: new Date(),
          error: result.error ?? "Unknown error",
        })
        .where(eq(crmSyncEvents.id, event.id));
    } else {
      await db
        .update(crmSyncEvents)
        .set({
          status: "failed",
          attempts,
          lastAttemptAt: new Date(),
          error: result.error ?? "Unknown error",
        })
        .where(eq(crmSyncEvents.id, event.id));
    }

    await db
      .update(crmConnections)
      .set({ lastError: result.error ?? "Push failed", updatedAt: new Date() })
      .where(eq(crmConnections.id, connection.id));

    return NextResponse.json({ ok: false, error: result.error });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);

    if (attempts >= MAX_ATTEMPTS) {
      await db
        .update(crmSyncEvents)
        .set({ status: "dead_lettered", attempts, lastAttemptAt: new Date(), error: errMsg })
        .where(eq(crmSyncEvents.id, event.id));
    } else {
      await db
        .update(crmSyncEvents)
        .set({ status: "failed", attempts, lastAttemptAt: new Date(), error: errMsg })
        .where(eq(crmSyncEvents.id, event.id));
    }

    return NextResponse.json({ ok: false, error: errMsg }, { status: 500 });
  }
}
