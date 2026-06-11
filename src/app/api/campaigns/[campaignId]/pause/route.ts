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

  if (campaign.status !== "running") {
    return NextResponse.json({ error: "Only running campaigns can be paused" }, { status: 409 });
  }

  // Pause the engine first — local state only flips when the engine confirms.
  if (campaign.dograhCampaignId && tenant!.dograhApiKeyCiphertext) {
    try {
      const client = createDograhClient(
        process.env.DOGRAH_API_BASE_URL ?? "http://localhost:8000",
        tenant!.dograhApiKeyCiphertext
      );
      await client.pauseCampaign(Number(campaign.dograhCampaignId));
    } catch {
      return NextResponse.json(
        { error: "Could not reach the calling engine to pause. Try again." },
        { status: 502 }
      );
    }
  }

  await db
    .update(campaigns)
    .set({ status: "paused", updatedAt: new Date() })
    .where(eq(campaigns.id, campaign.id));

  return NextResponse.json({ ok: true });
}
