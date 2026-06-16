import { eq } from "drizzle-orm";
import { db } from "./index";
import { tenants, organization, member } from "./schema";

export async function getTenantByUserId(userId: string) {
  const result = await db
    .select({ tenant: tenants })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .innerJoin(tenants, eq(tenants.organizationId, organization.id))
    .where(eq(member.userId, userId))
    .limit(1);

  return result[0]?.tenant ?? null;
}

export async function getTenantById(tenantId: string) {
  const result = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  return result[0] ?? null;
}

export async function updateTenant(
  tenantId: string,
  data: Partial<{
    companyName: string | null;
    companyWebsite: string | null;
    industry: string | null;
    dltEntityId: string | null;
    callingWindowStart: string;
    callingWindowEnd: string;
    timezone: string;
  }>
) {
  const [updated] = await db
    .update(tenants)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId))
    .returning();
  return updated ?? null;
}

export async function getAllTenants() {
  return db.select().from(tenants).orderBy(tenants.createdAt);
}
