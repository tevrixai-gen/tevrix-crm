import Link from "next/link";
import { getTenantContext } from "@/lib/auth/get-tenant-context";
import { getTenantById } from "@/lib/db/tenant-repo";
import { db } from "@/lib/db";
import { agentProfiles, calls, campaigns, leads, usageLedger } from "@/lib/db/schema";
import { eq, and, gte, count, sql } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Phone, Users, TrendingUp, Clock, IndianRupee, Timer,
  Bot, Upload, Megaphone, CheckCircle2, Circle, ArrowRight, BarChart3,
} from "lucide-react";
import { DEFAULT_PLAN_LIMITS, currentPeriod } from "@/lib/quota";
import { formatPhoneDisplay } from "@/lib/phone";

export default async function DashboardPage() {
  const { tenantId } = await getTenantContext();

  const period = currentPeriod();
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 86400_000);

  const [
    callCount, connectedCount, qualifiedCount, usage, attention, dailyRaw,
    tenantRow, leadCount, campaignCount, agentCount,
    monthQualified, monthCalls,
  ] = await Promise.all([
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
    db.select({
      day: sql<string>`to_char(${calls.createdAt}, 'YYYY-MM-DD')`,
      count: count(),
    }).from(calls)
      .where(and(eq(calls.tenantId, tenantId), gte(calls.createdAt, sevenDaysAgo)))
      .groupBy(sql`to_char(${calls.createdAt}, 'YYYY-MM-DD')`),
    getTenantById(tenantId),
    db.select({ count: count() }).from(leads).where(eq(leads.tenantId, tenantId)),
    db.select({ count: count() }).from(campaigns).where(eq(campaigns.tenantId, tenantId)),
    db.select({ count: count() }).from(agentProfiles).where(eq(agentProfiles.tenantId, tenantId)),
    db.select({ count: count() }).from(calls)
      .where(and(
        eq(calls.tenantId, tenantId),
        sql`${calls.outcome} = 'qualified'`,
        sql`to_char(${calls.createdAt}, 'YYYY-MM') = ${period}`
      )),
    db.select({ count: count() }).from(calls)
      .where(and(
        eq(calls.tenantId, tenantId),
        sql`to_char(${calls.createdAt}, 'YYYY-MM') = ${period}`
      )),
  ]);

  const planTier = tenantRow?.planTier ?? "trial";
  const limits = DEFAULT_PLAN_LIMITS[planTier] ?? DEFAULT_PLAN_LIMITS.trial;
  const minutesUsed = usage[0]?.minutesUsed ?? 0;

  const total7d = callCount[0].count;
  const connectRate = total7d > 0 ? Math.round((connectedCount[0].count / total7d) * 100) : 0;

  const dayMap = new Map(dailyRaw.map((d) => [d.day, d.count]));
  const series: Array<{ label: string; value: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400_000);
    const key = d.toISOString().slice(0, 10);
    series.push({
      label: d.toLocaleDateString("en-IN", { weekday: "short" }),
      value: dayMap.get(key) ?? 0,
    });
  }
  const maxVal = Math.max(1, ...series.map((s) => s.value));
  const hasAnyCalls = total7d > 0;

  const hasAgent = agentCount[0].count > 0;
  const hasLeads = leadCount[0].count > 0;
  const hasCampaign = campaignCount[0].count > 0;
  const hasFirstCall = total7d > 0;
  const completedSteps = [hasAgent, hasLeads, hasCampaign, hasFirstCall].filter(Boolean).length;
  const showOnboarding = completedSteps < 4;

  const stats = [
    { label: "Conversations (7d)", value: String(total7d), icon: Phone, sub: "Calls completed", accent: "text-blue-600 bg-blue-50" },
    { label: "Connected", value: `${connectRate}%`, icon: TrendingUp, sub: "Of calls last 7 days", accent: "text-cyan-600 bg-cyan-50" },
    { label: "Qualified leads", value: String(qualifiedCount[0].count), icon: Users, sub: "Ready for your team", accent: "text-emerald-600 bg-emerald-50" },
    { label: "Minutes used", value: `${minutesUsed}/${limits.maxMinutesPerMonth}`, icon: Clock, sub: `This month (${period})`, accent: "text-violet-600 bg-violet-50" },
  ];

  // ROI computation
  const valuePerLead = Number(tenantRow?.valuePerQualifiedLead ?? 500);
  const costPerMin = Number(tenantRow?.costPerMinute ?? 4);
  const avgHumanMin = Number(tenantRow?.avgHumanCallMinutes ?? 5);
  const monthQualifiedCount = monthQualified[0].count;
  const monthCallsCount = monthCalls[0].count;
  const qualifiedValue = monthQualifiedCount * valuePerLead;
  const aiCost = minutesUsed * costPerMin;
  const moneySaved = qualifiedValue - aiCost;
  const agentHoursEquivalent = Math.round((monthCallsCount * avgHumanMin) / 60 * 10) / 10;

  const steps = [
    { done: hasAgent, label: "Configure your AI agent", href: "/agent", icon: Bot },
    { done: hasLeads, label: "Add or import leads", href: "/leads", icon: Upload },
    { done: hasCampaign, label: "Create your first campaign", href: "/campaigns/new", icon: Megaphone },
    { done: hasFirstCall, label: "Launch and make your first call", href: "/campaigns", icon: Phone },
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

      {showOnboarding && (
        <Card className="shadow-sm border-primary/20 bg-primary/[0.02]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Getting started</CardTitle>
              <span className="text-xs text-muted-foreground font-medium">
                {completedSteps}/4 complete
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 mt-2">
              <div
                className="bg-primary rounded-full h-1.5 transition-all"
                style={{ width: `${(completedSteps / 4) * 100}%` }}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {steps.map(({ done, label, href, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  done
                    ? "text-muted-foreground"
                    : "hover:bg-primary/5 text-foreground"
                }`}
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                )}
                <Icon className="h-4 w-4 shrink-0" />
                <span className={done ? "line-through" : ""}>{label}</span>
                {!done && <ArrowRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />}
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, sub, accent }) => (
          <Card key={label} className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${accent}`}>
                <Icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value}</div>
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ROI panel */}
      <Card className="shadow-sm border-emerald-200/50 bg-emerald-50/30 dark:bg-emerald-950/10 dark:border-emerald-900/30">
        <CardHeader>
          <CardTitle className="text-base">What your AI did this month</CardTitle>
          <p className="text-xs text-muted-foreground">{period}</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                <span className="text-xs">Conversations</span>
              </div>
              <p className="text-xl font-bold">{monthCallsCount}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span className="text-xs">Qualified</span>
              </div>
              <p className="text-xl font-bold">{monthQualifiedCount}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Timer className="h-3.5 w-3.5" />
                <span className="text-xs">Human hours saved</span>
              </div>
              <p className="text-xl font-bold">{agentHoursEquivalent}h</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-600">
                <IndianRupee className="h-3.5 w-3.5" />
                <span className="text-xs">Net value</span>
              </div>
              <p className={`text-xl font-bold ${moneySaved >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {moneySaved >= 0 ? "+" : ""}₹{Math.abs(moneySaved).toLocaleString("en-IN")}
              </p>
              <p className="text-[10px] text-muted-foreground">
                ₹{qualifiedValue.toLocaleString("en-IN")} qualified − ₹{aiCost.toLocaleString("en-IN")} AI cost
              </p>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">
            Adjust value inputs in <Link href="/settings" className="underline">Settings</Link>
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Last 7 days</CardTitle>
          </CardHeader>
          <CardContent>
            {hasAnyCalls ? (
              <div className="flex items-end gap-2 h-32">
                {series.map((s, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-muted-foreground">{s.value || ""}</span>
                    <div
                      className="w-full bg-gradient-to-t from-primary to-primary/60 rounded-t"
                      style={{ height: `${Math.max(2, (s.value / maxVal) * 100)}%` }}
                    />
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <BarChart3 className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No calls yet this week</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Launch a campaign to see activity here
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
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
