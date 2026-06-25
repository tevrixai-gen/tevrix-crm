import type { CrmAdapter, CrmPushPayload, CrmPushResult } from "./adapter";
import { refreshAccessToken, type OAuthTokens } from "./oauth";

const HUBSPOT_API = "https://api.hubapi.com";

async function ensureValidToken(
  config: Record<string, unknown>
): Promise<{ accessToken: string; updated: boolean; newTokens?: OAuthTokens }> {
  const tokens = config as unknown as OAuthTokens;
  if (Date.now() < tokens.expires_at - 60_000) {
    return { accessToken: tokens.access_token, updated: false };
  }

  const clientId = process.env.HUBSPOT_CLIENT_ID!;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET!;

  const refreshed = await refreshAccessToken(
    "https://api.hubapi.com/oauth/v1/token",
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

export const hubspotAdapter: CrmAdapter = {
  async push(payload: CrmPushPayload, config: Record<string, unknown>): Promise<CrmPushResult> {
    const { accessToken } = await ensureValidToken(config);

    // Search for existing contact by phone
    const searchRes = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filterGroups: [{
          filters: [{ propertyName: "phone", operator: "EQ", value: payload.leadPhone }],
        }],
        properties: ["phone", "email", "firstname"],
      }),
    });

    const searchData = await searchRes.json();
    const existingId = searchData.results?.[0]?.id;

    const properties: Record<string, string> = {
      phone: payload.leadPhone,
      hs_lead_status: payload.outcome === "qualified" ? "OPEN" : "UNQUALIFIED",
    };

    if (payload.leadName) {
      const parts = payload.leadName.split(" ");
      properties.firstname = parts[0];
      if (parts.length > 1) properties.lastname = parts.slice(1).join(" ");
    }
    if (payload.leadEmail) properties.email = payload.leadEmail;

    // Build notes from summary + gathered data
    const noteLines: string[] = [];
    if (payload.summary) noteLines.push(payload.summary);
    if (payload.gatheredData) {
      noteLines.push("\nDetails:");
      for (const [k, v] of Object.entries(payload.gatheredData)) {
        noteLines.push(`  ${k}: ${String(v)}`);
      }
    }
    noteLines.push(`\nCall: ${payload.callDurationSeconds ?? 0}s on ${payload.callDate}`);
    if (payload.campaignName) noteLines.push(`Campaign: ${payload.campaignName}`);

    let contactId = existingId;

    if (existingId) {
      // Update existing contact
      const updateRes = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/${existingId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ properties }),
      });
      if (!updateRes.ok) {
        return { ok: false, error: `HubSpot update failed: ${updateRes.status}` };
      }
    } else {
      // Create new contact
      const createRes = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ properties }),
      });
      if (!createRes.ok) {
        const errText = await createRes.text().catch(() => "");
        return { ok: false, error: `HubSpot create failed: ${createRes.status} ${errText}` };
      }
      const created = await createRes.json();
      contactId = created.id;
    }

    // Create a note (engagement) attached to the contact
    if (contactId && noteLines.length > 0) {
      await fetch(`${HUBSPOT_API}/crm/v3/objects/notes`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            hs_note_body: noteLines.join("\n"),
            hs_timestamp: new Date(payload.callDate).getTime(),
          },
          associations: [{
            to: { id: contactId },
            types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }],
          }],
        }),
      });
    }

    return { ok: true, externalRef: contactId };
  },

  async testPush(config: Record<string, unknown>): Promise<CrmPushResult> {
    try {
      const { accessToken } = await ensureValidToken(config);
      // Verify token by calling account info
      const res = await fetch(`${HUBSPOT_API}/account-info/v3/details`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { ok: false, error: `HubSpot auth failed: ${res.status}` };
      return { ok: true, externalRef: "connection_verified" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
