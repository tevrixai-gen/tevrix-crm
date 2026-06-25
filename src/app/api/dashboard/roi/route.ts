import { NextResponse } from "next/server";
import { and, eq, count, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { calls, usageLedger, tenants } from "@/lib/db/schema";
import { requireTenantApi } from "@/lib/auth/require-tenant";
import { currentPeriod } from "@/lib/quota";

export async function GET() {
  const { error, tenant } = await requireTenantApi();
  if (error) return error;

  const period = currentPeriod();
  const t = tenant!;

  const [qualifiedRow, usageRow, totalCallsRow] = await Promise.all([
    db
      .select({ count: count() })
      .from(calls)
      .where(
        and(
          eq(calls.tenantId, t.id),
          sql`${calls.outcome} = 'qualified'`,
          sql`to_char(${calls.createdAt}, 'YYYY-MM') = ${period}`
        )
      ),
    db
      .select({
        minutesUsed: usageLedger.minutesUsed,
        callsUsed: usageLedger.callsUsed,
      })
      .from(usageLedger)
      .where(and(eq(usageLedger.tenantId, t.id), eq(usageLedger.period, period)))
      .limit(1),
    db
      .select({ count: count() })
      .from(calls)
      .where(
        and(
          eq(calls.tenantId, t.id),
          sql`to_char(${calls.createdAt}, 'YYYY-MM') = ${period}`
        )
      ),
  ]);

  const qualifiedCount = qualifiedRow[0].count;
  const minutesUsed = usageRow[0]?.minutesUsed ?? 0;
  const callsCount = totalCallsRow[0].count;

  const valuePerLead = Number(t.valuePerQualifiedLead);
  const costPerMin = Number(t.costPerMinute);
  const avgHumanMin = Number(t.avgHumanCallMinutes);

  const qualifiedValue = qualifiedCount * valuePerLead;
  const aiCost = minutesUsed * costPerMin;
  const moneySaved = qualifiedValue - aiCost;
  const agentHoursEquivalent = Math.round((callsCount * avgHumanMin) / 60 * 10) / 10;

  return NextResponse.json({
    period,
    qualifiedCount,
    callsCount,
    minutesUsed,
    qualifiedValue: Math.round(qualifiedValue),
    aiCost: Math.round(aiCost),
    moneySaved: Math.round(moneySaved),
    agentHoursEquivalent,
    inputs: {
      valuePerQualifiedLead: valuePerLead,
      costPerMinute: costPerMin,
      avgHumanCallMinutes: avgHumanMin,
    },
  });
}
