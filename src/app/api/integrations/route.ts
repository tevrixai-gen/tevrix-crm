import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { crmConnections } from "@/lib/db/schema";
import { requireTenantApi } from "@/lib/auth/require-tenant";
import { writeAudit } from "@/lib/db/audit";
import { encryptSecret } from "@/lib/crypto/secrets";
import { getAuthorizeUrl } from "@/lib/crm/oauth-urls";
import { createIntegrationSchema } from "@/lib/schemas/integration";

export async function GET() {
  const { error, tenant } = await requireTenantApi();
  if (error) return error;

  const rows = await db
    .select({
      id: crmConnections.id,
      kind: crmConnections.kind,
      displayName: crmConnections.displayName,
      triggerRule: crmConnections.triggerRule,
      status: crmConnections.status,
      lastSyncAt: crmConnections.lastSyncAt,
      lastError: crmConnections.lastError,
      createdAt: crmConnections.createdAt,
    })
    .from(crmConnections)
    .where(eq(crmConnections.tenantId, tenant!.id))
    .orderBy(crmConnections.createdAt);

  return NextResponse.json({ connections: rows });
}

const OAUTH_KINDS = ["hubspot", "zoho", "salesforce"];

export async function POST(req: NextRequest) {
  const { error, tenant, userId } = await requireTenantApi({ allowPaused: false });
  if (error) return error;

  const raw = await req.json().catch(() => null);
  if (!raw) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const parsed = createIntegrationSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { kind, triggerRule } = parsed.data;
  const displayName = String(parsed.data.displayName || kind).trim();

  let configCiphertext: string | null = null;
  if (parsed.data.config && typeof parsed.data.config === "object") {
    configCiphertext = encryptSecret(JSON.stringify(parsed.data.config));
  }

  const [row] = await db
    .insert(crmConnections)
    .values({
      tenantId: tenant!.id,
      kind,
      displayName,
      triggerRule,
      configCiphertext,
      status: OAUTH_KINDS.includes(kind) ? "revoked" : "active",
    })
    .returning();

  await writeAudit({
    tenantId: tenant!.id,
    actorId: userId!,
    action: "integration.create",
    resourceType: "crm_connection",
    resourceId: row.id,
    after: { kind, displayName, triggerRule },
  });

  // For OAuth-based CRMs, return the authorization URL
  let authorizeUrl: string | null = null;
  if (OAUTH_KINDS.includes(kind)) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    authorizeUrl = getAuthorizeUrl(kind, row.id, tenant!.id, appUrl);
  }

  return NextResponse.json({
    connection: { id: row.id, kind: row.kind, displayName: row.displayName, status: row.status },
    authorizeUrl,
  }, { status: 201 });
}
