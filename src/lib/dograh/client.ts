// Typed Dograh engine client — the ONLY place that knows engine endpoints.
// All CRM ↔ engine communication goes through this module.

import type {
  DograhHealthResponse,
  DograhTriggerCallRequest,
  DograhTriggerCallResponse,
  DograhCampaignRunsResponse,
  DograhCampaign,
  DograhCampaignCreateRequest,
  DograhServiceKey,
} from "./types";

export class DograhClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "DograhClientError";
  }
}

export class DograhClient {
  constructor(
    private baseUrl: string,
    private apiKey: string
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
        ...init?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new DograhClientError(
        `Dograh API ${res.status}: ${path}`,
        res.status,
        body
      );
    }

    return res.json() as Promise<T>;
  }

  // ─── Health ──────────────────────────────────────────────────────────────

  async health(): Promise<DograhHealthResponse> {
    const url = `${this.baseUrl}/api/v1/health`;
    const res = await fetch(url);
    return res.json();
  }

  // ─── Key verification ────────────────────────────────────────────────────

  async verifyKey(): Promise<DograhServiceKey[]> {
    return this.request<DograhServiceKey[]>("/user/service-keys");
  }

  // ─── Trigger calls ──────────────────────────────────────────────────────

  async triggerCall(
    workflowUuid: string,
    req: DograhTriggerCallRequest
  ): Promise<DograhTriggerCallResponse> {
    return this.request<DograhTriggerCallResponse>(
      `/agent/workflow/${workflowUuid}`,
      { method: "POST", body: JSON.stringify(req) }
    );
  }

  async triggerTestCall(
    workflowUuid: string,
    req: DograhTriggerCallRequest
  ): Promise<DograhTriggerCallResponse> {
    return this.request<DograhTriggerCallResponse>(
      `/agent/test/workflow/${workflowUuid}`,
      { method: "POST", body: JSON.stringify(req) }
    );
  }

  // ─── Campaigns ──────────────────────────────────────────────────────────

  async createCampaign(
    data: DograhCampaignCreateRequest
  ): Promise<DograhCampaign> {
    return this.request<DograhCampaign>("/campaigns/create", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getCampaign(campaignId: number): Promise<DograhCampaign> {
    return this.request<DograhCampaign>(`/campaigns/${campaignId}`);
  }

  async startCampaign(campaignId: number): Promise<void> {
    await this.request(`/campaigns/${campaignId}/start`, { method: "POST" });
  }

  async pauseCampaign(campaignId: number): Promise<void> {
    await this.request(`/campaigns/${campaignId}/pause`, { method: "POST" });
  }

  async getCampaignRuns(
    campaignId: number,
    page = 1,
    limit = 50
  ): Promise<DograhCampaignRunsResponse> {
    return this.request<DograhCampaignRunsResponse>(
      `/campaigns/${campaignId}/runs?page=${page}&limit=${limit}`
    );
  }

  // ─── Knowledge base ─────────────────────────────────────────────────────

  async uploadDocument(
    formData: FormData
  ): Promise<{ id: number; status: string }> {
    const url = `${this.baseUrl}/api/v1/knowledge-base/documents`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "X-API-Key": this.apiKey },
      body: formData,
    });
    if (!res.ok) {
      throw new DograhClientError("Document upload failed", res.status);
    }
    return res.json();
  }

  async deleteDocument(docId: number): Promise<void> {
    await this.request(`/knowledge-base/documents/${docId}`, {
      method: "DELETE",
    });
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createDograhClient(
  baseUrl: string,
  apiKeyCiphertext: string
): DograhClient {
  // Strip the "plain:" prefix (dev mode). In production, this would decrypt
  // via KMS before passing to the client constructor.
  const key = apiKeyCiphertext.startsWith("plain:")
    ? apiKeyCiphertext.slice(6)
    : apiKeyCiphertext;

  return new DograhClient(baseUrl, key);
}
