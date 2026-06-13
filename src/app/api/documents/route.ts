import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { requireTenantApi } from "@/lib/auth/require-tenant";
import { createDograhClient } from "@/lib/dograh/client";

const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export async function GET() {
  const { error, tenant } = await requireTenantApi();
  if (error) return error;

  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.tenantId, tenant!.id))
    .orderBy(desc(documents.createdAt));

  return NextResponse.json({ documents: rows });
}

// POST — upload a document and forward it to the engine's knowledge base
// using the tenant's own API key. Engine failure is recorded on the row
// (status=failed) so the client sees an honest, retryable state.
export async function POST(req: NextRequest) {
  const { error, tenant, userId } = await requireTenantApi({ allowPaused: false });
  if (error) return error;

  if (!tenant!.dograhApiKeyCiphertext) {
    return NextResponse.json(
      { error: "Your agent isn't connected to the voice engine yet. Contact support." },
      { status: 409 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (file.size > MAX_DOC_BYTES) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 413 });
  }
  if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(pdf|txt|csv|docx|md)$/i)) {
    return NextResponse.json(
      { error: "Supported formats: PDF, TXT, CSV, DOCX, MD" },
      { status: 415 }
    );
  }

  const [doc] = await db
    .insert(documents)
    .values({
      tenantId: tenant!.id,
      fileName: file.name,
      gcsPath: "inline", // GCS path arrives with the cloud deploy
      status: "processing",
      uploadedBy: userId,
    })
    .returning({ id: documents.id });

  // Forward to the engine
  try {
    const client = createDograhClient(
      process.env.DOGRAH_API_BASE_URL ?? "http://localhost:8000",
      tenant!.dograhApiKeyCiphertext
    );
    const result = await client.uploadDocument(file);

    await db
      .update(documents)
      .set({
        dograhDocRef: result.document_uuid,
        // Dograh processes async (pending → processing → completed); treat
        // anything not yet failed as still processing on our side.
        status: result.status === "completed" ? "ready" : "processing",
        updatedAt: new Date(),
      })
      .where(eq(documents.id, doc.id));
  } catch (err) {
    await db
      .update(documents)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(documents.id, doc.id));

    const msg = err instanceof Error ? err.message : "Engine upload failed";
    return NextResponse.json(
      { error: `Document saved but knowledge ingestion failed (${msg}). Retry from the Knowledge page.`, id: doc.id },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, id: doc.id }, { status: 201 });
}
