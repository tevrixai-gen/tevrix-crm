"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Phone, Mail, Calendar, Tag, Ban, Save, Pencil, X,
} from "lucide-react";
import { formatPhoneDisplay } from "@/lib/phone";
import Breadcrumbs from "@/components/layout/Breadcrumbs";

interface Lead {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  status: string;
  isDnc: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface CallRow {
  id: string;
  phone: string;
  outcome: string | null;
  durationSeconds: number | null;
  summary: string | null;
  createdAt: string;
}

function fmtDuration(s: number | null): string {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export default function LeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const [lead, setLead] = useState<Lead | null>(null);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", tags: "" });

  const load = useCallback(async () => {
    const res = await fetch(`/api/leads/${leadId}`);
    if (res.status === 404) { setNotFound(true); setLoading(false); return; }
    if (res.ok) {
      const data = await res.json();
      setLead(data.lead);
      setCalls(data.calls);
      setForm({
        name: data.lead.name ?? "",
        email: data.lead.email ?? "",
        tags: (data.lead.tags ?? []).join(", "),
      });
    }
    setLoading(false);
  }, [leadId]);

  useEffect(() => { load(); }, [load]);

  async function saveEdit() {
    setSaving(true);
    const res = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim() || null,
        email: form.email.trim() || null,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      }),
    });
    if (res.ok) {
      toast.success("Lead updated");
      setEditing(false);
      load();
    } else {
      toast.error("Failed to update");
    }
    setSaving(false);
  }

  async function toggleDnc() {
    const res = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDnc: !lead!.isDnc }),
    });
    if (res.ok) {
      toast.success(lead!.isDnc ? "Removed from DNC" : "Marked as Do-Not-Call");
      load();
    } else {
      toast.error("Failed to update");
    }
  }

  if (notFound) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Lead not found.</p>
        <Link href="/leads"><Button variant="outline" size="sm" className="mt-3">Back to leads</Button></Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-3xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!lead) return null;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <Breadcrumbs items={[{ label: "Leads", href: "/leads" }, { label: lead.name || formatPhoneDisplay(lead.phone) }]} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-3">
              {lead.name || formatPhoneDisplay(lead.phone)}
              <StatusBadge status={lead.status} />
              {lead.isDnc && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800">DNC</span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Added {new Date(lead.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={toggleDnc}>
            <Ban className="h-3.5 w-3.5 mr-1.5" />
            {lead.isDnc ? "Remove DNC" : "Mark DNC"}
          </Button>
        </div>
      </div>

      {/* Lead info card */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Contact Information</CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Tags (comma-separated)</Label>
                <Input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="vip, follow-up" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={saving} onClick={saveEdit}>
                  <Save className="h-3.5 w-3.5 mr-1.5" /> {saving ? "Saving…" : "Save"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  <X className="h-3.5 w-3.5 mr-1.5" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-[120px_1fr] gap-y-3 text-sm">
              <dt className="text-muted-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Phone</dt>
              <dd className="font-mono">{formatPhoneDisplay(lead.phone)}</dd>
              <dt className="text-muted-foreground flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</dt>
              <dd>{lead.email ?? "—"}</dd>
              <dt className="text-muted-foreground flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" /> Tags</dt>
              <dd>
                {(lead.tags?.length ?? 0) > 0
                  ? lead.tags.map((t) => (
                      <span key={t} className="inline-block bg-muted px-2 py-0.5 rounded text-xs mr-1">{t}</span>
                    ))
                  : "—"}
              </dd>
              <dt className="text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Updated</dt>
              <dd>{new Date(lead.updatedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" })}</dd>
            </dl>
          )}
        </CardContent>
      </Card>

      {/* Call history */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Call History ({calls.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {calls.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No calls with this lead yet.</p>
          ) : (
            <div className="space-y-3">
              {calls.map((c) => (
                <Link
                  key={c.id}
                  href={`/calls/${c.id}`}
                  className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={c.outcome ?? "running"} />
                      <span className="text-xs text-muted-foreground">{fmtDuration(c.durationSeconds)}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(c.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                    {c.summary && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.summary}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
