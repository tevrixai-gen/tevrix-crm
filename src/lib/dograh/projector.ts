// Projector: processes pending webhook inbox entries into local CRM tables.
// Each event → calls row + lead status + campaign counters + usage ledger,
// all in a single conceptual update.

import { eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  webhookInbox,
  calls,
  leads,
  campaigns,
  usageLedger,
  tenants,
} from "@/lib/db/schema";
import type { DograhWebhookEvent } from "./types";

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

  if (!entry[0] || entry[0].status !== "pending") return;

  // Mark as processing
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

    // Find tenant by matching the run's associated org
    // For now, we match by looking up tenants with a dograh campaign that references this campaign_id
    // or we accept the tenant_id from the payload
    const dograhOrgId = (event as unknown as { dograh_org_id?: string }).dograh_org_id;
    let tenantId: string | null = null;

    if (dograhOrgId) {
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

    // Bump usage ledger
    const period = new Date().toISOString().slice(0, 7);
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

    // Mark inbox entry as processed
    await db
      .update(webhookInbox)
      .set({ status: "processed", processedAt: new Date() })
      .where(eq(webhookInbox.id, entryId));
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await db
      .update(webhookInbox)
      .set({ status: "failed", processingError: errMsg, processedAt: new Date() })
      .where(eq(webhookInbox.id, entryId));
  }
}

export async function processPendingInbox(): Promise<number> {
  const pending = await db
    .select({ id: webhookInbox.id })
    .from(webhookInbox)
    .where(eq(webhookInbox.status, "pending"))
    .limit(100);

  for (const row of pending) {
    await processInboxEntry(row.id);
  }

  return pending.length;
}
