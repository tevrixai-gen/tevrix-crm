import Link from "next/link";
import { getTenantContext } from "@/lib/auth/get-tenant-context";
import { getTenantById } from "@/lib/db/tenant-repo";
import { db } from "@/lib/db";
import { calls, leads, usageLedger } from "@/lib/db/schema";
import { eq, and, gte, count, sql } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Users, TrendingUp, Clock } from "lucide-react";
import { DEFAULT_PLAN_LIMITS, currentPeriod } from "@/lib/quota";
import { formatPhoneDisplay } from "@/lib/phone";

export default async function DashboardPage() {
  const { tenantId } = await getTenantContext();

  const period = currentPeriod();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000);

  const [callCount, connectedCount, qualifiedCount, usage, attention, dailyRaw, tenantRow] =
    await Promise.all([
      db.select({ count: count() }).from(calls)
        .where(and(eq(calls.tenantId, tenantId), gte(calls.createdAt, sevenDaysAgo))),
      db.select({ count: count() }).from(calls)
        .where(and(
          eq(calls.tenantId, tenantId),
          gte(calls.createdAt, sevenDaysAgo),
          sql`${calls.outcome} IN ('connected', 'qualified', 'callback')`
        )),
      db.select({ count: count() }).from(leads)
        .where(and(eq(leads.tenantId, tenantId), eq(leads.status, "qualified"))),
      db.select().from(usageLedger)
        .where(and(eq(usageLedger.tenantId, tenantId), eq(usageLedger.period, period)))
        .limit(1),
      // Needs attention: callbacks + recently qualified leads
      db.select({
        id: leads.id, name: leads.name, phone: leads.phone, status: leads.status,
        updatedAt: leads.updatedAt,
      }).from(leads)
        .where(and(
          eq(leads.tenantId, tenantId),
          sql`${leads.status} IN ('callback', 'qualified')`
        ))
        .orderBy(sql`${leads.updatedAt} DESC`)
        .limit(6),
      // Daily call counts, last 7 days
      db.select({
        day: sql<string>`to_char(${calls.createdAt}, 'YYYY-MM-DD')`,
        count: count(),
      }).from(calls)
        .where(and(eq(calls.tenantId, tenantId), gte(calls.createdAt, sevenDaysAgo)))
        .groupBy(sql`to_char(${calls.createdAt}, 'YYYY-MM-DD')`),
      getTenantById(tenantId),
    ]);

  const planTier = tenantRow?.planTier ?? "trial";
  const limits = DEFAULT_PLAN_LIMITS[planTier] ?? DEFAULT_PLAN_LIMITS.trial;
  const minutesUsed = usage[0]?.minutesUsed ?? 0;

  const total7d = callCount[0].count;
  const connectRate = total7d > 0 ? Math.round((connectedCount[0].count / total7d) * 100) : 0;

  // Build a 7-day series (fill gaps with 0)
  const dayMap = new Map(dailyRaw.map((d) => [d.day, d.count]));
  const series: Array<{ label: string; value: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000);
    const key = d.toISOString().slice(0, 10);
    series.push({
      label: d.toLocaleDateString("en-IN", { weekday: "short" }),
      value: dayMap.get(key) ?? 0,
    });
  }
  const maxVal = Math.max(1, ...series.map((s) => s.value));

  const stats = [
    { label: "Conversations (7d)", value: String(total7d), icon: Phone, sub: "Calls completed" },
    { label: "Connected", value: `${connectRate}%`, icon: TrendingUp, sub: "Of calls last 7 days" },
    { label: "Qualified leads", value: String(qualifiedCount[0].count), icon: Users, sub: "Ready for your team" },
    { label: "Minutes used", value: `${minutesUsed}/${limits.maxMinutesPerMonth}`, icon: Clock, sub: `This month (${period})` },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Your AI calling overview</p>
        </div>
        <Link href="/campaigns/new">
          <Button>New Campaign</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, sub }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value}</div>
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 7-day activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last 7 days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-32">
              {series.map((s, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-muted-foreground">{s.value || ""}</span>
                  <div
                    className="w-full bg-primary/70 rounded-t"
                    style={{ height: `${Math.max(2, (s.value / maxVal) * 100)}%` }}
                  />
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Needs attention */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Needs your attention</CardTitle>
          </CardHeader>
          <CardContent>
            {attention.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                Nothing pending. Qualified leads and callback requests appear here.
              </p>
            ) : (
              <ul className="divide-y">
                {attention.map((l) => (
                  <li key={l.id} className="py-2 flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{l.name ?? formatPhoneDisplay(l.phone)}</span>
                      <span className="text-muted-foreground ml-2 font-mono text-xs">
                        {l.name ? formatPhoneDisplay(l.phone) : ""}
                      </span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      l.status === "qualified"
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800"
                    }`}>
                      {l.status === "qualified" ? "Qualified" : "Callback"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
