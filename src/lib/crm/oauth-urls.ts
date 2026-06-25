import { generateOAuthState } from "./oauth";

export function getAuthorizeUrl(
  kind: string,
  connectionId: string,
  tenantId: string,
  appUrl: string
): string | null {
  const redirectUri = `${appUrl}/api/integrations/oauth/callback`;
  const state = generateOAuthState(connectionId, tenantId);

  switch (kind) {
    case "hubspot": {
      const clientId = process.env.HUBSPOT_CLIENT_ID;
      if (!clientId) return null;
      const scopes = "crm.objects.contacts.read crm.objects.contacts.write";
      return `https://app.hubspot.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${state}`;
    }
    case "zoho": {
      const clientId = process.env.ZOHO_CLIENT_ID;
      if (!clientId) return null;
      const scopes = "ZohoCRM.modules.leads.ALL ZohoCRM.org.READ";
      return `https://accounts.zoho.in/oauth/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&access_type=offline&prompt=consent&state=${state}`;
    }
    case "salesforce": {
      const clientId = process.env.SALESFORCE_CLIENT_ID;
      if (!clientId) return null;
      return `https://login.salesforce.com/services/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}`;
    }
    default:
      return null;
  }
}
