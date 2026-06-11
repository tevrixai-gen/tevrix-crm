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

  const target = tenant.dograhOrgId ? "ready" as const : "provisioning" as const;
  if (!canTransition(tenant.status, target)) {
    return NextResponse.json(
      { error: `Cannot transition from ${tenant.status} to ${target}` },
      { status: 409 }
    );
  }

  await db
    .update(tenants)
    .set({
      status: target,
      approvedAt: new Date(),
      approvedBy: session!.user.id,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId));

  await writeAudit({
    tenantId,
    actorId: session!.user.id,
    action: "tenant.approved",
    resourceType: "tenant",
    resourceId: tenantId,
    before: { status: tenant.status },
    after: { status: target },
  });

  return NextResponse.json({ ok: true, status: target });
}
