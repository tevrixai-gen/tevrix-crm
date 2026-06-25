import type { CrmAdapter, CrmPushPayload, CrmPushResult } from "./adapter";
import { refreshAccessToken, type OAuthTokens } from "./oauth";

async function ensureValidToken(
  config: Record<string, unknown>
): Promise<{ accessToken: string; instanceUrl: string; updated: boolean; newTokens?: OAuthTokens }> {
  const tokens = config as unknown as OAuthTokens;
  const instanceUrl = tokens.instance_url ?? "https://login.salesforce.com";

  if (Date.now() < tokens.expires_at - 60_000) {
    return { accessToken: tokens.access_token, instanceUrl, updated: false };
  }

  const clientId = process.env.SALESFORCE_CLIENT_ID!;
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET!;

  const refreshed = await refreshAccessToken(
    "https://login.salesforce.com/services/oauth2/token",
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

  return { accessToken: refreshed.access_token, instanceUrl, updated: true, newTokens };
}

export const salesforceAdapter: CrmAdapter = {
  async push(payload: CrmPushPayload, config: Record<string, unknown>): Promise<CrmPushResult> {
    const { accessToken, instanceUrl } = await ensureValidToken(config);
    const apiBase = `${instanceUrl}/services/data/v59.0`;

    // Search for existing Lead by phone
    const soql = `SELECT Id FROM Lead WHERE Phone = '${payload.leadPhone.replace(/'/g, "\\'")}' LIMIT 1`;
    const searchRes = await fetch(`${apiBase}/query?q=${encodeURIComponent(soql)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let existingId: string | null = null;
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      existingId = searchData.records?.[0]?.Id ?? null;
    }

    const nameParts = payload.leadName?.split(" ") ?? ["Unknown"];
    const description = [
      payload.summary,
      payload.gatheredData
        ? Object.entries(payload.gatheredData).map(([k, v]) => `${k}: ${String(v)}`).join("\n")
        : null,
      `Call: ${payload.callDurationSeconds ?? 0}s on ${payload.callDate}`,
      payload.campaignName ? `Campaign: ${payload.campaignName}` : null,
    ].filter(Boolean).join("\n\n");

    const leadData: Record<string, unknown> = {
      FirstName: nameParts[0],
      LastName: nameParts.length > 1 ? nameParts.slice(1).join(" ") : nameParts[0],
      Phone: payload.leadPhone,
      Status: payload.outcome === "qualified" ? "Qualified" : "Open - Not Contacted",
      LeadSource: "AI Voice Agent",
      Description: description,
      Company: "Unknown",
    };

    if (payload.leadEmail) leadData.Email = payload.leadEmail;

    if (existingId) {
      const updateRes = await fetch(`${apiBase}/sobjects/Lead/${existingId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(leadData),
      });
      if (!updateRes.ok && updateRes.status !== 204) {
        return { ok: false, error: `Salesforce update failed: ${updateRes.status}` };
      }
      return { ok: true, externalRef: existingId };
    }

    const createRes = await fetch(`${apiBase}/sobjects/Lead`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(leadData),
    });

    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => "");
      return { ok: false, error: `Salesforce create failed: ${createRes.status} ${errText}` };
    }

    const created = await createRes.json();
    return { ok: true, externalRef: created.id };
  },

  async testPush(config: Record<string, unknown>): Promise<CrmPushResult> {
    try {
      const { accessToken, instanceUrl } = await ensureValidToken(config);
      const res = await fetch(`${instanceUrl}/services/data/v59.0/limits`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { ok: false, error: `Salesforce auth failed: ${res.status}` };
      return { ok: true, externalRef: "connection_verified" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
