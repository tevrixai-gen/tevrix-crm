import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tenants, organization, member } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if ((session.user as { isStaff?: boolean }).isStaff) {
    return NextResponse.json({ error: "Staff accounts do not need onboarding" }, { status: 400 });
  }

  const body = await req.json();
  const { companyName, industry, website, dltEntityId, callingWindowStart, callingWindowEnd } = body;

  if (!companyName) return NextResponse.json({ error: "companyName required" }, { status: 400 });

  let orgId: string;

  try {
    // Use a transaction with advisory lock on userId to prevent double-submit race
    const userIdHash = Math.abs(
      session.user.id.split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0)
    );

    const result = await db.transaction(async (tx) => {
      // Advisory lock scoped to this user — serializes concurrent onboarding POSTs
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${userIdHash})`);

      const memberRow = await tx
        .select({ org: organization })
        .from(member)
        .innerJoin(organization, eq(member.organizationId, organization.id))
        .where(eq(member.userId, session.user.id))
        .limit(1);

      if (memberRow.length > 0) {
        orgId = memberRow[0].org.id;
      } else {
        const baseSlug = companyName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
        const slug = baseSlug || "org-" + randomUUID().slice(0, 8);
        const uniqueSlug = slug + "-" + randomUUID().slice(0, 6);

        const orgResult = await auth.api.createOrganization({
          headers: reqHeaders,
          body: { name: companyName, slug: uniqueSlug },
        });

        orgId = (orgResult as { id: string }).id;
      }

      const existing = await tx
        .select()
        .from(tenants)
        .where(eq(tenants.organizationId, orgId))
        .limit(1);

      if (existing.length > 0) {
        await tx
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
        await tx.insert(tenants).values({
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

      return { ok: true };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Onboarding error:", err);
    return NextResponse.json(
      { error: "Failed to create account. Please try again." },
      { status: 500 },
    );
  }
}
