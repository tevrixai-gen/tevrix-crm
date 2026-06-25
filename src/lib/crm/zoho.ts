import type { CrmAdapter, CrmPushPayload, CrmPushResult } from "./adapter";
import { refreshAccessToken, type OAuthTokens } from "./oauth";

async function ensureValidToken(
  config: Record<string, unknown>
): Promise<{ accessToken: string; updated: boolean; newTokens?: OAuthTokens }> {
  const tokens = config as unknown as OAuthTokens;
  if (Date.now() < tokens.expires_at - 60_000) {
    return { accessToken: tokens.access_token, updated: false };
  }

  const clientId = process.env.ZOHO_CLIENT_ID!;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET!;

  const refreshed = await refreshAccessToken(
    "https://accounts.zoho.in/oauth/v2/token",
    {
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refresh_token,
    }
  );

  const newTokens: OAuthTokens = {
    ...tokens,
    access_token: refreshed.access_token,
    expires_at: refreshed.expires_at,
  };

  return { accessToken: refreshed.access_token, updated: true, newTokens };
}

export const zohoAdapter: CrmAdapter = {
  async push(payload: CrmPushPayload, config: Record<string, unknown>): Promise<CrmPushResult> {
    const { accessToken } = await ensureValidToken(config);
    const apiDomain = (config as { api_domain?: string }).api_domain || "https://www.zohoapis.in";

    // Search for existing lead by phone
    const searchRes = await fetch(
      `${apiDomain}/crm/v5/Leads/search?phone=${encodeURIComponent(payload.leadPhone)}`,
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
    );

    let existingId: string | null = null;
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      existingId = searchData.data?.[0]?.id ?? null;
    }

    const nameParts = payload.leadName?.split(" ") ?? ["Unknown"];
    const leadData: Record<string, unknown> = {
      First_Name: nameParts[0],
      Last_Name: nameParts.length > 1 ? nameParts.slice(1).join(" ") : nameParts[0],
      Phone: payload.leadPhone,
      Lead_Status: payload.outcome === "qualified" ? "Qualified" : "Contacted",
      Lead_Source: "AI Voice Agent",
      Description: [
        payload.summary,
        payload.gatheredData
          ? Object.entries(payload.gatheredData).map(([k, v]) => `${k}: ${String(v)}`).join("\n")
          : null,
        `Call: ${payload.callDurationSeconds ?? 0}s on ${payload.callDate}`,
        payload.campaignName ? `Campaign: ${payload.campaignName}` : null,
      ].filter(Boolean).join("\n\n"),
    };

    if (payload.leadEmail) leadData.Email = payload.leadEmail;

    if (existingId) {
      const updateRes = await fetch(`${apiDomain}/crm/v5/Leads/${existingId}`, {
        method: "PUT",
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: [leadData] }),
      });
      if (!updateRes.ok) {
        return { ok: false, error: `Zoho update failed: ${updateRes.status}` };
      }
      return { ok: true, externalRef: existingId };
    }

    const createRes = await fetch(`${apiDomain}/crm/v5/Leads`, {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: [leadData] }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => "");
      return { ok: false, error: `Zoho create failed: ${createRes.status} ${errText}` };
    }

    const created = await createRes.json();
    const newId = created.data?.[0]?.details?.id;
    return { ok: true, externalRef: newId ?? undefined };
  },

  async testPush(config: Record<string, unknown>): Promise<CrmPushResult> {
    try {
      const { accessToken } = await ensureValidToken(config);
      const apiDomain = (config as { api_domain?: string }).api_domain || "https://www.zohoapis.in";
      const res = await fetch(`${apiDomain}/crm/v5/org`, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      });
      if (!res.ok) return { ok: false, error: `Zoho auth failed: ${res.status}` };
      return { ok: true, externalRef: "connection_verified" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
