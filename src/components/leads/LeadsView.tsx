"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, Plus, ChevronLeft, ChevronRight, Ban } from "lucide-react";
import AddLeadDialog from "./AddLeadDialog";
import { formatPhoneDisplay } from "@/lib/phone";

interface Lead {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  status: string;
  isDnc: boolean;
  tags: string[];
  createdAt: string;
}

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "new", label: "New" },
  { value: "queued", label: "Queued" },
  { value: "connected", label: "Connected" },
  { value: "qualified", label: "Qualified" },
  { value: "callback", label: "Callback" },
  { value: "not_answered", label: "No Answer" },
  { value: "not_interested", label: "Not Interested" },
  { value: "dnc", label: "DNC" },
];

const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  qualified: "default",
  dnc: "destructive",
  not_interested: "outline",
};

export default function LeadsView() {
  const [rows, setRows] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    const res = await fetch(`/api/leads?${params}`);
    if (res.ok) {
      const data = await res.json();
      setRows(data.leads);
      setTotal(data.total);
      setTotalPages(data.totalPages || 1);
    }
    setLoading(false);
  }, [page, search, status]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0); // debounce typing
    return () => clearTimeout(t);
  }, [load, search]);

  async function toggleDnc(lead: Lead) {
    await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDnc: !lead.isDnc }),
    });
    load();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">{total} total</p>
        </div>
        <div className="flex gap-2">
          <Link href="/leads/import">
            <Button variant="outline" size="sm" className="gap-1">
              <Upload className="h-4 w-4" /> Import CSV
            </Button>
          </Link>
          <Button size="sm" className="gap-1" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Lead
          </Button>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <Input
          placeholder="Search name, phone, email…"
          className="max-w-xs"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Phone</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Added</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  {search || status ? "No leads match your filters." : (
                    <>No leads yet. Import a CSV or add one manually to get started.</>
                  )}
                </td>
              </tr>
            )}
            {rows.map((lead) => (
              <tr key={lead.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{lead.name ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">{formatPhoneDisplay(lead.phone)}</td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_BADGE[lead.status] ?? "secondary"}>
                    {lead.status.replace("_", " ")}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(lead.createdAt).toLocaleDateString("en-IN")}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={lead.isDnc ? "text-destructive" : "text-muted-foreground"}
                    title={lead.isDnc ? "Remove from Do-Not-Call" : "Mark Do-Not-Call"}
                    onClick={() => toggleDnc(lead)}
                  >
                    <Ban className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <AddLeadDialog open={addOpen} onClose={() => setAddOpen(false)} onAdded={load} />
    </div>
  );
}
