"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Clock, CreditCard, Pencil, Save, X } from "lucide-react";

interface SettingsData {
  companyName: string;
  companyWebsite: string;
  industry: string;
  dltEntityId: string;
  callingWindowStart: string;
  callingWindowEnd: string;
  timezone: string;
  planTier: string;
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
  const [editing, setEditing] = useState<"profile" | "hours" | null>(null);
  const [saving, setSaving] = useState(false);

  function set(key: keyof SettingsData, value: string) {
    setData((d) => ({ ...d, [key]: value }));
  }

  async function save(section: "profile" | "hours") {
    setSaving(true);
    const patch =
      section === "profile"
        ? {
            companyName: data.companyName,
            companyWebsite: data.companyWebsite,
            industry: data.industry,
            dltEntityId: data.dltEntityId,
          }
        : {
            callingWindowStart: data.callingWindowStart,
            callingWindowEnd: data.callingWindowEnd,
            timezone: data.timezone,
          };

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

  function cancel(section: "profile" | "hours") {
    if (section === "profile") {
      setData((d) => ({
        ...d,
        companyName: initial.companyName,
        companyWebsite: initial.companyWebsite,
        industry: initial.industry,
        dltEntityId: initial.dltEntityId,
      }));
    } else {
      setData((d) => ({
        ...d,
        callingWindowStart: initial.callingWindowStart,
        callingWindowEnd: initial.callingWindowEnd,
        timezone: initial.timezone,
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
    </div>
  );
}
