"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Mic } from "lucide-react";
import { formatPhoneDisplay } from "@/lib/phone";

interface CallRow {
  id: string;
  phone: string;
  outcome: string | null;
  durationSeconds: number | null;
  summary: string | null;
  createdAt: string;
  hasRecording: boolean;
}

const OUTCOME_FILTERS = [
  { value: "", label: "All outcomes" },
  { value: "qualified", label: "Qualified" },
  { value: "connected", label: "Connected" },
  { value: "callback", label: "Callback" },
  { value: "not_answered", label: "No answer" },
  { value: "not_interested", label: "Not interested" },
  { value: "failed", label: "Failed" },
];

const OUTCOME_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  qualified: "default",
  failed: "destructive",
  error: "destructive",
  not_interested: "outline",
};

function fmtDuration(s: number | null): string {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export default function CallsView() {
  const [rows, setRows] = useState<CallRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [outcome, setOutcome] = useState("");
  const [days, setDays] = useState("30");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (outcome) params.set("outcome", outcome);
    if (days) params.set("days", days);
    const res = await fetch(`/api/calls?${params}`);
    if (res.ok) {
      const data = await res.json();
      setRows(data.calls);
      setTotal(data.total);
      setTotalPages(data.totalPages || 1);
    }
    setLoading(false);
  }, [page, outcome, days]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Conversations</h1>
        <p className="text-sm text-muted-foreground mt-1">{total} total</p>
      </div>

      <div className="flex gap-3">
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={outcome}
          onChange={(e) => { setOutcome(e.target.value); setPage(1); }}
        >
          {OUTCOME_FILTERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={days}
          onChange={(e) => { setDays(e.target.value); setPage(1); }}
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="">All time</option>
        </select>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Phone</th>
              <th className="text-left px-4 py-3 font-medium">Outcome</th>
              <th className="text-left px-4 py-3 font-medium">Duration</th>
              <th className="text-left px-4 py-3 font-medium">Summary</th>
              <th className="text-left px-4 py-3 font-medium">When</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No conversations yet. Launch a campaign and they will appear here.
                </td>
              </tr>
            )}
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link href={`/calls/${c.id}`} className="font-mono text-xs text-primary hover:underline inline-flex items-center gap-1">
                    {c.hasRecording && <Mic className="h-3 w-3" />}
                    {formatPhoneDisplay(c.phone)}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {c.outcome ? (
                    <Badge variant={OUTCOME_BADGE[c.outcome] ?? "secondary"}>
                      {c.outcome.replace("_", " ")}
                    </Badge>
                  ) : (
                    <Badge variant="outline">in progress</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDuration(c.durationSeconds)}</td>
                <td className="px-4 py-3 text-muted-foreground max-w-sm truncate">{c.summary ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {new Date(c.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
