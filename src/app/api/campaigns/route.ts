import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { requireTenantApi } from "@/lib/auth/require-tenant";
import { resolveAudience, type LeadFilter } from "@/lib/campaign-audience";
import { validateCallingWindow } from "@/lib/working-hours";

export async function GET() {
  const { error, tenant } = await requireTenantApi();
  if (error) return error;

  const rows = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.tenantId, tenant!.id))
    .orderBy(desc(campaigns.createdAt));

  return NextResponse.json({ campaigns: rows });
}

export async function POST(req: NextRequest) {
  const { error, tenant } = await requireTenantApi({ allowPaused: false });
  if (error) return error;

  const body = await req.json();
  const { name, leadFilter, schedule, maxConcurrency, retryConfig } = body as {
    name?: string;
    leadFilter?: LeadFilter;
    schedule?: { windowStart?: string; windowEnd?: string };
    maxConcurrency?: number;
    retryConfig?: { maxAttempts?: number; retryOnNoAnswer?: boolean };
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
  }

  // Validate the campaign's window (defaults to tenant's calling window)
  const windowStart = schedule?.windowStart ?? tenant!.callingWindowStart;
  const windowEnd = schedule?.windowEnd ?? tenant!.callingWindowEnd;
  const windowError = validateCallingWindow(windowStart, windowEnd);
  if (windowError) {
    return NextResponse.json({ error: windowError }, { status: 400 });
  }

  // Snapshot audience size at draft time (recomputed at launch)
  const audience = await resolveAudience(tenant!.id, leadFilter ?? null);

  const [created] = await db
    .insert(campaigns)
    .values({
      tenantId: tenant!.id,
      name: name.trim(),
      status: "draft",
      leadFilter: leadFilter ?? null,
      schedule: { windowStart, windowEnd },
      maxConcurrency: Math.min(Math.max(maxConcurrency ?? 5, 1), 50),
      retryConfig: retryConfig ?? { maxAttempts: 2, retryOnNoAnswer: true },
      totalLeads: audience.length,
    })
    .returning({ id: campaigns.id });

  return NextResponse.json(
    { ok: true, id: created.id, audienceSize: audience.length },
    { status: 201 }
  );
}
