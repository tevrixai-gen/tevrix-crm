"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  initial: {
    agentName: string;
    goal: string;
    language: string;
    voiceId: string;
    isDraft: boolean;
  } | null;
}

const LANGUAGES = [
  { value: "en-IN", label: "English (India)" },
  { value: "hi-IN", label: "Hindi" },
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
];

export default function AgentEditor({ initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    agentName: initial?.agentName ?? "Alex",
    goal: initial?.goal ?? "",
    language: initial?.language ?? "en-IN",
    voiceId: initial?.voiceId ?? "",
  });
  const [saving, setSaving] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function save() {
    setSaving(true);
    const res = await fetch("/api/agent", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      toast.success("Agent saved");
      router.refresh();
    } else {
      toast.error("Failed to save agent");
    }
    setSaving(false);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Agent Configuration</CardTitle>
          {initial && (
            <Badge variant={initial.isDraft ? "secondary" : "default"}>
              {initial.isDraft ? "Draft" : "Published"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Agent&apos;s spoken name</Label>
          <Input
            value={form.agentName}
            onChange={(e) => update("agentName", e.target.value)}
            placeholder="Alex"
          />
          <p className="text-xs text-muted-foreground">
            The name your agent will use when speaking to leads
          </p>
        </div>

        <div className="space-y-2">
          <Label>What should your agent achieve?</Label>
          <Textarea
            value={form.goal}
            onChange={(e) => update("goal", e.target.value)}
            placeholder="e.g. Qualify real estate leads by asking about budget, preferred location, and timeline. If they're interested, schedule a site visit."
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label>Language</Label>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={form.language}
            onChange={(e) => update("language", e.target.value)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>Voice ID</Label>
          <Input
            value={form.voiceId}
            onChange={(e) => update("voiceId", e.target.value)}
            placeholder="Leave blank for default"
          />
          <p className="text-xs text-muted-foreground">
            Optional. Voice preview coming soon.
          </p>
        </div>

        <Button onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Draft"}
        </Button>
      </CardContent>
    </Card>
  );
}
