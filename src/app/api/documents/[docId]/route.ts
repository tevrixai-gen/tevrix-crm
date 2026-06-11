import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { requireTenantApi } from "@/lib/auth/require-tenant";
import { createDograhClient } from "@/lib/dograh/client";

// DELETE — removes the document from the engine KB first, then locally.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  const { error, tenant } = await requireTenantApi({ allowPaused: false });
  if (error) return error;

  const { docId } = await params;
  const rows = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, docId), eq(documents.tenantId, tenant!.id)))
    .limit(1);

  const doc = rows[0];
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (doc.dograhDocRef && tenant!.dograhApiKeyCiphertext) {
    try {
      const client = createDograhClient(
        process.env.DOGRAH_API_BASE_URL ?? "http://localhost:8000",
        tenant!.dograhApiKeyCiphertext
      );
      await client.deleteDocument(Number(doc.dograhDocRef));
    } catch {
      // Engine cleanup is best-effort; the local delete proceeds so the
      // client's list stays accurate. Orphans are reconciled later.
    }
  }

  await db
    .delete(documents)
    .where(and(eq(documents.id, docId), eq(documents.tenantId, tenant!.id)));

  return NextResponse.json({ ok: true });
}
