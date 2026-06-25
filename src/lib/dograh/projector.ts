// Projector: processes pending webhook inbox entries into local CRM tables.
// Each event → calls row + lead status + campaign counters + usage ledger,
// all in a single conceptual update.

import { eq, and, sql, or, isNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  webhookInbox,
  calls,
  leads,
  campaigns,
  usageLedger,
  tenants,
  crmConnections,
  crmSyncEvents,
} from "@/lib/db/schema";
import type { DograhWebhookEvent } from "./types";

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 30_000;

function mapDispositionToOutcome(
  disposition?: string
): "connected" | "not_answered" | "callback" | "qualified" | "not_interested" | "dnc" | "failed" | "error" {
  switch (disposition?.toLowerCase()) {
    case "answered":
    case "connected":
      return "connected";
    case "no_answer":
    case "noanswer":
      return "not_answered";
    case "voicemail":
    case "callback":
      return "callback";
    case "qualified":
    case "interested":
      return "qualified";
    case "not_interested":
    case "notinterested":
      return "not_interested";
    case "dnc":
    case "do_not_call":
      return "dnc";
    case "failed":
    case "error":
      return "failed";
    default:
      return "connected";
  }
}

export async function processInboxEntry(entryId: string): Promise<void> {
  const entry = await db
    .select()
    .from(webhookInbox)
    .where(eq(webhookInbox.id, entryId))
    .limit(1);

  const row = entry[0];
  if (!row) return;

  const isRetry = row.status === "failed" && (row.attempts ?? 0) < MAX_ATTEMPTS;
  if (row.status !== "pending" && !isRetry) return;

  await db
    .update(webhookInbox)
    .set({ status: "processing" })
    .where(eq(webhookInbox.id, entryId));

  try {
    const event = entry[0].payload as unknown as DograhWebhookEvent;
    const data = event.data ?? (entry[0].payload as DograhWebhookEvent["data"]);

    if (!data?.run_id) {
      await db
        .update(webhookInbox)
        .set({ status: "failed", processingError: "Missing run_id", processedAt: new Date() })
        .where(eq(webhookInbox.id, entryId));
      return;
    }

    // Resolve tenant: workflow_id (primary in single-account model),
    // then dograh_org_id, then campaign_id as fallbacks.
    const fullPayload = entry[0].payload as Record<string, unknown>;
    const dograhOrgId = (fullPayload.dograh_org_id ?? (event as unknown as { dograh_org_id?: string }).dograh_org_id) as string | undefined;
    const workflowId = (data.workflow_id ?? fullPayload.workflow_id) as number | string | undefined;
    let tenantId: string | null = null;

    if (workflowId) {
      const tenant = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.dograhWorkflowId, String(workflowId)))
        .limit(1);
      tenantId = tenant[0]?.id ?? null;
    }

    if (!tenantId && dograhOrgId) {
      const tenant = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.dograhOrgId, dograhOrgId))
        .limit(1);
      tenantId = tenant[0]?.id ?? null;
    }

    if (!tenantId && data.campaign_id) {
      const campaign = await db
        .select({ tenantId: campaigns.tenantId })
        .from(campaigns)
        .where(eq(campaigns.dograhCampaignId, String(data.campaign_id)))
        .limit(1);
      tenantId = campaign[0]?.tenantId ?? null;
    }

    if (!tenantId) {
      await db
        .update(webhookInbox)
        .set({ status: "failed", processingError: "Could not resolve tenant", processedAt: new Date() })
        .where(eq(webhookInbox.id, entryId));
      return;
    }

    const outcome = mapDispositionToOutcome(data.disposition_code);

    // Upsert call record
    const existingCall = await db
      .select({ id: calls.id })
      .from(calls)
      .where(eq(calls.dograhRunId, String(data.run_id)))
      .limit(1);

    if (existingCall.length === 0) {
      await db.insert(calls).values({
        tenantId,
        dograhRunId: String(data.run_id),
        phone: data.phone_number ?? "",
        outcome,
        durationSeconds: data.duration ?? null,
        transcript: data.transcript ? JSON.parse(JSON.stringify(data.transcript)) : null,
        gatheredData: data.gathered_data ? JSON.parse(JSON.stringify(data.gathered_data)) : null,
        recordingRef: data.recording_url ?? null,
        costUsd: data.cost != null ? String(data.cost) : null,
        summary: null,
        campaignId: null,
        leadId: null,
        startedAt: null,
        endedAt: data.completed_at ? new Date(data.completed_at) : new Date(),
      });
    } else {
      await db
        .update(calls)
        .set({
          outcome,
          durationSeconds: data.duration ?? null,
          transcript: data.transcript ? JSON.parse(JSON.stringify(data.transcript)) : null,
          gatheredData: data.gathered_data ? JSON.parse(JSON.stringify(data.gathered_data)) : null,
          recordingRef: data.recording_url ?? null,
          costUsd: data.cost != null ? String(data.cost) : null,
          endedAt: data.completed_at ? new Date(data.completed_at) : new Date(),
        })
        .where(eq(calls.id, existingCall[0].id));
    }

    // Update lead status if we can match by phone
    if (data.phone_number) {
      await db
        .update(leads)
        .set({ status: outcome === "error" ? "failed" : outcome, updatedAt: new Date() })
        .where(
          and(eq(leads.tenantId, tenantId), eq(leads.phone, data.phone_number))
        );
    }

    // Bump campaign counters
    if (data.campaign_id) {
      const campaignRow = await db
        .select({ id: campaigns.id })
        .from(campaigns)
        .where(eq(campaigns.dograhCampaignId, String(data.campaign_id)))
        .limit(1);

      if (campaignRow[0]) {
        await db
          .update(campaigns)
          .set({
            calledLeads: sql`${campaigns.calledLeads} + 1`,
            connectedLeads:
              outcome === "connected" || outcome === "qualified"
                ? sql`${campaigns.connectedLeads} + 1`
                : campaigns.connectedLeads,
            qualifiedLeads:
              outcome === "qualified"
                ? sql`${campaigns.qualifiedLeads} + 1`
                : campaigns.qualifiedLeads,
            updatedAt: new Date(),
          })
          .where(eq(campaigns.id, campaignRow[0].id));
      }
    }

    // Bump usage ledger — derive period from event time, not projection time
    const eventTime = data.completed_at ? new Date(data.completed_at as string) : new Date();
    const period = eventTime.toISOString().slice(0, 7);
    const minutes = data.duration ? Math.ceil(data.duration / 60) : 0;

    const existingUsage = await db
      .select()
      .from(usageLedger)
      .where(and(eq(usageLedger.tenantId, tenantId), eq(usageLedger.period, period)))
      .limit(1);

    if (existingUsage.length === 0) {
      await db.insert(usageLedger).values({
        tenantId,
        period,
        callsUsed: 1,
        minutesUsed: minutes,
      });
    } else {
      await db
        .update(usageLedger)
        .set({
          callsUsed: sql`${usageLedger.callsUsed} + 1`,
          minutesUsed: sql`${usageLedger.minutesUsed} + ${minutes}`,
          updatedAt: new Date(),
        })
        .where(eq(usageLedger.id, existingUsage[0].id));
    }

    // Enqueue CRM sync events for matching connections
    const callRow = existingCall.length > 0
      ? existingCall[0]
      : (await db.select({ id: calls.id }).from(calls).where(eq(calls.dograhRunId, String(data.run_id))).limit(1))[0];

    if (callRow) {
      const activeConnections = await db
        .select({ id: crmConnections.id, triggerRule: crmConnections.triggerRule })
        .from(crmConnections)
        .where(and(eq(crmConnections.tenantId, tenantId), eq(crmConnections.status, "active")));

      for (const conn of activeConnections) {
        const shouldPush =
          conn.triggerRule === "on_any_completed" ||
          (conn.triggerRule === "on_qualified" && outcome === "qualified");

        if (shouldPush) {
          await db
            .insert(crmSyncEvents)
            .values({ connectionId: conn.id, callId: callRow.id })
            .onConflictDoNothing();
        }
      }
    }

    // Mark inbox entry as processed
    await db
      .update(webhookInbox)
      .set({ status: "processed", processedAt: new Date() })
      .where(eq(webhookInbox.id, entryId));
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const currentAttempts = ((entry[0] as { attempts?: number }).attempts ?? 0) + 1;

    if (currentAttempts >= MAX_ATTEMPTS) {
      await db
        .update(webhookInbox)
        .set({
          status: "dead_letter",
          processingError: errMsg,
          attempts: currentAttempts,
          processedAt: new Date(),
        })
        .where(eq(webhookInbox.id, entryId));
    } else {
      const nextRetry = new Date(Date.now() + Math.pow(2, currentAttempts) * BASE_BACKOFF_MS);
      await db
        .update(webhookInbox)
        .set({
          status: "failed",
          processingError: errMsg,
          attempts: currentAttempts,
          nextRetryAt: nextRetry,
        })
        .where(eq(webhookInbox.id, entryId));
    }
  }
}

export async function processPendingInbox(): Promise<number> {
  const now = new Date();

  const rows = await db
    .select({ id: webhookInbox.id })
    .from(webhookInbox)
    .where(
      or(
        eq(webhookInbox.status, "pending"),
        and(
          eq(webhookInbox.status, "failed"),
          sql`${webhookInbox.attempts} < ${MAX_ATTEMPTS}`,
          or(
            isNull(webhookInbox.nextRetryAt),
            lte(webhookInbox.nextRetryAt, now)
          )
        )
      )
    )
    .limit(100);

  for (const row of rows) {
    await processInboxEntry(row.id);
  }

  return rows.length;
}
