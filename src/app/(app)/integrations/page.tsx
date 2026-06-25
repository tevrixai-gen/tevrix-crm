"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Plug, Webhook, Trash2, TestTube, Loader2, Plus, X,
} from "lucide-react";

interface Connection {
  id: string;
  kind: string;
  displayName: string;
  triggerRule: string;
  status: string;
  lastSyncAt: string | null;
  lastError: string | null;
}

const KIND_META: Record<string, { label: string; description: string; icon: string; oauth?: boolean }> = {
  webhook: {
    label: "Webhook",
    description: "Push qualified leads to any URL as JSON",
    icon: "🔗",
  },
  hubspot: {
    label: "HubSpot",
    description: "Create contacts in HubSpot CRM",
    icon: "🟠",
    oauth: true,
  },
  zoho: {
    label: "Zoho CRM",
    description: "Push leads to Zoho CRM",
    icon: "🔴",
    oauth: true,
  },
  salesforce: {
    label: "Salesforce",
    description: "Push leads to Salesforce CRM",
    icon: "☁️",
    oauth: true,
  },
  sheets: {
    label: "Google Sheets",
    description: "Append rows to a Google Sheet",
    icon: "📊",
  },
};

export default function IntegrationsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Add form state
  const [newKind, setNewKind] = useState("webhook");
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newSecret, setNewSecret] = useState("");
  const [newTrigger, setNewTrigger] = useState("on_qualified");
  const [saving, setSaving] = useState(false);

  const searchParams = useSearchParams();

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected) toast.success("CRM connected successfully");
    if (error) toast.error(`Connection failed: ${error}`);
    if (connected || error) {
      window.history.replaceState({}, "", "/integrations");
    }
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/integrations");
    if (res.ok) {
      const data = await res.json();
      setConnections(data.connections);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    const isOAuth = KIND_META[newKind]?.oauth;
    if (newKind === "webhook" && !newUrl.trim()) {
      toast.error("Webhook URL is required");
      return;
    }
    setSaving(true);

    const config: Record<string, string> = {};
    if (newKind === "webhook") {
      config.url = newUrl.trim();
      if (newSecret.trim()) config.secret = newSecret.trim();
    }

    const res = await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: newKind,
        displayName: newName.trim() || KIND_META[newKind]?.label || newKind,
        triggerRule: newTrigger,
        config: Object.keys(config).length > 0 ? config : undefined,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (isOAuth && data.authorizeUrl) {
        window.location.href = data.authorizeUrl;
        return;
      }
      toast.success("Integration added");
      setShowAdd(false);
      setNewUrl("");
      setNewSecret("");
      setNewName("");
      await load();
    } else {
      const err = await res.json().catch(() => null);
      toast.error(err?.error ?? "Failed to add integration");
    }
    setSaving(false);
  }

  async function handleTest(id: string) {
    setTesting(id);
    const res = await fetch(`/api/integrations/${id}/test`, { method: "POST" });
    const data = await res.json();
    if (data.result?.ok) {
      toast.success("Test push succeeded");
    } else {
      toast.error(`Test failed: ${data.result?.error ?? "Unknown error"}`);
    }
    await load();
    setTesting(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this integration? Pending syncs will stop.")) return;
    setDeleting(id);
    const res = await fetch(`/api/integrations/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Integration removed");
      await load();
    } else {
      toast.error("Failed to remove");
    }
    setDeleting(null);
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Integrations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Push qualified leads to your CRM or webhook
          </p>
        </div>
        {!showAdd && (
          <Button onClick={() => setShowAdd(true)} className="gap-1">
            <Plus className="h-4 w-4" /> Add Integration
          </Button>
        )}
      </div>

      {showAdd && (
        <Card className="shadow-sm border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">New Integration</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={newKind}
                onChange={(e) => setNewKind(e.target.value)}
              >
                {Object.entries(KIND_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Display name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={KIND_META[newKind]?.label ?? newKind}
              />
            </div>

            {newKind === "webhook" && (
              <>
                <div className="space-y-2">
                  <Label>Webhook URL</Label>
                  <Input
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://your-service.com/webhook"
                  />
                </div>
                <div className="space-y-2">
                  <Label>HMAC Secret (optional)</Label>
                  <Input
                    value={newSecret}
                    onChange={(e) => setNewSecret(e.target.value)}
                    placeholder="Shared secret for signature verification"
                  />
                </div>
              </>
            )}

            {KIND_META[newKind]?.oauth && (
              <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 p-3 text-sm text-blue-800 dark:text-blue-300">
                Clicking &quot;Connect&quot; will redirect you to {KIND_META[newKind].label} to authorize access.
                Your tokens are stored encrypted and never shared.
              </div>
            )}

            {newKind === "sheets" && (
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-300">
                Google Sheets integration coming soon. Use webhook for now.
              </div>
            )}

            <div className="space-y-2">
              <Label>Trigger</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={newTrigger}
                onChange={(e) => setNewTrigger(e.target.value)}
              >
                <option value="on_qualified">When lead is qualified</option>
                <option value="on_any_completed">On any completed call</option>
                <option value="on_keyword">On keyword trigger</option>
              </select>
            </div>

            <Button onClick={handleAdd} disabled={saving || newKind === "sheets"}>
              {saving ? (KIND_META[newKind]?.oauth ? "Redirecting…" : "Adding…") : (KIND_META[newKind]?.oauth ? `Connect ${KIND_META[newKind].label}` : "Add Integration")}
            </Button>
          </CardContent>
        </Card>
      )}

      {loading && connections.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      )}

      {!loading && connections.length === 0 && !showAdd && (
        <Card className="shadow-sm">
          <CardContent className="py-12 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Plug className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No integrations yet</p>
              <p className="text-sm text-muted-foreground">
                Connect a webhook or CRM to automatically push qualified leads.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {connections.map((conn) => (
        <Card key={conn.id} className="shadow-sm">
          <CardContent className="py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-lg">
                  {KIND_META[conn.kind]?.icon ?? "🔌"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{conn.displayName}</p>
                    <Badge variant={conn.status === "active" ? "default" : conn.status === "error" ? "destructive" : "secondary"}>
                      {conn.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {KIND_META[conn.kind]?.label ?? conn.kind} · Trigger: {conn.triggerRule.replace(/_/g, " ")}
                    {conn.lastSyncAt && ` · Last sync: ${new Date(conn.lastSyncAt).toLocaleString("en-IN")}`}
                  </p>
                  {conn.lastError && (
                    <p className="text-xs text-red-500 mt-1">{conn.lastError}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={testing === conn.id}
                  onClick={() => handleTest(conn.id)}
                >
                  {testing === conn.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TestTube className="h-3.5 w-3.5" />}
                  Test
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-destructive"
                  disabled={deleting === conn.id}
                  onClick={() => handleDelete(conn.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
