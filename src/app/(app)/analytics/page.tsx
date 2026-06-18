"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Phone, TrendingUp, Clock, Target, BarChart3,
} from "lucide-react";

interface Analytics {
  days: number;
  totalCalls: number;
  avgDurationSeconds: number;
  outcomes: Record<string, number>;
  daily: Array<{ day: string; count: number }>;
  campaigns: Array<{
    id: string;
    name: string;
    status: string;
    totalLeads: number;
    calledLeads: number;
    connectedLeads: number;
    qualifiedLeads: number;
  }>;
}

const OUTCOME_COLORS: Record<string, string> = {
  connected: "bg-blue-500",
  qualified: "bg-emerald-500",
  callback: "bg-amber-500",
  not_answered: "bg-gray-400",
  not_interested: "bg-orange-400",
  dnc: "bg-red-400",
  failed: "bg-red-500",
  error: "bg-red-600",
};

const OUTCOME_LABELS: Record<string, string> = {
  connected: "Connected",
  qualified: "Qualified",
  callback: "Callback",
  not_answered: "No Answer",
  not_interested: "Not Interested",
  dnc: "DNC",
  failed: "Failed",
  error: "Error",
};

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [days, setDays] = useState("30");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/analytics?days=${days}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const connectRate = data && data.totalCalls > 0
    ? Math.round(((data.outcomes.connected ?? 0) + (data.outcomes.qualified ?? 0) + (data.outcomes.callback ?? 0)) / data.totalCalls * 100)
    : 0;

  const qualifiedRate = data && data.totalCalls > 0
    ? Math.round((data.outcomes.qualified ?? 0) / data.totalCalls * 100)
    : 0;

  const fmtDur = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  // Build daily series with zero-fill
  const dailySeries: Array<{ label: string; value: number }> = [];
  if (data) {
    const dayMap = new Map(data.daily.map((d) => [d.day, d.count]));
    const numDays = Math.min(Number(days) || 30, 60);
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000);
      const key = d.toISOString().slice(0, 10);
      dailySeries.push({
        label: numDays <= 14
          ? d.toLocaleDateString("en-IN", { weekday: "short" })
          : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        value: dayMap.get(key) ?? 0,
      });
    }
  }
  const maxBar = Math.max(1, ...dailySeries.map((s) => s.value));

  // Outcome breakdown sorted by count
  const outcomeEntries = data
    ? Object.entries(data.outcomes).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Call performance and trends</p>
        </div>
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={days}
          onChange={(e) => setDays(e.target.value)}
        >
          <option value="7">Last 7 days</option>
          <option value="14">Last 14 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      {/* KPI cards */}
      {loading && !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="shadow-sm">
              <CardContent className="pt-6 space-y-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Calls</CardTitle>
              <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600">
                <Phone className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.totalCalls.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">In the last {days} days</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Connect Rate</CardTitle>
              <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-cyan-50 text-cyan-600">
                <TrendingUp className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{connectRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">Connected + qualified + callback</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Qualified Rate</CardTitle>
              <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-600">
                <Target className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{qualifiedRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">{data.outcomes.qualified ?? 0} qualified leads</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Duration</CardTitle>
              <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-violet-50 text-violet-600">
                <Clock className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmtDur(data.avgDurationSeconds)}</div>
              <p className="text-xs text-muted-foreground mt-1">Per connected call</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily volume chart */}
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Daily Call Volume</CardTitle>
          </CardHeader>
          <CardContent>
            {!data ? (
              <Skeleton className="h-40 w-full" />
            ) : dailySeries.length === 0 || data.totalCalls === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <BarChart3 className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No calls in this period</p>
              </div>
            ) : (
              <div className="flex items-end gap-[2px] h-40">
                {dailySeries.map((s, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <span className="text-[10px] text-muted-foreground leading-none">
                      {s.value || ""}
                    </span>
                    <div
                      className="w-full bg-gradient-to-t from-primary to-primary/60 rounded-t transition-all"
                      style={{ height: `${Math.max(2, (s.value / maxBar) * 100)}%` }}
                    />
                    {Number(days) <= 14 && (
                      <span className="text-[10px] text-muted-foreground leading-none truncate w-full text-center">
                        {s.label}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Outcome breakdown */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Outcome Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {!data ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : outcomeEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No data yet</p>
            ) : (
              <div className="space-y-3">
                {outcomeEntries.map(([outcome, cnt]) => {
                  const pct = data.totalCalls > 0 ? Math.round((cnt / data.totalCalls) * 100) : 0;
                  return (
                    <div key={outcome} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{OUTCOME_LABELS[outcome] ?? outcome}</span>
                        <span className="text-muted-foreground">{cnt} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${OUTCOME_COLORS[outcome] ?? "bg-gray-400"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Campaign performance table */}
      {data && data.campaigns.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Campaign Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Campaign</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-4 py-3 font-medium">Audience</th>
                    <th className="text-right px-4 py-3 font-medium">Called</th>
                    <th className="text-right px-4 py-3 font-medium">Connected</th>
                    <th className="text-right px-4 py-3 font-medium">Qualified</th>
                    <th className="text-right px-4 py-3 font-medium">Connect %</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.campaigns.map((c) => {
                    const cr = c.calledLeads > 0 ? Math.round((c.connectedLeads / c.calledLeads) * 100) : 0;
                    return (
                      <tr key={c.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{c.name}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            c.status === "completed" ? "bg-green-100 text-green-800" :
                            c.status === "running" ? "bg-blue-100 text-blue-800" :
                            c.status === "draft" ? "bg-gray-100 text-gray-800" :
                            "bg-amber-100 text-amber-800"
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">{c.totalLeads}</td>
                        <td className="px-4 py-3 text-right">{c.calledLeads}</td>
                        <td className="px-4 py-3 text-right">{c.connectedLeads}</td>
                        <td className="px-4 py-3 text-right text-emerald-600 font-medium">{c.qualifiedLeads}</td>
                        <td className="px-4 py-3 text-right">{cr}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
