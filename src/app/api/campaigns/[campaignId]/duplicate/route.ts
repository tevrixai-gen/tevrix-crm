import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { requireTenantApi } from "@/lib/auth/require-tenant";
import { resolveAudience, type LeadFilter } from "@/lib/campaign-audience";

export async function POST(
  _req: NextRequest,
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

  const source = rows[0];
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const audience = await resolveAudience(
    tenant!.id,
    (source.leadFilter as LeadFilter | null) ?? null
  );

  const [created] = await db
    .insert(campaigns)
    .values({
      tenantId: tenant!.id,
      name: `${source.name} (copy)`,
      status: "draft",
      leadFilter: source.leadFilter,
      schedule: source.schedule,
      maxConcurrency: source.maxConcurrency,
      retryConfig: source.retryConfig,
      totalLeads: audience.length,
    })
    .returning({ id: campaigns.id });

  return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
}
