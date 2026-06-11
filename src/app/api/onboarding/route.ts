import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tenants, organization, member } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { companyName, industry, website, dltEntityId, callingWindowStart, callingWindowEnd } = body;

  if (!companyName) return NextResponse.json({ error: "companyName required" }, { status: 400 });

  // Find or create the user's organization
  const memberRow = await db
    .select({ org: organization })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, session.user.id))
    .limit(1);

  let orgId: string;

  if (memberRow.length > 0) {
    orgId = memberRow[0].org.id;
  } else {
    // Create org via better-auth API
    const orgResult = await auth.api.createOrganization({
      headers: await headers(),
      body: {
        name: companyName,
        slug: companyName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      },
    });
    orgId = orgResult.id;
  }

  // Upsert tenant
  const existing = await db
    .select()
    .from(tenants)
    .where(eq(tenants.organizationId, orgId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(tenants)
      .set({
        companyName,
        industry: industry || null,
        companyWebsite: website || null,
        dltEntityId: dltEntityId || null,
        callingWindowStart: callingWindowStart || "10:00",
        callingWindowEnd: callingWindowEnd || "19:00",
        status: "pending_approval",
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, existing[0].id));
  } else {
    await db.insert(tenants).values({
      organizationId: orgId,
      companyName,
      industry: industry || null,
      companyWebsite: website || null,
      dltEntityId: dltEntityId || null,
      callingWindowStart: callingWindowStart || "10:00",
      callingWindowEnd: callingWindowEnd || "19:00",
      status: "pending_approval",
    });
  }

  return NextResponse.json({ ok: true });
}
