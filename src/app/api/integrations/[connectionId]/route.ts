import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { crmConnections } from "@/lib/db/schema";
import { requireTenantApi } from "@/lib/auth/require-tenant";
import { writeAudit } from "@/lib/db/audit";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const { error, tenant, userId } = await requireTenantApi({ allowPaused: false });
  if (error) return error;

  const { connectionId } = await params;

  const [row] = await db
    .select({ id: crmConnections.id, kind: crmConnections.kind })
    .from(crmConnections)
    .where(and(eq(crmConnections.id, connectionId), eq(crmConnections.tenantId, tenant!.id)))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(crmConnections).where(eq(crmConnections.id, connectionId));

  await writeAudit({
    tenantId: tenant!.id,
    actorId: userId!,
    action: "integration.delete",
    resourceType: "crm_connection",
    resourceId: connectionId,
    before: { kind: row.kind },
  });

  return NextResponse.json({ ok: true });
}
