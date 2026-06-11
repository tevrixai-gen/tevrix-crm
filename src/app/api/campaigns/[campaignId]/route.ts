import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { requireTenantApi } from "@/lib/auth/require-tenant";

async function getOwnedCampaign(campaignId: string, tenantId: string) {
  const rows = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, tenantId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { error, tenant } = await requireTenantApi();
  if (error) return error;

  const { campaignId } = await params;
  const campaign = await getOwnedCampaign(campaignId, tenant!.id);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ campaign });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { error, tenant } = await requireTenantApi({ allowPaused: false });
  if (error) return error;

  const { campaignId } = await params;
  const campaign = await getOwnedCampaign(campaignId, tenant!.id);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (campaign.status !== "draft") {
    return NextResponse.json(
      { error: "Only draft campaigns can be edited" },
      { status: 409 }
    );
  }

  const body = await req.json();
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (body.leadFilter !== undefined) updates.leadFilter = body.leadFilter;
  if (body.schedule !== undefined) updates.schedule = body.schedule;
  if (typeof body.maxConcurrency === "number") {
    updates.maxConcurrency = Math.min(Math.max(body.maxConcurrency, 1), 50);
  }
  if (body.retryConfig !== undefined) updates.retryConfig = body.retryConfig;

  await db
    .update(campaigns)
    .set(updates)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, tenant!.id)));

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { error, tenant } = await requireTenantApi({ allowPaused: false });
  if (error) return error;

  const { campaignId } = await params;
  const campaign = await getOwnedCampaign(campaignId, tenant!.id);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (campaign.status !== "draft" && campaign.status !== "cancelled") {
    return NextResponse.json(
      { error: "Only draft or cancelled campaigns can be deleted" },
      { status: 409 }
    );
  }

  await db
    .delete(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, tenant!.id)));

  return NextResponse.json({ ok: true });
}
