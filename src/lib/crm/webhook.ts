import crypto from "crypto";
import type { CrmAdapter, CrmPushPayload, CrmPushResult } from "./adapter";

export const webhookAdapter: CrmAdapter = {
  async push(payload: CrmPushPayload, config: Record<string, unknown>): Promise<CrmPushResult> {
    const url = config.url as string;
    const secret = config.secret as string | undefined;

    const body = JSON.stringify(payload);
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (secret) {
      const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
      headers["X-Webhook-Signature"] = sig;
    }

    const res = await fetch(url, { method: "POST", headers, body });

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${await res.text().catch(() => "")}` };
    }

    return { ok: true };
  },

  async testPush(config: Record<string, unknown>): Promise<CrmPushResult> {
    const testPayload: CrmPushPayload = {
      leadName: "Test Lead",
      leadPhone: "+919999999999",
      leadEmail: "test@example.com",
      outcome: "qualified",
      summary: "This is a test push from Tevrix AI.",
      gatheredData: { budget: "50L", timeline: "3 months" },
      callDurationSeconds: 120,
      callDate: new Date().toISOString(),
      campaignName: "Test Campaign",
    };
    return this.push(testPayload, config);
  },
};
