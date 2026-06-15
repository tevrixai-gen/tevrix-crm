"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  ArrowLeft,
  Pause,
  Play,
  XCircle,
  RotateCcw,
  Phone,
  Mic,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { formatPhoneDisplay } from "@/lib/phone";

interface Campaign {
  id: string;
  name: string;
  status: string;
  totalLeads: number;
  calledLeads: number;
  connectedLeads: number;
  qualifiedLeads: number;
  maxConcurrency: number;
  retryConfig: Record<string, unknown> | null;
  schedule: Record<string, unknown> | null;
  launchedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface CallRow {
  id: string;
  phone: string;
  outcome: string | null;
  durationSeconds: number | null;
  summary: string | null;
  createdAt: string;
  hasRecording: boolean;
}

function fmtDuration(s: number | null): string {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export default function CampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Runs state
  const [runs, setRuns] = useState<CallRow[]>([]);
  const [runsTotal, setRunsTotal] = useState(0);
  const [runsPage, setRunsPage] = useState(1);
  const [runsTotalPages, setRunsTotalPages] = useState(1);
  const [runsOutcome, setRunsOutcome] = useState("");
  const [tab, setTab] = useState<"overview" | "calls">("overview");

  // Redial dialog
  const router = useRouter();
  const [redialOpen, setRedialOpen] = useState(false);
  const [redialNoAnswer, setRedialNoAnswer] = useState(true);
  const [redialBusy, setRedialBusy] = useState(true);
  const [redialVoicemail, setRedialVoicemail] = useState(true);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${campaignId}`);
    if (res.status === 404) { setNotFound(true); return; }
    if (res.ok) {
      const data = await res.json();
      setCampaign(data.campaign);
    }
  }, [campaignId]);

  const loadRuns = useCallback(async () => {
    const params = new URLSearchParams({
      campaignId,
      page: String(runsPage),
      limit: "20",
    });
    if (runsOutcome) params.set("outcome", runsOutcome);
    const res = await fetch(`/api/calls?${params}`);
    if (res.ok) {
      const data = await res.json();
      setRuns(data.calls);
      setRunsTotal(data.total);
      setRunsTotalPages(data.totalPages || 1);
    }
  }, [campaignId, runsPage, runsOutcome]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 5_000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [load]);

  useEffect(() => {
    if (tab === "calls") loadRuns();
  }, [tab, loadRuns]);

  async function action(path: string) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/campaigns/${campaignId}/${path}`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const msg = body?.error ?? "Action failed";
      setError(msg);
      toast.error(msg);
    } else {
      const labels: Record<string, string> = {
        launch: "Campaign launched",
        resume: "Campaign resumed",
        pause: "Campaign paused",
        cancel: "Campaign cancelled",
      };
      toast.success(labels[path] ?? "Done");
    }
    await load();
    setBusy(false);
  }

  async function submitRedial() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/campaigns/${campaignId}/redial`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        retryOnNoAnswer: redialNoAnswer,
        retryOnBusy: redialBusy,
        retryOnVoicemail: redialVoicemail,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Redial failed");
      setBusy(false);
      return;
    }
    toast.success(`Redial campaign created with ${data.audienceSize} leads`);
    setRedialOpen(false);
    setBusy(false);
    router.push(`/campaigns/${data.id}`);
  }

  if (notFound) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Campaign not found.</p>
        <Link href="/campaigns"><Button variant="outline" size="sm" className="mt-3">Back to campaigns</Button></Link>
      </div>
    );
  }

  if (!campaign) return <div className="p-6 text-muted-foreground">Loading…</div>;

  const pct = campaign.totalLeads > 0
    ? Math.round((campaign.calledLeads / campaign.totalLeads) * 100)
    : 0;
  const connectRate = campaign.calledLeads > 0
    ? Math.round((campaign.connectedLeads / campaign.calledLeads) * 100)
    : 0;
  const failedLeads = campaign.calledLeads - campaign.connectedLeads;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/campaigns">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-3">
              {campaign.name}
              <Badge variant={campaign.status === "running" ? "default" : "secondary"}>
                {campaign.status}
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Created {new Date(campaign.createdAt).toLocaleDateString("en-IN")}
              {campaign.launchedAt && ` · Launched ${new Date(campaign.launchedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" })}`}
              {campaign.completedAt && ` · Completed ${new Date(campaign.completedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" })}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {campaign.status === "draft" && (
            <Button size="sm" className="gap-1" disabled={busy} onClick={() => action("launch")}>
              <Play className="h-4 w-4" /> Launch
            </Button>
          )}
          {campaign.status === "paused" && (
            <Button size="sm" className="gap-1" disabled={busy} onClick={() => action("resume")}>
              <Play className="h-4 w-4" /> Resume
            </Button>
          )}
          {campaign.status === "running" && (
            <Button size="sm" variant="outline" className="gap-1" disabled={busy} onClick={() => action("pause")}>
              <Pause className="h-4 w-4" /> Pause
            </Button>
          )}
          {campaign.status === "completed" && (
            <Button size="sm" variant="outline" className="gap-1" disabled={busy} onClick={() => setRedialOpen(true)}>
              <RotateCcw className="h-4 w-4" /> Redial
            </Button>
          )}
          {["running", "paused", "draft"].includes(campaign.status) && (
            <Button size="sm" variant="destructive" className="gap-1" disabled={busy} onClick={() => setConfirmCancel(true)}>
              <XCircle className="h-4 w-4" /> Cancel
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "overview"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "calls"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("calls")}
        >
          Calls {campaign.calledLeads > 0 && `(${campaign.calledLeads})`}
        </button>
      </div>

      {/* ── Overview Tab ── */}
      {tab === "overview" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={pct} />
              <p className="text-sm text-muted-foreground">
                {campaign.calledLeads} of {campaign.totalLeads} leads called ({pct}%)
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{campaign.connectedLeads}</div>
                <p className="text-xs text-muted-foreground mt-1">Connected ({connectRate}%)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">{campaign.qualifiedLeads}</div>
                <p className="text-xs text-muted-foreground mt-1">Qualified</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-orange-500">{failedLeads}</div>
                <p className="text-xs text-muted-foreground mt-1">Not reached</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{campaign.totalLeads - campaign.calledLeads}</div>
                <p className="text-xs text-muted-foreground mt-1">Remaining</p>
              </CardContent>
            </Card>
          </div>

          {/* Settings summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-muted-foreground">Concurrent calls</span>
                <span>{campaign.maxConcurrency}</span>

                {campaign.retryConfig && (
                  <>
                    <span className="text-muted-foreground">Retries</span>
                    <span>
                      {(campaign.retryConfig as Record<string, unknown>).enabled === false
                        ? "Disabled"
                        : `${(campaign.retryConfig as Record<string, unknown>).maxRetries ?? (campaign.retryConfig as Record<string, unknown>).maxAttempts ?? 2}×`}
                    </span>
                  </>
                )}

                {campaign.schedule && (
                  <>
                    <span className="text-muted-foreground">Schedule</span>
                    <span>
                      {(campaign.schedule as Record<string, unknown>).enabled === false
                        ? "No schedule"
                        : (campaign.schedule as Record<string, unknown>).timezone
                          ? `${((campaign.schedule as Record<string, unknown>).slots as unknown[])?.length ?? 0} days · ${(campaign.schedule as Record<string, unknown>).timezone}`
                          : `${(campaign.schedule as Record<string, unknown>).windowStart}–${(campaign.schedule as Record<string, unknown>).windowEnd}`}
                    </span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Counters update automatically every few seconds.
            Click the <strong>Calls</strong> tab to see individual conversations.
          </p>
        </>
      )}

      {/* ── Calls Tab ── */}
      {tab === "calls" && (
        <>
          <div className="flex gap-3">
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={runsOutcome}
              onChange={(e) => { setRunsOutcome(e.target.value); setRunsPage(1); }}
            >
              <option value="">All outcomes</option>
              <option value="qualified">Qualified</option>
              <option value="connected">Connected</option>
              <option value="callback">Callback</option>
              <option value="not_answered">No answer</option>
              <option value="not_interested">Not interested</option>
              <option value="failed">Failed</option>
            </select>
            <span className="text-sm text-muted-foreground self-center">
              {runsTotal} call{runsTotal !== 1 ? "s" : ""}
            </span>
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
                {runs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-14 text-center">
                      <div className="space-y-3">
                        <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                          <Phone className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium">No calls yet</p>
                          <p className="text-sm text-muted-foreground">
                            {campaign.status === "draft"
                              ? "Launch the campaign to start calling."
                              : "Calls will appear here as they complete."}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                {runs.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link
                        href={`/calls/${c.id}`}
                        className="font-mono text-xs text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {c.hasRecording && <Mic className="h-3 w-3" />}
                        {formatPhoneDisplay(c.phone)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.outcome ?? "running"} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDuration(c.durationSeconds)}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-sm truncate">{c.summary ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleString("en-IN", {
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

          {runsTotalPages > 1 && (
            <div className="flex items-center justify-end gap-2 text-sm">
              <Button variant="outline" size="sm" disabled={runsPage <= 1} onClick={() => setRunsPage(runsPage - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-muted-foreground">Page {runsPage} of {runsTotalPages}</span>
              <Button variant="outline" size="sm" disabled={runsPage >= runsTotalPages} onClick={() => setRunsPage(runsPage + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel campaign?"
        description="This will stop all pending calls. Calls already in progress will finish. This cannot be undone."
        confirmLabel="Yes, cancel campaign"
        variant="destructive"
        loading={busy}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={async () => {
          await action("cancel");
          setConfirmCancel(false);
        }}
      />

      {/* Redial Dialog */}
      {redialOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Redial failed calls</h2>
              <button onClick={() => setRedialOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              Create a new campaign from calls that didn&apos;t connect. Select which outcomes to retry:
            </p>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input accent-primary"
                  checked={redialNoAnswer}
                  onChange={(e) => setRedialNoAnswer(e.target.checked)}
                />
                <span className="text-sm">No answer</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input accent-primary"
                  checked={redialBusy}
                  onChange={(e) => setRedialBusy(e.target.checked)}
                />
                <span className="text-sm">Busy / Failed</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input accent-primary"
                  checked={redialVoicemail}
                  onChange={(e) => setRedialVoicemail(e.target.checked)}
                />
                <span className="text-sm">Voicemail / Error</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setRedialOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="gap-1"
                disabled={busy || (!redialNoAnswer && !redialBusy && !redialVoicemail)}
                onClick={submitRedial}
              >
                <RotateCcw className="h-4 w-4" /> Create redial campaign
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
