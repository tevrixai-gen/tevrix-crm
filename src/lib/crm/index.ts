import type { CrmAdapter } from "./adapter";
import { webhookAdapter } from "./webhook";
import { hubspotAdapter } from "./hubspot";
import { zohoAdapter } from "./zoho";
import { salesforceAdapter } from "./salesforce";

const adapters: Record<string, CrmAdapter> = {
  webhook: webhookAdapter,
  hubspot: hubspotAdapter,
  zoho: zohoAdapter,
  salesforce: salesforceAdapter,
};

export function getAdapter(kind: string): CrmAdapter | null {
  return adapters[kind] ?? null;
}

export type { CrmAdapter, CrmPushPayload, CrmPushResult } from "./adapter";
