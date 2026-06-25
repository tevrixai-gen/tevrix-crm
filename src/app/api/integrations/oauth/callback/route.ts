import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { crmConnections } from "@/lib/db/schema";
import { encryptSecret } from "@/lib/crypto/secrets";
import { parseOAuthState, exchangeCodeForTokens } from "@/lib/crm/oauth";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const errorParam = req.nextUrl.searchParams.get("error");

  if (errorParam || !code || !state) {
    return NextResponse.redirect(
      new URL(`/integrations?error=${encodeURIComponent(errorParam ?? "OAuth cancelled")}`, req.url)
    );
  }

  let connectionId: string;
  let tenantId: string;
  try {
    ({ connectionId, tenantId } = parseOAuthState(state));
  } catch {
    return NextResponse.redirect(new URL("/integrations?error=invalid_state", req.url));
  }

  const [conn] = await db
    .select()
    .from(crmConnections)
    .where(and(eq(crmConnections.id, connectionId), eq(crmConnections.tenantId, tenantId)))
    .limit(1);

  if (!conn) {
    return NextResponse.redirect(new URL("/integrations?error=connection_not_found", req.url));
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectUri = `${appUrl}/api/integrations/oauth/callback`;

  try {
    let tokens;

    switch (conn.kind) {
      case "hubspot":
        tokens = await exchangeCodeForTokens(
          "https://api.hubapi.com/oauth/v1/token",
          {
            grant_type: "authorization_code",
            client_id: process.env.HUBSPOT_CLIENT_ID!,
            client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
            redirect_uri: redirectUri,
            code,
          }
        );
        break;

      case "zoho":
        tokens = await exchangeCodeForTokens(
          "https://accounts.zoho.in/oauth/v2/token",
          {
            grant_type: "authorization_code",
            client_id: process.env.ZOHO_CLIENT_ID!,
            client_secret: process.env.ZOHO_CLIENT_SECRET!,
            redirect_uri: redirectUri,
            code,
          }
        );
        break;

      case "salesforce":
        tokens = await exchangeCodeForTokens(
          "https://login.salesforce.com/services/oauth2/token",
          {
            grant_type: "authorization_code",
            client_id: process.env.SALESFORCE_CLIENT_ID!,
            client_secret: process.env.SALESFORCE_CLIENT_SECRET!,
            redirect_uri: redirectUri,
            code,
          }
        );
        break;

      default:
        return NextResponse.redirect(new URL("/integrations?error=unsupported_kind", req.url));
    }

    const configCiphertext = encryptSecret(JSON.stringify(tokens));

    await db
      .update(crmConnections)
      .set({
        configCiphertext,
        status: "active",
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(crmConnections.id, connectionId));

    return NextResponse.redirect(new URL("/integrations?connected=true", req.url));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(crmConnections)
      .set({ status: "error", lastError: msg, updatedAt: new Date() })
      .where(eq(crmConnections.id, connectionId));

    return NextResponse.redirect(
      new URL(`/integrations?error=${encodeURIComponent(msg)}`, req.url)
    );
  }
}
