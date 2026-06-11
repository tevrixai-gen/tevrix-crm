import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getTenantByUserId } from "@/lib/db/tenant-repo";
import { db } from "@/lib/db";
import { agentProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenant = await getTenantByUserId(session.user.id);
  if (!tenant) return NextResponse.json({ error: "No tenant" }, { status: 404 });

  const profile = await db
    .select()
    .from(agentProfiles)
    .where(eq(agentProfiles.tenantId, tenant.id))
    .limit(1);

  return NextResponse.json({ agent: profile[0] ?? null });
}

export async function PUT(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenant = await getTenantByUserId(session.user.id);
  if (!tenant) return NextResponse.json({ error: "No tenant" }, { status: 404 });

  const body = await req.json();
  const { agentName, goal, language, voiceId } = body;

  const existing = await db
    .select()
    .from(agentProfiles)
    .where(eq(agentProfiles.tenantId, tenant.id))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(agentProfiles)
      .set({
        agentName: agentName ?? existing[0].agentName,
        goal: goal ?? existing[0].goal,
        language: language ?? existing[0].language,
        voiceId: voiceId ?? existing[0].voiceId,
        isDraft: true,
        updatedAt: new Date(),
      })
      .where(eq(agentProfiles.id, existing[0].id));
  } else {
    await db.insert(agentProfiles).values({
      tenantId: tenant.id,
      agentName: agentName ?? "Alex",
      goal: goal ?? null,
      language: language ?? "en-IN",
      voiceId: voiceId ?? null,
      isDraft: true,
      dograhWorkflowId: tenant.dograhWorkflowId,
    });
  }

  return NextResponse.json({ ok: true });
}
