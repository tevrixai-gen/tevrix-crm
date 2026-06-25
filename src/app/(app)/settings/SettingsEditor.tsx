"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Clock, CreditCard, Pencil, Save, X, PhoneForwarded, TrendingUp } from "lucide-react";

interface SettingsData {
  companyName: string;
  companyWebsite: string;
  industry: string;
  dltEntityId: string;
  callingWindowStart: string;
  callingWindowEnd: string;
  timezone: string;
  planTier: string;
  escalationNumber: string;
  escalationRule: string;
  valuePerQualifiedLead: string;
  costPerMinute: string;
  avgHumanCallMinutes: string;
}

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET)" },
  { value: "America/New_York", label: "America/New_York (ET)" },
  { value: "America/Chicago", label: "America/Chicago (CT)" },
  { value: "America/Denver", label: "America/Denver (MT)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PT)" },
  { value: "Pacific/Auckland", label: "Pacific/Auckland (NZST)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST)" },
];

export default function SettingsEditor({ initial }: { initial: SettingsData }) {
  const [data, setData] = useState(initial);
  const [editing, setEditing] = useState<"profile" | "hours" | "escalation" | "roi" | null>(null);
  const [saving, setSaving] = useState(false);

  function set(key: keyof SettingsData, value: string) {
    setData((d) => ({ ...d, [key]: value }));
  }

  async function save(section: "profile" | "hours" | "escalation" | "roi") {
    setSaving(true);
    let patch: Record<string, unknown>;
    if (section === "profile") {
      patch = {
        companyName: data.companyName,
        companyWebsite: data.companyWebsite,
        industry: data.industry,
        dltEntityId: data.dltEntityId,
      };
    } else if (section === "hours") {
      patch = {
        callingWindowStart: data.callingWindowStart,
        callingWindowEnd: data.callingWindowEnd,
        timezone: data.timezone,
      };
    } else if (section === "escalation") {
      patch = {
        escalationNumber: data.escalationNumber,
        escalationRule: data.escalationRule,
      };
    } else {
      patch = {
        valuePerQualifiedLead: data.valuePerQualifiedLead,
        costPerMinute: data.costPerMinute,
        avgHumanCallMinutes: data.avgHumanCallMinutes,
      };
    }

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    if (res.ok) {
      toast.success("Settings saved");
      setEditing(null);
    } else {
      const body = await res.json().catch(() => null);
      toast.error(body?.error ?? "Failed to save");
    }
    setSaving(false);
  }

  function cancel(section: "profile" | "hours" | "escalation" | "roi") {
    if (section === "profile") {
      setData((d) => ({
        ...d,
        companyName: initial.companyName,
        companyWebsite: initial.companyWebsite,
        industry: initial.industry,
        dltEntityId: initial.dltEntityId,
      }));
    } else if (section === "hours") {
      setData((d) => ({
        ...d,
        callingWindowStart: initial.callingWindowStart,
        callingWindowEnd: initial.callingWindowEnd,
        timezone: initial.timezone,
      }));
    } else if (section === "escalation") {
      setData((d) => ({
        ...d,
        escalationNumber: initial.escalationNumber,
        escalationRule: initial.escalationRule,
      }));
    } else {
      setData((d) => ({
        ...d,
        valuePerQualifiedLead: initial.valuePerQualifiedLead,
        costPerMinute: initial.costPerMinute,
        avgHumanCallMinutes: initial.avgHumanCallMinutes,
      }));
    }
    setEditing(null);
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-blue-600" />
          </div>
          <CardTitle className="text-base flex-1">Company Profile</CardTitle>
          {editing !== "profile" && (
            <Button variant="ghost" size="sm" onClick={() => setEditing("profile")}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editing === "profile" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Company name</Label>
                <Input value={data.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="Acme Corp" />
              </div>
              <div className="space-y-2">
                <Label>Industry</Label>
                <Input value={data.industry} onChange={(e) => set("industry", e.target.value)} placeholder="Healthcare, SaaS, E-commerce…" />
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input value={data.companyWebsite} onChange={(e) => set("companyWebsite", e.target.value)} placeholder="https://example.com" />
              </div>
              <div className="space-y-2">
                <Label>DLT Entity ID</Label>
                <Input value={data.dltEntityId} onChange={(e) => set("dltEntityId", e.target.value)} placeholder="110100001234" />
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" disabled={saving} onClick={() => save("profile")}>
                  <Save className="h-3.5 w-3.5 mr-1.5" /> {saving ? "Saving…" : "Save"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => cancel("profile")}>
                  <X className="h-3.5 w-3.5 mr-1.5" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-[140px_1fr] gap-y-3 text-sm">
              <dt className="text-muted-foreground">Company</dt>
              <dd className="font-medium">{data.companyName || "—"}</dd>
              <dt className="text-muted-foreground">Industry</dt>
              <dd className="font-medium capitalize">{data.industry || "—"}</dd>
              <dt className="text-muted-foreground">Website</dt>
              <dd className="font-medium">{data.companyWebsite || "—"}</dd>
              <dt className="text-muted-foreground">DLT Entity ID</dt>
              <dd className="font-medium">{data.dltEntityId || "—"}</dd>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <CardTitle className="text-base flex-1">Calling Hours</CardTitle>
          {editing !== "hours" && (
            <Button variant="ghost" size="sm" onClick={() => setEditing("hours")}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editing === "hours" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start time</Label>
                  <Input type="time" value={data.callingWindowStart} onChange={(e) => set("callingWindowStart", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>End time</Label>
                  <Input type="time" value={data.callingWindowEnd} onChange={(e) => set("callingWindowEnd", e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={data.timezone}
                  onChange={(e) => set("timezone", e.target.value)}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" disabled={saving} onClick={() => save("hours")}>
                  <Save className="h-3.5 w-3.5 mr-1.5" /> {saving ? "Saving…" : "Save"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => cancel("hours")}>
                  <X className="h-3.5 w-3.5 mr-1.5" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-[140px_1fr] gap-y-3 text-sm">
              <dt className="text-muted-foreground">Window</dt>
              <dd className="font-medium">{data.callingWindowStart}–{data.callingWindowEnd}</dd>
              <dt className="text-muted-foreground">Timezone</dt>
              <dd className="font-medium">{data.timezone}</dd>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-violet-50 flex items-center justify-center">
            <CreditCard className="h-4 w-4 text-violet-600" />
          </div>
          <CardTitle className="text-base">Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-medium capitalize">{data.planTier} Plan</p>
          <p className="text-xs text-muted-foreground mt-1">
            Contact support to upgrade your plan.
          </p>
        </CardContent>
      </Card>

      {/* Escalation */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-orange-50 flex items-center justify-center">
            <PhoneForwarded className="h-4 w-4 text-orange-600" />
          </div>
          <CardTitle className="text-base flex-1">Call Escalation</CardTitle>
          {editing !== "escalation" && (
            <Button variant="ghost" size="sm" onClick={() => setEditing("escalation")}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editing === "escalation" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Escalation phone number</Label>
                <Input
                  value={data.escalationNumber}
                  onChange={(e) => set("escalationNumber", e.target.value)}
                  placeholder="+919876543210"
                />
                <p className="text-xs text-muted-foreground">
                  E.164 format. The agent will transfer calls to this number.
                </p>
              </div>
              <div className="space-y-2">
                <Label>When to escalate</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={data.escalationRule}
                  onChange={(e) => set("escalationRule", e.target.value)}
                >
                  <option value="off">Off — no automatic escalation</option>
                  <option value="on_qualified">When lead is qualified</option>
                  <option value="on_request">When lead asks for a human</option>
                  <option value="on_keyword">On keyword trigger</option>
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" disabled={saving} onClick={() => save("escalation")}>
                  <Save className="h-3.5 w-3.5 mr-1.5" /> {saving ? "Saving…" : "Save"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => cancel("escalation")}>
                  <X className="h-3.5 w-3.5 mr-1.5" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-[140px_1fr] gap-y-3 text-sm">
              <dt className="text-muted-foreground">Number</dt>
              <dd className="font-medium font-mono">{data.escalationNumber || "Not set"}</dd>
              <dt className="text-muted-foreground">Rule</dt>
              <dd className="font-medium capitalize">{data.escalationRule.replace(/_/g, " ")}</dd>
            </dl>
          )}
        </CardContent>
      </Card>

      {/* ROI Inputs */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <CardTitle className="text-base flex-1">ROI Calculation</CardTitle>
          {editing !== "roi" && (
            <Button variant="ghost" size="sm" onClick={() => setEditing("roi")}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editing === "roi" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Value per qualified lead (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="50"
                  value={data.valuePerQualifiedLead}
                  onChange={(e) => set("valuePerQualifiedLead", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  How much is one qualified lead worth to your business?
                </p>
              </div>
              <div className="space-y-2">
                <Label>AI cost per minute (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={data.costPerMinute}
                  onChange={(e) => set("costPerMinute", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Avg human call duration (minutes)</Label>
                <Input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={data.avgHumanCallMinutes}
                  onChange={(e) => set("avgHumanCallMinutes", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  If a human made these calls, how long would each take?
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" disabled={saving} onClick={() => save("roi")}>
                  <Save className="h-3.5 w-3.5 mr-1.5" /> {saving ? "Saving…" : "Save"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => cancel("roi")}>
                  <X className="h-3.5 w-3.5 mr-1.5" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-[140px_1fr] gap-y-3 text-sm">
              <dt className="text-muted-foreground">Lead value</dt>
              <dd className="font-medium">₹{Number(data.valuePerQualifiedLead).toLocaleString("en-IN")}</dd>
              <dt className="text-muted-foreground">AI cost/min</dt>
              <dd className="font-medium">₹{data.costPerMinute}</dd>
              <dt className="text-muted-foreground">Human avg call</dt>
              <dd className="font-medium">{data.avgHumanCallMinutes} min</dd>
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
