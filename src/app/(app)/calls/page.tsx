import { getTenantContext } from "@/lib/auth/get-tenant-context";
import { db } from "@/lib/db";
import { calls } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";

export default async function CallsPage() {
  const { tenantId } = await getTenantContext();

  const [total] = await db
    .select({ count: count() })
    .from(calls)
    .where(eq(calls.tenantId, tenantId));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Conversations</h1>
        <p className="text-sm text-muted-foreground mt-1">{total.count} total</p>
      </div>

      {total.count === 0 ? (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <p className="text-muted-foreground">No conversations yet</p>
          <p className="text-sm text-muted-foreground">
            Launch a campaign and conversations will appear here with transcripts and recordings.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          Calls list coming in Phase 4
        </div>
      )}
    </div>
  );
}
