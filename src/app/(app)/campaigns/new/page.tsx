"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

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
  const [maxConcurrency, setMaxConcurrency] = useState(5);
  const [maxAttempts, setMaxAttempts] = useState(2);
  const [windowStart, setWindowStart] = useState("10:00");
  const [windowEnd, setWindowEnd] = useState("19:00");

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
        schedule: { windowStart, windowEnd },
        maxConcurrency,
        retryConfig: { maxAttempts, retryOnNoAnswer: true },
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
        // Saved as draft; surface why launch was blocked
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
      <div className="flex items-center gap-3">
        <Link href="/campaigns">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">New campaign</h1>
          <p className="text-sm text-muted-foreground">Step {step} of 3 — {step === 1 ? "Who to call" : step === 2 ? "What to run" : "When to call"}</p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
      )}

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

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campaign settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Campaign name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="June follow-ups" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Calls at once</Label>
                <Input
                  type="number" min={1} max={50}
                  value={maxConcurrency}
                  onChange={(e) => setMaxConcurrency(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Retries on no answer</Label>
                <Input
                  type="number" min={0} max={5}
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-1" disabled={!name.trim()} onClick={() => setStep(3)}>Continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Calling window</CardTitle>
            <CardDescription>
              Calls only go out inside this window (your timezone). NDNC guideline: 10 AM – 7 PM.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>From</Label>
                <Input type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Until</Label>
                <Input type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} />
              </div>
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
