import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, count, sql, avg } from "drizzle-orm";
import { db } from "@/lib/db";
import { calls, campaigns } from "@/lib/db/schema";
import { requireTenantApi } from "@/lib/auth/require-tenant";

export async function GET(req: NextRequest) {
  const { error, tenant } = await requireTenantApi();
  if (error) return error;

  const days = Math.min(Number(req.nextUrl.searchParams.get("days") ?? 30), 365);
  const since = new Date(Date.now() - days * 86400_000);

  const base = and(eq(calls.tenantId, tenant!.id), gte(calls.createdAt, since));

  const [
    totalRow,
    outcomeRows,
    dailyRows,
    avgDuration,
    campaignRows,
  ] = await Promise.all([
    db.select({ count: count() }).from(calls).where(base),

    db.select({
      outcome: calls.outcome,
      count: count(),
    })
      .from(calls)
      .where(base)
      .groupBy(calls.outcome),

    db.select({
      day: sql<string>`to_char(${calls.createdAt}, 'YYYY-MM-DD')`,
      count: count(),
    })
      .from(calls)
      .where(base)
      .groupBy(sql`to_char(${calls.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${calls.createdAt}, 'YYYY-MM-DD')`),

    db.select({
      avg: avg(calls.durationSeconds),
    })
      .from(calls)
      .where(and(base, sql`${calls.durationSeconds} > 0`)),

    db.select({
      id: campaigns.id,
      name: campaigns.name,
      status: campaigns.status,
      totalLeads: campaigns.totalLeads,
      calledLeads: campaigns.calledLeads,
      connectedLeads: campaigns.connectedLeads,
      qualifiedLeads: campaigns.qualifiedLeads,
    })
      .from(campaigns)
      .where(and(eq(campaigns.tenantId, tenant!.id), gte(campaigns.createdAt, since)))
      .orderBy(sql`${campaigns.createdAt} DESC`)
      .limit(10),
  ]);

  const outcomeMap: Record<string, number> = {};
  for (const r of outcomeRows) {
    if (r.outcome) outcomeMap[r.outcome] = r.count;
  }

  return NextResponse.json({
    days,
    totalCalls: totalRow[0].count,
    avgDurationSeconds: Math.round(Number(avgDuration[0].avg ?? 0)),
    outcomes: outcomeMap,
    daily: dailyRows,
    campaigns: campaignRows,
  });
}
