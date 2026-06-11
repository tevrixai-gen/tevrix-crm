"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2, FileText } from "lucide-react";

interface Doc {
  id: string;
  fileName: string;
  status: "uploading" | "processing" | "ready" | "failed";
  createdAt: string;
}

const STATUS_BADGE: Record<Doc["status"], "default" | "secondary" | "destructive" | "outline"> = {
  ready: "default",
  processing: "secondary",
  uploading: "secondary",
  failed: "destructive",
};

export default function KnowledgeView() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/documents");
    if (res.ok) setDocs((await res.json()).documents);
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    // Poll while anything is processing
    const t = setInterval(() => {
      setDocs((current) => {
        if (current.some((d) => d.status === "processing" || d.status === "uploading")) load();
        return current;
      });
    }, 5_000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [load]);

  async function upload(file: File) {
    setBusy(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/documents", { method: "POST", body: fd });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Upload failed");
    }
    await load();
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function remove(id: string) {
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Knowledge</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Documents your agent can answer questions from
          </p>
        </div>
        <Button size="sm" className="gap-1" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" />
          {busy ? "Uploading…" : "Upload document"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt,.csv,.docx,.md"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
      )}

      {docs.length === 0 ? (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">No documents yet</p>
          <p className="text-sm text-muted-foreground">
            Upload product catalogs, FAQs, or pricing sheets (PDF, TXT, CSV, DOCX) so your
            agent can answer questions about your business.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{d.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(d.createdAt).toLocaleDateString("en-IN")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Badge variant={STATUS_BADGE[d.status]}>
                  {d.status === "processing" ? "processing…" : d.status}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => remove(d.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
