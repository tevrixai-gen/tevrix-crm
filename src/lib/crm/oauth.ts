import crypto from "crypto";

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  instance_url?: string;
}

export function generateOAuthState(connectionId: string, tenantId: string): string {
  const payload = JSON.stringify({ connectionId, tenantId, nonce: crypto.randomBytes(8).toString("hex") });
  return Buffer.from(payload).toString("base64url");
}

export function parseOAuthState(state: string): { connectionId: string; tenantId: string } {
  const payload = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  return { connectionId: payload.connectionId, tenantId: payload.tenantId };
}

export async function exchangeCodeForTokens(
  tokenUrl: string,
  params: Record<string, string>
): Promise<OAuthTokens> {
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
    instance_url: data.instance_url,
  };
}

export async function refreshAccessToken(
  tokenUrl: string,
  params: Record<string, string>
): Promise<{ access_token: string; expires_at: number }> {
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
}
