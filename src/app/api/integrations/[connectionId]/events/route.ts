import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { crmConnections, crmSyncEvents } from "@/lib/db/schema";
import { requireTenantApi } from "@/lib/auth/require-tenant";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const { error, tenant } = await requireTenantApi();
  if (error) return error;

  const { connectionId } = await params;

  const [conn] = await db
    .select({ id: crmConnections.id })
    .from(crmConnections)
    .where(and(eq(crmConnections.id, connectionId), eq(crmConnections.tenantId, tenant!.id)))
    .limit(1);

  if (!conn) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const events = await db
    .select({
      id: crmSyncEvents.id,
      callId: crmSyncEvents.callId,
      status: crmSyncEvents.status,
      attempts: crmSyncEvents.attempts,
      error: crmSyncEvents.error,
      externalRef: crmSyncEvents.externalRef,
      createdAt: crmSyncEvents.createdAt,
    })
    .from(crmSyncEvents)
    .where(eq(crmSyncEvents.connectionId, connectionId))
    .orderBy(desc(crmSyncEvents.createdAt))
    .limit(50);

  return NextResponse.json({ events });
}
