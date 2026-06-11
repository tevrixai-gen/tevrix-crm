import { getTenantContext } from "@/lib/auth/get-tenant-context";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Upload, Plus } from "lucide-react";

export default async function LeadsPage() {
  const { tenantId } = await getTenantContext();

  const [total] = await db
    .select({ count: count() })
    .from(leads)
    .where(eq(leads.tenantId, tenantId));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">{total.count} total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1">
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
          <Button size="sm" className="gap-1">
            <Plus className="h-4 w-4" />
            Add Lead
          </Button>
        </div>
      </div>

      {total.count === 0 ? (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <p className="text-muted-foreground">No leads yet</p>
          <p className="text-sm text-muted-foreground">
            Import a CSV file or add leads manually to get started.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          Leads table coming in Phase 3
        </div>
      )}
    </div>
  );
}
