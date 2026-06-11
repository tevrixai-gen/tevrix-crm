"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Upload, ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";

type Step = "upload" | "map" | "done";

interface Preview {
  headers: string[];
  suggestedMapping: Record<string, number | null>;
  previewRows: string[][];
  totalRows: number;
}

interface ImportReport {
  totalRows: number;
  imported: number;
  skippedExisting: number;
  errors: Array<{ row: number; phone: string; error: string }>;
}

export default function ImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<{ phone: number | null; name: number | null; email: number | null }>({
    phone: null, name: null, email: null,
  });
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(f: File) {
    setBusy(true);
    setError("");
    const fd = new FormData();
    fd.append("file", f);
    const res = await fetch("/api/leads/import/preview", { method: "POST", body: fd });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Could not read file");
      setBusy(false);
      return;
    }
    setFile(f);
    setPreview(body);
    setMapping({
      phone: body.suggestedMapping.phone,
      name: body.suggestedMapping.name,
      email: body.suggestedMapping.email,
    });
    setStep("map");
    setBusy(false);
  }

  async function runImport() {
    if (!file || mapping.phone === null) return;
    setBusy(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("mapping", JSON.stringify(mapping));
    const res = await fetch("/api/leads/import", { method: "POST", body: fd });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Import failed");
      setBusy(false);
      return;
    }
    setReport(body);
    setStep("done");
    setBusy(false);
  }

  function downloadErrorReport() {
    if (!report) return;
    const lines = ["row,phone,error", ...report.errors.map((e) => `${e.row},"${e.phone}","${e.error}"`)];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "import-errors.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const columnSelect = (field: "phone" | "name" | "email", label: string, required = false) => (
    <div className="space-y-2">
      <Label>{label}{required && " *"}</Label>
      <select
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        value={mapping[field] ?? ""}
        onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value === "" ? null : Number(e.target.value) }))}
      >
        <option value="">— not in file —</option>
        {preview?.headers.map((h, i) => (
          <option key={i} value={i}>{h}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/leads">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-semibold">Import leads</h1>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
      )}

      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload a CSV file</CardTitle>
            <CardDescription>
              First row must be column headers. Max 5 MB. Duplicate phone numbers are skipped and reported.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label className="border-2 border-dashed rounded-lg p-12 flex flex-col items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {busy ? "Reading file…" : "Click to choose a .csv file"}
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                disabled={busy}
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </label>
          </CardContent>
        </Card>
      )}

      {step === "map" && preview && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Map columns</CardTitle>
              <CardDescription>
                {file?.name} — {preview.totalRows} rows. Tell us which column holds which field.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {columnSelect("phone", "Phone", true)}
              {columnSelect("name", "Name")}
              {columnSelect("email", "Email")}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preview (first {Math.min(20, preview.previewRows.length)} rows)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    {preview.headers.map((h, i) => (
                      <th key={i} className={`text-left px-2 py-1.5 font-medium whitespace-nowrap ${
                        i === mapping.phone ? "text-primary" : ""
                      }`}>
                        {h}{i === mapping.phone && " (phone)"}{i === mapping.name && " (name)"}{i === mapping.email && " (email)"}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.previewRows.map((row, ri) => (
                    <tr key={ri}>
                      {preview.headers.map((_, ci) => (
                        <td key={ci} className="px-2 py-1.5 whitespace-nowrap">{row[ci] ?? ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setStep("upload"); setFile(null); setPreview(null); }}>
              Back
            </Button>
            <Button onClick={runImport} disabled={busy || mapping.phone === null}>
              {busy ? "Importing…" : `Import ${preview.totalRows} rows`}
            </Button>
            {mapping.phone === null && (
              <span className="text-sm text-muted-foreground self-center">Select the phone column first</span>
            )}
          </div>
        </>
      )}

      {step === "done" && report && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Import complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-2 text-sm max-w-xs">
              <dt className="text-muted-foreground">Rows in file</dt><dd>{report.totalRows}</dd>
              <dt className="text-muted-foreground">Imported</dt><dd className="text-green-600 font-medium">{report.imported}</dd>
              <dt className="text-muted-foreground">Already existed</dt><dd>{report.skippedExisting}</dd>
              <dt className="text-muted-foreground">Errors</dt><dd className={report.errors.length ? "text-destructive font-medium" : ""}>{report.errors.length}</dd>
            </dl>

            {report.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm flex items-center gap-1 text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" /> First {Math.min(10, report.errors.length)} errors:
                </p>
                <ul className="text-xs space-y-1 font-mono">
                  {report.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>Row {e.row}: {e.phone} — {e.error}</li>
                  ))}
                </ul>
                <Button variant="outline" size="sm" onClick={downloadErrorReport}>
                  Download error report
                </Button>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Link href="/leads"><Button>View leads</Button></Link>
              <Button variant="outline" onClick={() => { setStep("upload"); setFile(null); setPreview(null); setReport(null); }}>
                Import another file
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
