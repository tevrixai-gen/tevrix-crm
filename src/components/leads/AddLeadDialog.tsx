"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export default function AddLeadDialog({ open, onClose, onAdded }: Props) {
  const [form, setForm] = useState({ phone: "", name: "", email: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      toast.success("Lead added");
      setForm({ phone: "", name: "", email: "" });
      onAdded();
      onClose();
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Failed to add lead");
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add lead</DialogTitle>
          <DialogDescription>Phone number is required (Indian or +country format)</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
          )}
          <div className="space-y-2">
            <Label>Phone *</Label>
            <Input
              placeholder="98765 43210"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              placeholder="Ravi Kumar"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="ravi@example.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Adding…" : "Add lead"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
