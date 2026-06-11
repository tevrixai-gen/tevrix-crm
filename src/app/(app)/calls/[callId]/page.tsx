"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2, CalendarClock, Ban, Play } from "lucide-react";
import { formatPhoneDisplay } from "@/lib/phone";

interface CallDetail {
  id: string;
  phone: string;
  outcome: string | null;
  durationSeconds: number | null;
  transcript: Array<{ role: string; content: string }> | null;
  summary: string | null;
  gatheredData: Record<string, unknown> | null;
  hasRecording: boolean;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
}

export default function CallDetailPage() {
  const { callId } = useParams<{ callId: string }>();
  const [call, setCall] = useState<CallDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/calls/${callId}`);
    if (res.status === 404) { setNotFound(true); return; }
    if (res.ok) setCall((await res.json()).call);
  }, [callId]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function fetchRecording() {
    const res = await fetch(`/api/calls/${callId}/recording`);
    if (res.ok) {
      const { url } = await res.json();
      setRecordingUrl(url);
    }
  }

  async function act(action: string, label: string) {
    setBusy(true);
    setActionMsg("");
    const res = await fetch(`/api/calls/${callId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setActionMsg(res.ok ? `${label} ✓` : "Action failed");
    await load();
    setBusy(false);
  }

  if (notFound) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Conversation not found.</p>
        <Link href="/calls"><Button variant="outline" size="sm" className="mt-3">Back</Button></Link>
      </div>
    );
  }

  if (!call) return <div className="p-6 text-muted-foreground">Loading…</div>;

  const gathered = call.gatheredData && typeof call.gatheredData === "object"
    ? Object.entries(call.gatheredData)
    : [];

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/calls">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold font-mono">{formatPhoneDisplay(call.phone)}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {new Date(call.createdAt).toLocaleString("en-IN")}
              {call.durationSeconds ? ` · ${Math.floor(call.durationSeconds / 60)}m ${call.durationSeconds % 60}s` : ""}
            </p>
          </div>
        </div>
        {call.outcome && (
          <Badge variant={call.outcome === "qualified" ? "default" : "secondary"}>
            {call.outcome.replace("_", " ")}
          </Badge>
        )}
      </div>

      {/* One-click actions */}
      <div className="flex gap-2 items-center flex-wrap">
        <Button size="sm" className="gap-1" disabled={busy} onClick={() => act("mark_qualified", "Marked qualified")}>
          <CheckCircle2 className="h-4 w-4" /> Mark qualified
        </Button>
        <Button size="sm" variant="outline" className="gap-1" disabled={busy} onClick={() => act("schedule_followup", "Follow-up scheduled")}>
          <CalendarClock className="h-4 w-4" /> Schedule follow-up
        </Button>
        <Button size="sm" variant="outline" className="gap-1 text-destructive" disabled={busy} onClick={() => act("do_not_call", "Marked do-not-call")}>
          <Ban className="h-4 w-4" /> Don&apos;t call again
        </Button>
        {actionMsg && <span className="text-sm text-green-600">{actionMsg}</span>}
      </div>

      {/* Recording */}
      {call.hasRecording && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recording</CardTitle>
          </CardHeader>
          <CardContent>
            {recordingUrl ? (
              <audio controls className="w-full" src={recordingUrl} />
            ) : (
              <Button variant="outline" size="sm" className="gap-1" onClick={fetchRecording}>
                <Play className="h-4 w-4" /> Load recording
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* AI summary */}
      {call.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{call.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* What we learned */}
      {gathered.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What we learned</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {gathered.map(([key, value]) => (
                <div key={key} className="flex justify-between gap-3 border-b pb-1.5">
                  <dt className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</dt>
                  <dd className="font-medium text-right">{String(value)}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Transcript */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transcript</CardTitle>
        </CardHeader>
        <CardContent>
          {call.transcript && call.transcript.length > 0 ? (
            <div className="space-y-3">
              {call.transcript.map((turn, i) => (
                <div key={i} className={`flex ${turn.role === "assistant" ? "" : "justify-end"}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    turn.role === "assistant"
                      ? "bg-muted"
                      : "bg-primary/10"
                  }`}>
                    <p className="text-xs text-muted-foreground mb-0.5">
                      {turn.role === "assistant" ? "Agent" : "Lead"}
                    </p>
                    {turn.content}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No transcript available {call.outcome ? "for this call" : "yet — the call may still be in progress"}.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
