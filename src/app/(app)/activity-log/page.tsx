"use client";

import { useEffect, useState } from "react";
import { ScrollText, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AuditEntry {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
}

function ActionBadge({ action }: { action: string }) {
  const color = action.startsWith("create")
    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    : action.startsWith("update")
    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
    : action.startsWith("delete")
    ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
    : "bg-muted text-muted-foreground";

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {action}
    </span>
  );
}

function TimeAgo({ date }: { date: string }) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return <span>just now</span>;
  if (mins < 60) return <span>{mins}m ago</span>;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return <span>{hrs}h ago</span>;
  const days = Math.floor(hrs / 24);
  return <span>{days}d ago</span>;
}

export default function ActivityLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/activity-log?limit=100")
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        <h1 className="text-2xl font-bold">Activity Log</h1>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <ScrollText className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Activity Log</h1>
      </div>

      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">No activity recorded yet.</p>
      ) : (
        <div className="border rounded-lg divide-y">
          {entries.map((e) => (
            <div key={e.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <ActionBadge action={e.action} />
                  <span className="text-sm truncate">
                    {e.resourceType && (
                      <span className="text-muted-foreground">{e.resourceType}</span>
                    )}
                    {e.resourceId && (
                      <span className="text-muted-foreground ml-1 font-mono text-xs">
                        {e.resourceId.slice(0, 8)}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {e.actorName ?? e.actorEmail ?? "system"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    <TimeAgo date={e.createdAt} />
                  </span>
                  {(e.before != null || e.after != null) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => toggle(e.id)}
                    >
                      {expanded.has(e.id) ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
              {expanded.has(e.id) && (e.before != null || e.after != null) ? (
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  {e.before != null && (
                    <div>
                      <p className="font-medium text-muted-foreground mb-1">Before</p>
                      <pre className="bg-muted p-2 rounded overflow-auto max-h-40">
                        {JSON.stringify(e.before, null, 2)}
                      </pre>
                    </div>
                  )}
                  {e.after != null && (
                    <div>
                      <p className="font-medium text-muted-foreground mb-1">After</p>
                      <pre className="bg-muted p-2 rounded overflow-auto max-h-40">
                        {JSON.stringify(e.after, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
