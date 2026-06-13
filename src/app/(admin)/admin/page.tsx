import { db } from "@/lib/db";
import { tenants, organization, calls, webhookInbox } from "@/lib/db/schema";
import { eq, gte, count, and } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Phone, AlertTriangle, Webhook, Clock, Building2, UserCheck } from "lucide-react";

const statusColors: Record<string, string> = {
  created: "secondary",
  pending_approval: "default",
  provisioning: "default",
  provisioning_failed: "destructive",
  ready: "secondary",
  live: "default",
  paused: "outline",
};

export default async function AdminQueuePage() {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  const [rows, callsToday, failedCalls, failedWebhooks, pendingWebhooks] = await Promise.all([
    db.select({ tenant: tenants, org: organization })
      .from(tenants)
      .innerJoin(organization, eq(tenants.organizationId, organization.id))
      .orderBy(tenants.createdAt),
    db.select({ count: count() }).from(calls).where(gte(calls.createdAt, midnight)),
    db.select({ count: count() }).from(calls)
      .where(and(gte(calls.createdAt, midnight), eq(calls.outcome, "error"))),
    db.select({ count: count() }).from(webhookInbox).where(eq(webhookInbox.status, "failed")),
    db.select({ count: count() }).from(webhookInbox).where(eq(webhookInbox.status, "pending")),
  ]);

  const liveCount = rows.filter((r) => r.tenant.status === "live").length;
  const pendingCount = rows.filter((r) => r.tenant.status === "pending_approval").length;

  const fleet = [
    { label: "Calls today", value: callsToday[0].count, icon: Phone, color: "text-blue-600 bg-blue-50" },
    { label: "Call errors", value: failedCalls[0].count, alert: failedCalls[0].count > 0, icon: AlertTriangle, color: "text-red-600 bg-red-50" },
    { label: "Failed webhooks", value: failedWebhooks[0].count, alert: failedWebhooks[0].count > 0, icon: Webhook, color: "text-orange-600 bg-orange-50" },
    { label: "Pending webhooks", value: pendingWebhooks[0].count, icon: Clock, color: "text-amber-600 bg-amber-50" },
    { label: "Live tenants", value: liveCount, icon: Building2, color: "text-green-600 bg-green-50" },
    { label: "Awaiting approval", value: pendingCount, alert: pendingCount > 0, icon: UserCheck, color: "text-violet-600 bg-violet-50" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Fleet &amp; Approval Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">Platform health &middot; {rows.length} tenants</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {fleet.map((f) => {
          const Icon = f.icon;
          return (
            <Card key={f.label} className="shadow-sm">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className={`h-8 w-8 rounded-lg ${f.color} flex items-center justify-center`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className={`text-2xl font-bold ${f.alert ? "text-destructive" : ""}`}>{f.value}</span>
                </div>
                <p className="text-xs text-muted-foreground">{f.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="border rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Company</th>
              <th className="text-left px-4 py-3 font-medium">Org</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Plan</th>
              <th className="text-left px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center">
                  <div className="space-y-3">
                    <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">No tenants yet</p>
                      <p className="text-sm text-muted-foreground">Tenants will appear here after signup.</p>
                    </div>
                  </div>
                </td>
              </tr>
            )}
            {rows.map(({ tenant, org }) => (
              <tr key={tenant.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link href={`/admin/tenants/${tenant.id}`} className="font-medium text-primary hover:underline">
                    {tenant.companyName ?? org.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{org.slug}</td>
                <td className="px-4 py-3">
                  <Badge variant={(statusColors[tenant.status] ?? "secondary") as "default" | "secondary" | "destructive" | "outline"}>
                    {tenant.status.replace("_", " ")}
                  </Badge>
                </td>
                <td className="px-4 py-3 capitalize">{tenant.planTier}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(tenant.createdAt).toLocaleDateString("en-IN")}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/tenants/${tenant.id}`}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-primary hover:text-primary/80 hover:bg-accent rounded-md transition-colors"
                  >
                    Manage &rarr;
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
