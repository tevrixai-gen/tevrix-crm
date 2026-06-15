import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { campaigns, calls, campaignLeads } from "@/lib/db/schema";
import { requireTenantApi } from "@/lib/auth/require-tenant";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { error, tenant } = await requireTenantApi({ allowPaused: false });
  if (error) return error;

  const { campaignId } = await params;
  const rows = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, tenant!.id)))
    .limit(1);

  const campaign = rows[0];
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (campaign.status !== "completed" && campaign.status !== "cancelled") {
    return NextResponse.json(
      { error: "Only completed or cancelled campaigns can be redialed" },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const {
    name: customName,
    retryOnNoAnswer = true,
    retryOnBusy = true,
    retryOnVoicemail = true,
  } = body as {
    name?: string;
    retryOnNoAnswer?: boolean;
    retryOnBusy?: boolean;
    retryOnVoicemail?: boolean;
  };

  if (!retryOnNoAnswer && !retryOnBusy && !retryOnVoicemail) {
    return NextResponse.json(
      { error: "Select at least one retry condition" },
      { status: 400 }
    );
  }

  type Outcome = "connected" | "not_answered" | "callback" | "qualified" | "not_interested" | "dnc" | "failed" | "error";
  const targetOutcomes: Outcome[] = [];
  if (retryOnNoAnswer) targetOutcomes.push("not_answered");
  if (retryOnBusy) targetOutcomes.push("failed");
  if (retryOnVoicemail) targetOutcomes.push("error");

  const failedCalls = await db
    .select({ leadId: calls.leadId })
    .from(calls)
    .where(
      and(
        eq(calls.campaignId, campaignId),
        eq(calls.tenantId, tenant!.id),
        inArray(calls.outcome, targetOutcomes)
      )
    );

  const leadIds = failedCalls
    .map((c) => c.leadId)
    .filter((id): id is string => id !== null);

  if (leadIds.length === 0) {
    return NextResponse.json(
      { error: "No calls match the selected retry conditions" },
      { status: 400 }
    );
  }

  const uniqueLeadIds = [...new Set(leadIds)];

  // Create the redial campaign
  const redialName = customName?.trim() || `${campaign.name} (redial)`;

  const [created] = await db
    .insert(campaigns)
    .values({
      tenantId: tenant!.id,
      name: redialName,
      status: "draft",
      leadFilter: campaign.leadFilter,
      schedule: campaign.schedule,
      maxConcurrency: campaign.maxConcurrency,
      retryConfig: campaign.retryConfig,
      totalLeads: uniqueLeadIds.length,
    })
    .returning({ id: campaigns.id });

  // Pre-populate campaign_leads with the filtered leads
  const CHUNK = 500;
  for (let i = 0; i < uniqueLeadIds.length; i += CHUNK) {
    await db
      .insert(campaignLeads)
      .values(
        uniqueLeadIds.slice(i, i + CHUNK).map((leadId) => ({
          campaignId: created.id,
          leadId,
          status: "queued" as const,
        }))
      )
      .onConflictDoNothing({ target: [campaignLeads.campaignId, campaignLeads.leadId] });
  }

  return NextResponse.json(
    { ok: true, id: created.id, audienceSize: uniqueLeadIds.length },
    { status: 201 }
  );
}
