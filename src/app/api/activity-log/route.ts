import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLog, user } from "@/lib/db/schema";
import { requireTenantApi } from "@/lib/auth/require-tenant";

export async function GET(req: NextRequest) {
  const { error, tenant } = await requireTenantApi();
  if (error) return error;

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 50), 200);
  const offset = Number(req.nextUrl.searchParams.get("offset") ?? 0);

  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      resourceType: auditLog.resourceType,
      resourceId: auditLog.resourceId,
      before: auditLog.before,
      after: auditLog.after,
      createdAt: auditLog.createdAt,
      actorName: user.name,
      actorEmail: user.email,
    })
    .from(auditLog)
    .leftJoin(user, eq(auditLog.actorId, user.id))
    .where(eq(auditLog.tenantId, tenant!.id))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ entries: rows });
}
