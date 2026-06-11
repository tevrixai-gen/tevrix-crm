"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Pause, Play, XCircle } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  status: string;
  totalLeads: number;
  calledLeads: number;
  connectedLeads: number;
  qualifiedLeads: number;
  maxConcurrency: number;
  schedule: { windowStart?: string; windowEnd?: string } | null;
  launchedAt: string | null;
  createdAt: string;
}

export default function CampaignMonitorPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${campaignId}`);
    if (res.status === 404) { setNotFound(true); return; }
    if (res.ok) {
      const data = await res.json();
      setCampaign(data.campaign);
    }
  }, [campaignId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5_000); // live ticker
    return () => clearInterval(t);
  }, [load]);

  async function action(path: string) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/campaigns/${campaignId}/${path}`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Action failed");
    }
    await load();
    setBusy(false);
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

  return (
    <div className="p-6 space-y-6 max-w-3xl">
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
            {campaign.schedule?.windowStart && (
              <p className="text-sm text-muted-foreground mt-1">
                Calling {campaign.schedule.windowStart}–{campaign.schedule.windowEnd}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {campaign.status === "draft" && (
            <Button size="sm" className="gap-1" disabled={busy} onClick={() => action("launch")}>
              <Play className="h-4 w-4" /> Launch
            </Button>
          )}
          {campaign.status === "running" && (
            <Button size="sm" variant="outline" className="gap-1" disabled={busy} onClick={() => action("pause")}>
              <Pause className="h-4 w-4" /> Pause
            </Button>
          )}
          {["running", "paused", "draft"].includes(campaign.status) && (
            <Button size="sm" variant="destructive" className="gap-1" disabled={busy} onClick={() => action("cancel")}>
              <XCircle className="h-4 w-4" /> Cancel
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
      )}

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

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{campaign.connectedLeads}</div>
            <p className="text-xs text-muted-foreground mt-1">Connected ({connectRate}% of called)</p>
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
            <div className="text-2xl font-bold">{campaign.totalLeads - campaign.calledLeads}</div>
            <p className="text-xs text-muted-foreground mt-1">Remaining</p>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Counters update automatically every few seconds as calls complete.
        See <Link href="/calls" className="underline">Conversations</Link> for transcripts.
      </p>
    </div>
  );
}
