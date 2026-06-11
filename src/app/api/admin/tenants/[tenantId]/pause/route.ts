import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireStaff } from "@/lib/auth/require-staff";
import { getTenantById } from "@/lib/db/tenant-repo";
import { canTransition } from "@/lib/db/tenant-status";
import { writeAudit } from "@/lib/db/audit";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { error, session } = await requireStaff();
  if (error) return error;

  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canTransition(tenant.status, "paused")) {
    return NextResponse.json(
      { error: `Cannot pause from status ${tenant.status}` },
      { status: 409 }
    );
  }

  await db
    .update(tenants)
    .set({ status: "paused", updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));

  await writeAudit({
    tenantId,
    actorId: session!.user.id,
    action: "tenant.paused",
    resourceType: "tenant",
    resourceId: tenantId,
    before: { status: tenant.status },
    after: { status: "paused" },
  });

  return NextResponse.json({ ok: true, status: "paused" });
}
