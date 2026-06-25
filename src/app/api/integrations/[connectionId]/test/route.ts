import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { crmConnections } from "@/lib/db/schema";
import { requireTenantApi } from "@/lib/auth/require-tenant";
import { decryptSecret } from "@/lib/crypto/secrets";
import { getAdapter } from "@/lib/crm";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const { error, tenant } = await requireTenantApi({ allowPaused: false });
  if (error) return error;

  const { connectionId } = await params;

  const [row] = await db
    .select()
    .from(crmConnections)
    .where(and(eq(crmConnections.id, connectionId), eq(crmConnections.tenantId, tenant!.id)))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const adapter = getAdapter(row.kind);
  if (!adapter) {
    return NextResponse.json({ error: `Adapter "${row.kind}" not yet supported` }, { status: 400 });
  }

  let config: Record<string, unknown> = {};
  if (row.configCiphertext) {
    try {
      config = JSON.parse(decryptSecret(row.configCiphertext));
    } catch {
      return NextResponse.json({ error: "Failed to decrypt connection config" }, { status: 500 });
    }
  }

  const result = await adapter.testPush(config);

  if (result.ok) {
    await db
      .update(crmConnections)
      .set({ lastSyncAt: new Date(), lastError: null, status: "active", updatedAt: new Date() })
      .where(eq(crmConnections.id, connectionId));
  } else {
    await db
      .update(crmConnections)
      .set({ lastError: result.error ?? "Unknown error", status: "error", updatedAt: new Date() })
      .where(eq(crmConnections.id, connectionId));
  }

  return NextResponse.json({ result });
}
