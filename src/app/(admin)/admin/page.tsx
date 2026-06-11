import { db } from "@/lib/db";
import { tenants, organization } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const rows = await db
    .select({ tenant: tenants, org: organization })
    .from(tenants)
    .innerJoin(organization, eq(tenants.organizationId, organization.id))
    .orderBy(tenants.createdAt);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Approval Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">{rows.length} tenants total</p>
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
