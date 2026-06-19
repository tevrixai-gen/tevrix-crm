"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Square,
  Headphones,
} from "lucide-react";
import { formatPhoneDisplay } from "@/lib/phone";
import { EmptyState } from "@/components/ui/empty-state";

interface RecordingRow {
  id: string;
  phone: string;
  outcome: string | null;
  durationSeconds: number | null;
  summary: string | null;
  createdAt: string;
  leadName: string | null;
  campaignName: string | null;
}

function fmtDuration(s: number | null): string {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

function InlinePlayer({ callId }: { callId: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused" | "error">("idle");
  const [url, setUrl] = useState<string | null>(null);

  async function loadAndPlay() {
    if (url && audioRef.current) {
      audioRef.current.play();
      setState("playing");
      return;
    }

    setState("loading");
    try {
      const res = await fetch(`/api/calls/${callId}/recording`);
      if (!res.ok) { setState("error"); return; }
      const data = await res.json();
      setUrl(data.url);
      setState("playing");
    } catch {
      setState("error");
    }
  }

  useEffect(() => {
    if (url && state === "playing") {
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play().catch(() => setState("error"));
      audio.onended = () => setState("idle");
      audio.onerror = () => setState("error");
      return () => { audio.pause(); audio.src = ""; };
    }
  }, [url, state]);

  if (state === "error") {
    return <span className="text-xs text-destructive">Failed</span>;
  }

  if (state === "idle" || state === "loading") {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        disabled={state === "loading"}
        onClick={loadAndPlay}
      >
        <Play className="h-3.5 w-3.5" />
      </Button>
    );
  }

  if (state === "playing") {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => {
          audioRef.current?.pause();
          setState("paused");
        }}
      >
        <Pause className="h-3.5 w-3.5" />
      </Button>
    );
  }

  // paused
  return (
    <div className="flex gap-0.5">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => {
          audioRef.current?.play();
          setState("playing");
        }}
      >
        <Play className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 text-muted-foreground"
        onClick={() => {
          audioRef.current?.pause();
          if (audioRef.current) audioRef.current.currentTime = 0;
          setState("idle");
        }}
      >
        <Square className="h-3 w-3" />
      </Button>
    </div>
  );
}

export default function RecordingsPage() {
  const [rows, setRows] = useState<RecordingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [outcome, setOutcome] = useState("");
  const [days, setDays] = useState("30");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "25",
      hasRecording: "true",
    });
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

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Recordings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {total} recording{total !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex gap-3">
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={outcome}
          onChange={(e) => { setOutcome(e.target.value); setPage(1); }}
        >
          <option value="">All outcomes</option>
          <option value="qualified">Qualified</option>
          <option value="connected">Connected</option>
          <option value="callback">Callback</option>
          <option value="not_answered">No answer</option>
          <option value="not_interested">Not interested</option>
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
              <th className="text-left px-4 py-3 font-medium w-10"></th>
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
                <td colSpan={6} className="px-4 py-0">
                  <EmptyState
                    icon={<Headphones className="h-8 w-8" />}
                    title="No recordings yet"
                    description="Recordings appear here after your agent completes calls."
                    actionLabel="Create a campaign"
                    actionHref="/campaigns/new"
                  />
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <InlinePlayer callId={r.id} />
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/calls/${r.id}`}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {formatPhoneDisplay(r.phone)}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.outcome ?? "running"} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDuration(r.durationSeconds)}</td>
                <td className="px-4 py-3 text-muted-foreground max-w-sm truncate">{r.summary ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {new Date(r.createdAt).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
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
