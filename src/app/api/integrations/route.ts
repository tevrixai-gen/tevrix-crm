import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { crmConnections } from "@/lib/db/schema";
import { requireTenantApi } from "@/lib/auth/require-tenant";
import { writeAudit } from "@/lib/db/audit";
import { encryptSecret } from "@/lib/crypto/secrets";
import { getAuthorizeUrl } from "@/lib/crm/oauth-urls";

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

const VALID_KINDS = ["hubspot", "zoho", "salesforce", "sheets", "webhook"] as const;
const OAUTH_KINDS = ["hubspot", "zoho", "salesforce"];
const VALID_TRIGGERS = ["on_qualified", "on_any_completed", "on_keyword"] as const;

export async function POST(req: NextRequest) {
  const { error, tenant, userId } = await requireTenantApi({ allowPaused: false });
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const kind = body.kind as string;
  if (!VALID_KINDS.includes(kind as typeof VALID_KINDS[number])) {
    return NextResponse.json({ error: `Invalid kind. Must be one of: ${VALID_KINDS.join(", ")}` }, { status: 400 });
  }

  const displayName = String(body.displayName || kind).trim();
  const triggerRule = VALID_TRIGGERS.includes(body.triggerRule) ? body.triggerRule : "on_qualified";

  let configCiphertext: string | null = null;
  if (body.config && typeof body.config === "object") {
    configCiphertext = encryptSecret(JSON.stringify(body.config));
  }

  const [row] = await db
    .insert(crmConnections)
    .values({
      tenantId: tenant!.id,
      kind: kind as typeof VALID_KINDS[number],
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
