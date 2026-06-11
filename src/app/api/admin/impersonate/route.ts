import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/require-staff";
import { db } from "@/lib/db";
import { member } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantById } from "@/lib/db/tenant-repo";
import { writeAudit } from "@/lib/db/audit";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const { error, session } = await requireStaff();
  if (error) return error;

  const { tenantId } = await req.json();
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  const tenant = await getTenantById(tenantId);
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  // Find the owner member of this tenant's org
  const ownerRow = await db
    .select()
    .from(member)
    .where(eq(member.organizationId, tenant.organizationId))
    .limit(1);

  if (!ownerRow[0]) {
    return NextResponse.json({ error: "No member found for tenant" }, { status: 404 });
  }

  // Store impersonation context in a cookie
  const cookieStore = await cookies();
  cookieStore.set("impersonation", JSON.stringify({
    staffUserId: session!.user.id,
    tenantId,
    tenantName: tenant.companyName,
    startedAt: new Date().toISOString(),
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // 1 hour max
  });

  await writeAudit({
    tenantId,
    actorId: session!.user.id,
    action: "tenant.impersonation_started",
    resourceType: "tenant",
    resourceId: tenantId,
  });

  return NextResponse.json({ ok: true, redirectTo: "/dashboard" });
}

export async function DELETE() {
  const cookieStore = await cookies();
  const impersonation = cookieStore.get("impersonation");

  if (impersonation) {
    const data = JSON.parse(impersonation.value);
    await writeAudit({
      tenantId: data.tenantId,
      actorId: data.staffUserId,
      action: "tenant.impersonation_ended",
      resourceType: "tenant",
      resourceId: data.tenantId,
    });
  }

  cookieStore.delete("impersonation");
  return NextResponse.json({ ok: true, redirectTo: "/admin" });
}
