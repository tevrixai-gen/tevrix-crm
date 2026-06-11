import { NextRequest, NextResponse } from "next/server";
import { requireTenantApi } from "@/lib/auth/require-tenant";
import { parseCsv, suggestColumnMapping } from "@/lib/csv";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

// POST /api/leads/import/preview — multipart file → headers, suggested
// column mapping, first 20 rows. Nothing is written.
export async function POST(req: NextRequest) {
  const { error } = await requireTenantApi({ allowPaused: false });
  if (error) return error;

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 413 });
  }

  const text = await file.text();
  const rows = parseCsv(text);

  if (rows.length < 2) {
    return NextResponse.json(
      { error: "File must have a header row and at least one data row" },
      { status: 400 }
    );
  }

  const headers = rows[0];
  return NextResponse.json({
    headers,
    suggestedMapping: suggestColumnMapping(headers),
    previewRows: rows.slice(1, 21),
    totalRows: rows.length - 1,
  });
}
