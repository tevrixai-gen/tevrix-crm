import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calls, tenants, campaigns } from "@/lib/db/schema";
import { eq, and, isNull, lt } from "drizzle-orm";
import { createDograhClient } from "@/lib/dograh/client";

// POST /api/jobs/reconcile — called by Cloud Scheduler every 10 min
// Sweeps stale "calling" rows that never got a webhook completion,
// and backfills missed data by reading from the Dograh API.
export async function POST() {
  // TODO: In production, verify OIDC token from Cloud Scheduler

  // Find calls that started more than 15 minutes ago but have no outcome
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);

  const staleCalls = await db
    .select({
      id: calls.id,
      tenantId: calls.tenantId,
      dograhRunId: calls.dograhRunId,
      campaignId: calls.campaignId,
    })
    .from(calls)
    .where(
      and(
        isNull(calls.outcome),
        lt(calls.createdAt, fifteenMinAgo)
      )
    )
    .limit(50);

  let reconciled = 0;

  for (const call of staleCalls) {
    if (!call.dograhRunId) continue;

    // Try to fetch run status from the engine via the tenant's API key
    const tenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, call.tenantId))
      .limit(1);

    if (!tenant[0]?.dograhApiKeyCiphertext) continue;

    try {
      const client = createDograhClient(
        process.env.DOGRAH_API_BASE_URL ?? "http://localhost:8000",
        tenant[0].dograhApiKeyCiphertext
      );

      // If the call was part of a campaign, fetch via campaign runs
      if (call.campaignId) {
        const campaign = await db
          .select({ dograhCampaignId: campaigns.dograhCampaignId })
          .from(campaigns)
          .where(eq(campaigns.id, call.campaignId))
          .limit(1);

        if (campaign[0]?.dograhCampaignId) {
          const runs = await client.getCampaignRuns(
            Number(campaign[0].dograhCampaignId),
            1,
            100
          );

          const matchedRun = runs.runs.find(
            (r) => String(r.id) === call.dograhRunId
          );

          if (matchedRun && matchedRun.status === "completed") {
            await db
              .update(calls)
              .set({
                outcome: "connected",
                durationSeconds: matchedRun.duration ?? null,
                endedAt: matchedRun.completed_at
                  ? new Date(matchedRun.completed_at)
                  : new Date(),
              })
              .where(eq(calls.id, call.id));
            reconciled++;
          }
        }
      }
    } catch {
      // Skip — the tenant's engine might be unreachable, try again next cycle
    }
  }

  return NextResponse.json({ staleCalls: staleCalls.length, reconciled });
}
