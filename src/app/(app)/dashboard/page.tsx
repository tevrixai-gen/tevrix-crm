import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getTenantByUserId } from "@/lib/db/tenant-repo";
import { db } from "@/lib/db";
import { calls, campaigns, leads, usageLedger } from "@/lib/db/schema";
import { eq, and, gte, count, sum } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Users, TrendingUp, Clock } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const tenant = await getTenantByUserId(session!.user.id);

  const period = new Date().toISOString().slice(0, 7); // "2026-06"
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [callCount, leadCount, qualifiedCount, usage] = await Promise.all([
    db.select({ count: count() }).from(calls)
      .where(and(eq(calls.tenantId, tenant!.id), gte(calls.createdAt, sevenDaysAgo))),
    db.select({ count: count() }).from(leads)
      .where(eq(leads.tenantId, tenant!.id)),
    db.select({ count: count() }).from(leads)
      .where(and(eq(leads.tenantId, tenant!.id), eq(leads.status, "qualified"))),
    db.select().from(usageLedger)
      .where(and(eq(usageLedger.tenantId, tenant!.id), eq(usageLedger.period, period)))
      .limit(1),
  ]);

  const stats = [
    {
      label: "Conversations (7d)",
      value: callCount[0].count,
      icon: Phone,
      description: "Outbound calls completed",
    },
    {
      label: "Total Leads",
      value: leadCount[0].count,
      icon: Users,
      description: "Across all campaigns",
    },
    {
      label: "Qualified",
      value: qualifiedCount[0].count,
      icon: TrendingUp,
      description: "Leads marked qualified",
    },
    {
      label: "Minutes Used",
      value: usage[0]?.minutesUsed ?? 0,
      icon: Clock,
      description: `This month (${period})`,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Your AI calling overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, description }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
