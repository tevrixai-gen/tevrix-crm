import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireStaff } from "@/lib/auth/require-staff";
import { getTenantById } from "@/lib/db/tenant-repo";
import { writeAudit } from "@/lib/db/audit";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { error, session } = await requireStaff();
  if (error) return error;

  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { dograhOrgId, dograhApiKey, dograhWebhookSecret, dograhWorkflowId } = body;

  if (!dograhOrgId) {
    return NextResponse.json({ error: "dograhOrgId is required" }, { status: 400 });
  }

  // Require API key on first mapping; allow blank to keep existing
  if (!dograhApiKey && !tenant.dograhApiKeyCiphertext) {
    return NextResponse.json({ error: "dograhApiKey is required" }, { status: 400 });
  }

  const before = {
    dograhOrgId: tenant.dograhOrgId,
    dograhWorkflowId: tenant.dograhWorkflowId,
    hasDograhApiKey: !!tenant.dograhApiKeyCiphertext,
    hasDograhWebhookSecret: !!tenant.dograhWebhookSecret,
  };

  // Build update set — only overwrite secrets when a new value is provided
  const updates: Record<string, unknown> = {
    dograhOrgId,
    dograhWorkflowId: dograhWorkflowId || null,
    updatedAt: new Date(),
  };

  if (dograhApiKey) {
    // In production this would be KMS-encrypted
    updates.dograhApiKeyCiphertext = `plain:${dograhApiKey}`;
  }

  if (dograhWebhookSecret) {
    updates.dograhWebhookSecret = dograhWebhookSecret;
  }

  await db.update(tenants).set(updates).where(eq(tenants.id, tenantId));

  await writeAudit({
    tenantId,
    actorId: session!.user.id,
    action: "tenant.mapped",
    resourceType: "tenant",
    resourceId: tenantId,
    before,
    after: {
      dograhOrgId,
      dograhWorkflowId: dograhWorkflowId || null,
      hasDograhApiKey: true,
      hasDograhWebhookSecret: !!dograhWebhookSecret,
    },
  });

  return NextResponse.json({ ok: true });
}
