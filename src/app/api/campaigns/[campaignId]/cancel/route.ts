import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { requireTenantApi } from "@/lib/auth/require-tenant";
import { createDograhClient } from "@/lib/dograh/client";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { error, tenant } = await requireTenantApi();
  if (error) return error;

  const { campaignId } = await params;
  const rows = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, tenant!.id)))
    .limit(1);

  const campaign = rows[0];
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!["running", "paused", "scheduled", "draft"].includes(campaign.status)) {
    return NextResponse.json({ error: `Cannot cancel a ${campaign.status} campaign` }, { status: 409 });
  }

  // Best-effort engine pause; cancellation proceeds locally regardless —
  // the kill switch must never be blocked by an unreachable engine.
  if (campaign.status === "running" && campaign.dograhCampaignId && tenant!.dograhApiKeyCiphertext) {
    try {
      const client = createDograhClient(
        process.env.DOGRAH_API_BASE_URL ?? "http://localhost:8000",
        tenant!.dograhApiKeyCiphertext
      );
      await client.pauseCampaign(Number(campaign.dograhCampaignId));
    } catch {
      // proceed — reconciliation will catch stragglers
    }
  }

  await db
    .update(campaigns)
    .set({ status: "cancelled", completedAt: new Date(), updatedAt: new Date() })
    .where(eq(campaigns.id, campaign.id));

  return NextResponse.json({ ok: true });
}
