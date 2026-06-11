import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/require-staff";
import { getTenantById } from "@/lib/db/tenant-repo";
import { db } from "@/lib/db";
import { organization, member, user } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { error } = await requireStaff();
  if (error) return error;

  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orgRow = await db
    .select({ org: organization })
    .from(organization)
    .where(eq(organization.id, tenant.organizationId))
    .limit(1);

  const members = await db
    .select({ member, user })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, tenant.organizationId));

  return NextResponse.json({
    tenant,
    organization: orgRow[0]?.org ?? null,
    members: members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.member.role,
    })),
  });
}
