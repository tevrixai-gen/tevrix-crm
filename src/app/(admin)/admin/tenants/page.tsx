import { db } from "@/lib/db";
import { tenants, organization } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Building2 } from "lucide-react";

export default async function TenantsListPage() {
  const rows = await db
    .select({ tenant: tenants, org: organization })
    .from(tenants)
    .innerJoin(organization, eq(tenants.organizationId, organization.id))
    .orderBy(tenants.createdAt);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">All Tenants</h1>
        <p className="text-sm text-muted-foreground mt-1">{rows.length} registered</p>
      </div>

      <div className="border rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Company</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Plan</th>
              <th className="text-left px-4 py-3 font-medium">Dograh Org</th>
              <th className="text-left px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(({ tenant, org }) => (
              <tr key={tenant.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/tenants/${tenant.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {tenant.companyName ?? org.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={
                      tenant.status === "live"
                        ? "default"
                        : tenant.status === "paused"
                          ? "outline"
                          : tenant.status === "provisioning_failed"
                            ? "destructive"
                            : "secondary"
                    }
                  >
                    {tenant.status.replace("_", " ")}
                  </Badge>
                </td>
                <td className="px-4 py-3 capitalize">{tenant.planTier}</td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                  {tenant.dograhOrgId ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(tenant.createdAt).toLocaleDateString("en-IN")}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-14 text-center">
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
