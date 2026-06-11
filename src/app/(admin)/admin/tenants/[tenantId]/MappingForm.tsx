"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  tenantId: string;
  current: {
    dograhOrgId: string;
    dograhWorkflowId: string;
    hasDograhApiKey: boolean;
    hasDograhWebhookSecret: boolean;
  };
}

export default function MappingForm({ tenantId, current }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    dograhOrgId: current.dograhOrgId,
    dograhApiKey: "",
    dograhWebhookSecret: "",
    dograhWorkflowId: current.dograhWorkflowId,
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");

    const res = await fetch(`/api/admin/tenants/${tenantId}/map`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      setMsg("Mapping saved");
      setForm((f) => ({ ...f, dograhApiKey: "", dograhWebhookSecret: "" }));
      router.refresh();
    } else {
      const body = await res.json().catch(() => null);
      setMsg(body?.error ?? "Failed");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Dograh Org ID *</Label>
          <Input
            value={form.dograhOrgId}
            onChange={(e) => update("dograhOrgId", e.target.value)}
            placeholder="org_xxxxx"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Dograh Workflow ID</Label>
          <Input
            value={form.dograhWorkflowId}
            onChange={(e) => update("dograhWorkflowId", e.target.value)}
            placeholder="wf_xxxxx"
          />
        </div>
        <div className="space-y-2">
          <Label>
            Dograh API Key *
            {current.hasDograhApiKey && (
              <span className="text-xs text-muted-foreground ml-2">(already set — leave blank to keep)</span>
            )}
          </Label>
          <Input
            value={form.dograhApiKey}
            onChange={(e) => update("dograhApiKey", e.target.value)}
            placeholder={current.hasDograhApiKey ? "••••••••" : "sk_live_xxxxx"}
            type="password"
            required={!current.hasDograhApiKey}
          />
        </div>
        <div className="space-y-2">
          <Label>
            Webhook Secret
            {current.hasDograhWebhookSecret && (
              <span className="text-xs text-muted-foreground ml-2">(already set)</span>
            )}
          </Label>
          <Input
            value={form.dograhWebhookSecret}
            onChange={(e) => update("dograhWebhookSecret", e.target.value)}
            placeholder="whsec_xxxxx"
            type="password"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "Saving..." : "Save Mapping"}
        </Button>
        {msg && (
          <span className={`text-sm ${msg === "Mapping saved" ? "text-green-600" : "text-destructive"}`}>
            {msg}
          </span>
        )}
      </div>
    </form>
  );
}
