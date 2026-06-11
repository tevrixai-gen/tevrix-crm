import { db } from "@/lib/db";
import { tenants, organization, calls, webhookInbox } from "@/lib/db/schema";
import { eq, gte, count, and } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

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
    { label: "Calls today", value: callsToday[0].count },
    { label: "Call errors today", value: failedCalls[0].count, alert: failedCalls[0].count > 0 },
    { label: "Failed webhooks", value: failedWebhooks[0].count, alert: failedWebhooks[0].count > 0 },
    { label: "Pending webhooks", value: pendingWebhooks[0].count },
    { label: "Live tenants", value: liveCount },
    { label: "Awaiting approval", value: pendingCount, alert: pendingCount > 0 },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Fleet &amp; Approval Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">{rows.length} tenants total</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {fleet.map((f) => (
          <Card key={f.label}>
            <CardContent className="pt-4 pb-3">
              <div className={`text-xl font-bold ${f.alert ? "text-destructive" : ""}`}>{f.value}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{f.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Company</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Plan</th>
              <th className="text-left px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No tenants yet
                </td>
              </tr>
            )}
            {rows.map(({ tenant, org }) => (
              <tr key={tenant.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{tenant.companyName ?? org.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{org.slug}</td>
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
                  <Link href={`/admin/tenants/${tenant.id}`}>
                    <Button variant="ghost" size="sm">Manage</Button>
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
