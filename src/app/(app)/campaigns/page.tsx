import { getTenantContext } from "@/lib/auth/get-tenant-context";
import { db } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function CampaignsPage() {
  const { tenantId } = await getTenantContext();

  const [total] = await db
    .select({ count: count() })
    .from(campaigns)
    .where(eq(campaigns.tenantId, tenantId));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-1">{total.count} total</p>
        </div>
        <Button size="sm" className="gap-1">
          <Plus className="h-4 w-4" />
          New Campaign
        </Button>
      </div>

      {total.count === 0 ? (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <p className="text-muted-foreground">No campaigns yet</p>
          <p className="text-sm text-muted-foreground">
            Import leads first, then create a campaign to start calling.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          Campaigns list coming in Phase 3
        </div>
      )}
    </div>
  );
}
