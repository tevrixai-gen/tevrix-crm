import { getTenantContext } from "@/lib/auth/get-tenant-context";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

export default async function KnowledgePage() {
  const { tenantId } = await getTenantContext();

  const [total] = await db
    .select({ count: count() })
    .from(documents)
    .where(eq(documents.tenantId, tenantId));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Knowledge</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total.count} document{total.count !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" className="gap-1">
          <Upload className="h-4 w-4" />
          Upload Document
        </Button>
      </div>

      {total.count === 0 ? (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <p className="text-muted-foreground">No documents yet</p>
          <p className="text-sm text-muted-foreground">
            Upload product catalogs, FAQs, or brochures so your agent can answer questions about your business.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          Document list coming in Phase 5
        </div>
      )}
    </div>
  );
}
