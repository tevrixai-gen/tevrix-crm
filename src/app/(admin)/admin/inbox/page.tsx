import { db } from "@/lib/db";
import { webhookInbox } from "@/lib/db/schema";
import { desc, count, eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";

export default async function WebhookInboxPage() {
  const rows = await db
    .select()
    .from(webhookInbox)
    .orderBy(desc(webhookInbox.receivedAt))
    .limit(50);

  const [failedCount] = await db
    .select({ count: count() })
    .from(webhookInbox)
    .where(eq(webhookInbox.status, "failed"));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Webhook Inbox</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {failedCount.count} failed &middot; {rows.length} shown (latest 50)
        </p>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Event</th>
              <th className="text-left px-4 py-3 font-medium">External ID</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Received</th>
              <th className="text-left px-4 py-3 font-medium">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No webhook events received yet
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-mono text-xs">{row.eventType}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.externalId}</td>
                <td className="px-4 py-3">
                  <Badge
                    variant={
                      row.status === "processed"
                        ? "default"
                        : row.status === "failed"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {row.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {row.receivedAt ? new Date(row.receivedAt).toLocaleString("en-IN") : "—"}
                </td>
                <td className="px-4 py-3 text-xs text-red-600 truncate max-w-xs">
                  {row.processingError ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
