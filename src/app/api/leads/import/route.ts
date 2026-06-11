import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, importBatches } from "@/lib/db/schema";
import { requireTenantApi } from "@/lib/auth/require-tenant";
import { parseCsv } from "@/lib/csv";
import { normalizePhone } from "@/lib/phone";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const INSERT_CHUNK = 500;

interface RowError {
  row: number; // 1-based data row number (excluding header)
  phone: string;
  error: string;
}

// POST /api/leads/import — multipart file + mapping JSON → batch insert with
// per-row error report. Duplicates (within file or vs existing leads) are
// skipped and reported, never silently dropped.
export async function POST(req: NextRequest) {
  const { error, tenant } = await requireTenantApi({ allowPaused: false });
  if (error) return error;

  const formData = await req.formData();
  const file = formData.get("file");
  const mappingRaw = formData.get("mapping");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 413 });
  }

  let mapping: { phone: number; name?: number | null; email?: number | null };
  try {
    mapping = JSON.parse(String(mappingRaw));
  } catch {
    return NextResponse.json({ error: "mapping must be valid JSON" }, { status: 400 });
  }
  if (typeof mapping.phone !== "number") {
    return NextResponse.json({ error: "mapping.phone column index is required" }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return NextResponse.json({ error: "No data rows found" }, { status: 400 });
  }

  const dataRows = rows.slice(1);
  const errors: RowError[] = [];
  const seenPhones = new Set<string>();
  const toInsert: Array<{ phone: string; name: string | null; email: string | null }> = [];

  dataRows.forEach((cols, idx) => {
    const rawPhone = cols[mapping.phone] ?? "";
    const normalized = normalizePhone(rawPhone);

    if (!normalized.ok) {
      errors.push({ row: idx + 1, phone: rawPhone, error: normalized.error! });
      return;
    }
    if (seenPhones.has(normalized.e164!)) {
      errors.push({ row: idx + 1, phone: rawPhone, error: "Duplicate within file" });
      return;
    }
    seenPhones.add(normalized.e164!);

    toInsert.push({
      phone: normalized.e164!,
      name: mapping.name != null ? (cols[mapping.name]?.trim() || null) : null,
      email: mapping.email != null ? (cols[mapping.email]?.trim() || null) : null,
    });
  });

  // Create the batch record up front so failures are observable
  const [batch] = await db
    .insert(importBatches)
    .values({
      tenantId: tenant!.id,
      fileName: file.name,
      gcsPath: "inline", // local MVP: file parsed in-request; GCS path comes with cloud deploy
      totalRows: dataRows.length,
      status: "processing",
    })
    .returning({ id: importBatches.id });

  let imported = 0;
  let skippedExisting = 0;

  try {
    for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
      const chunk = toInsert.slice(i, i + INSERT_CHUNK);
      const inserted = await db
        .insert(leads)
        .values(
          chunk.map((l) => ({
            tenantId: tenant!.id,
            phone: l.phone,
            name: l.name,
            email: l.email,
            importBatchId: batch.id,
          }))
        )
        .onConflictDoNothing({ target: [leads.tenantId, leads.phone] })
        .returning({ id: leads.id });

      imported += inserted.length;
      skippedExisting += chunk.length - inserted.length;
    }

    await db
      .update(importBatches)
      .set({
        importedRows: imported,
        skippedRows: skippedExisting,
        errorRows: errors.length,
        errorReport: errors.length > 0 ? errors : null,
        status: "completed",
        completedAt: new Date(),
      })
      .where(eq(importBatches.id, batch.id));
  } catch (err) {
    await db
      .update(importBatches)
      .set({
        status: "failed",
        errorReport: [{ row: 0, phone: "", error: err instanceof Error ? err.message : "Import failed" }],
        completedAt: new Date(),
      })
      .where(eq(importBatches.id, batch.id));
    throw err;
  }

  return NextResponse.json({
    batchId: batch.id,
    totalRows: dataRows.length,
    imported,
    skippedExisting,
    errors,
  });
}
