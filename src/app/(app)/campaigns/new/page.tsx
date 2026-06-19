"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import CampaignAdvancedSettings, {
  DEFAULT_ADVANCED_CONFIG,
  type AdvancedConfig,
} from "@/components/campaigns/CampaignAdvancedSettings";

const AUDIENCE_STATUSES = [
  { value: "new", label: "New leads" },
  { value: "callback", label: "Callback requested" },
  { value: "not_answered", label: "Didn't answer last time" },
  { value: "not_interested", label: "Previously not interested" },
];

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [statuses, setStatuses] = useState<string[]>(["new"]);
  const [tags, setTags] = useState("");
  const [advanced, setAdvanced] = useState<AdvancedConfig>(DEFAULT_ADVANCED_CONFIG);

  function toggleStatus(value: string) {
    setStatuses((s) => (s.includes(value) ? s.filter((x) => x !== value) : [...s, value]));
  }

  async function save(launch: boolean) {
    setBusy(true);
    setError("");

    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        leadFilter: {
          statuses,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        },
        maxConcurrency: advanced.maxConcurrency,
        retryConfig: advanced.retry.enabled
          ? {
              enabled: true,
              maxRetries: advanced.retry.maxRetries,
              retryDelaySeconds: advanced.retry.retryDelaySeconds,
              retryOnNoAnswer: advanced.retry.retryOnNoAnswer,
              retryOnBusy: advanced.retry.retryOnBusy,
              retryOnVoicemail: advanced.retry.retryOnVoicemail,
            }
          : { enabled: false, maxRetries: 0 },
        scheduleConfig: advanced.schedule.enabled
          ? {
              enabled: true,
              timezone: advanced.schedule.timezone,
              slots: advanced.schedule.slots,
            }
          : null,
        circuitBreaker: advanced.circuitBreaker.enabled
          ? {
              enabled: true,
              failureThreshold: advanced.circuitBreaker.failureThreshold / 100,
              windowSeconds: advanced.circuitBreaker.windowSeconds,
              minCallsInWindow: advanced.circuitBreaker.minCallsInWindow,
            }
          : null,
      }),
    });

    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Could not save campaign");
      setBusy(false);
      return;
    }

    if (launch) {
      const launchRes = await fetch(`/api/campaigns/${body.id}/launch`, { method: "POST" });
      const launchBody = await launchRes.json();
      if (!launchRes.ok) {
        setError(`Saved as draft — ${launchBody.error}`);
        setBusy(false);
        setTimeout(() => router.push(`/campaigns/${body.id}`), 2500);
        return;
      }
    }

    router.push(`/campaigns/${body.id}`);
  }

  return (
    <div className="p-6 space-y-6 max-w-xl">
      <Breadcrumbs items={[{ label: "Campaigns", href: "/campaigns" }, { label: "New Campaign" }]} />
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold">New campaign</h1>
          <p className="text-sm text-muted-foreground">
            Step {step} of 3 — {step === 1 ? "Who to call" : step === 2 ? "Campaign settings" : "Review & launch"}
          </p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
      )}

      {/* ── Step 1: Audience ── */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Who should we call?</CardTitle>
            <CardDescription>Do-Not-Call leads are always excluded automatically.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Lead status</Label>
              <div className="space-y-2">
                {AUDIENCE_STATUSES.map((s) => (
                  <label key={s.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={statuses.includes(s.value)}
                      onChange={() => toggleStatus(s.value)}
                      className="rounded"
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tags (optional, comma-separated)</Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="mumbai, hot" />
              <p className="text-xs text-muted-foreground">Leads matching any of these tags</p>
            </div>
            <Button className="w-full" disabled={statuses.length === 0} onClick={() => setStep(2)}>
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Settings ── */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campaign settings</CardTitle>
            <CardDescription>Configure your campaign name and calling behavior.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Campaign name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="June follow-ups" autoFocus />
            </div>

            <CampaignAdvancedSettings value={advanced} onChange={setAdvanced} />

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-1" disabled={!name.trim()} onClick={() => setStep(3)}>Continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Review & Launch ── */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review & launch</CardTitle>
            <CardDescription>Check your campaign before going live.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Audience</span>
                <span>{statuses.join(", ")}{tags.trim() ? ` · tags: ${tags.trim()}` : ""}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Concurrent calls</span>
                <span>{advanced.maxConcurrency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Retries</span>
                <span>
                  {advanced.retry.enabled
                    ? `${advanced.retry.maxRetries}× (${[
                        advanced.retry.retryOnNoAnswer && "no answer",
                        advanced.retry.retryOnBusy && "busy",
                        advanced.retry.retryOnVoicemail && "voicemail",
                      ]
                        .filter(Boolean)
                        .join(", ")})`
                    : "Disabled"}
                </span>
              </div>
              {advanced.schedule.enabled && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Schedule</span>
                  <span>
                    {advanced.schedule.slots.length} day{advanced.schedule.slots.length !== 1 ? "s" : ""} · {advanced.schedule.timezone}
                  </span>
                </div>
              )}
              {advanced.circuitBreaker.enabled && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Auto-pause</span>
                  <span>at {advanced.circuitBreaker.failureThreshold}% failure rate</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" disabled={busy} onClick={() => setStep(2)}>Back</Button>
              <Button variant="outline" className="flex-1" disabled={busy} onClick={() => save(false)}>
                {busy ? "Saving…" : "Save draft"}
              </Button>
              <Button className="flex-1" disabled={busy} onClick={() => save(true)}>
                {busy ? "Launching…" : "Launch now"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
