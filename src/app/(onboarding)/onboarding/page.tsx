"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const STORAGE_KEY = "tevrix-onboarding-form";

interface OnboardingForm {
  companyName: string;
  industry: string;
  website: string;
  dltEntityId: string;
  callingWindowStart: string;
  callingWindowEnd: string;
}

const defaultForm: OnboardingForm = {
  companyName: "",
  industry: "",
  website: "",
  dltEntityId: "",
  callingWindowStart: "10:00",
  callingWindowEnd: "19:00",
};

function loadSavedForm(): OnboardingForm {
  if (typeof window === "undefined") return defaultForm;
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    return saved ? { ...defaultForm, ...JSON.parse(saved) } : defaultForm;
  } catch {
    return defaultForm;
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(loadSavedForm);

  function update(field: keyof typeof form, value: string) {
    setForm((f) => {
      const next = { ...f, [field]: value };
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  async function submit() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
      router.push("/pending");
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Set up your account</h1>
          <p className="text-muted-foreground text-sm mt-1">Step {step} of 2</p>
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md text-center">{error}</p>
        )}

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Company details</CardTitle>
              <CardDescription>Tell us about your business</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Company name *</Label>
                <Input
                  placeholder="Acme Corp"
                  value={form.companyName}
                  onChange={(e) => update("companyName", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Industry</Label>
                <Input
                  placeholder="e.g. Real estate, Insurance, EdTech"
                  value={form.industry}
                  onChange={(e) => update("industry", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input
                  placeholder="https://yourcompany.com"
                  value={form.website}
                  onChange={(e) => update("website", e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                disabled={!form.companyName}
                onClick={() => setStep(2)}
              >
                Continue
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Compliance & calling hours</CardTitle>
              <CardDescription>Required for outbound calls in India</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>DLT Entity ID</Label>
                <Input
                  placeholder="Your TRAI DLT entity registration ID"
                  value={form.dltEntityId}
                  onChange={(e) => update("dltEntityId", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Required for commercial voice calls in India. You can add this later.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Calling from</Label>
                  <Input
                    type="time"
                    value={form.callingWindowStart}
                    onChange={(e) => update("callingWindowStart", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Calling until</Label>
                  <Input
                    type="time"
                    value={form.callingWindowEnd}
                    onChange={(e) => update("callingWindowEnd", e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Default: 10:00 AM – 7:00 PM IST (NDNC guidelines)
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  Back
                </Button>
                <Button onClick={submit} disabled={loading} className="flex-1">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? "Submitting..." : "Submit for review"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
