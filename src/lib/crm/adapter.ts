export interface CrmPushPayload {
  leadName: string | null;
  leadPhone: string;
  leadEmail: string | null;
  outcome: string;
  summary: string | null;
  gatheredData: Record<string, unknown> | null;
  callDurationSeconds: number | null;
  callDate: string;
  campaignName: string | null;
}

export interface CrmPushResult {
  ok: boolean;
  externalRef?: string;
  error?: string;
}

export interface CrmAdapter {
  push(payload: CrmPushPayload, config: Record<string, unknown>): Promise<CrmPushResult>;
  testPush(config: Record<string, unknown>): Promise<CrmPushResult>;
}
