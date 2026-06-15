// Typed Dograh engine client — the ONLY place that knows engine endpoints.
// All CRM ↔ engine communication goes through this module.

import { decryptSecret } from "@/lib/crypto/secrets";

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

  // ─── Workflow resolution ─────────────────────────────────────────────────

  // The CRM stores the human-friendly integer workflow id (matches Dograh's UI
  // and the integer workflow_id Dograh sends in webhooks). The per-workflow
  // call endpoints, however, key on the workflow UUID — so resolve when needed.
  async resolveWorkflowUuid(workflowIdOrUuid: string): Promise<string> {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(workflowIdOrUuid)) {
      return workflowIdOrUuid; // already a UUID
    }
    const wf = await this.request<{ workflow_uuid: string }>(
      `/workflow/fetch/${workflowIdOrUuid}`
    );
    return wf.workflow_uuid;
  }

  // ─── Trigger calls ──────────────────────────────────────────────────────

  async triggerCall(
    workflowUuid: string,
    req: DograhTriggerCallRequest
  ): Promise<DograhTriggerCallResponse> {
    return this.request<DograhTriggerCallResponse>(
      `/public/agent/workflow/${workflowUuid}`,
      { method: "POST", body: JSON.stringify(req) }
    );
  }

  async triggerTestCall(
    workflowUuid: string,
    req: DograhTriggerCallRequest
  ): Promise<DograhTriggerCallResponse> {
    return this.request<DograhTriggerCallResponse>(
      `/public/agent/test/workflow/${workflowUuid}`,
      { method: "POST", body: JSON.stringify(req) }
    );
  }

  // ─── Campaigns ──────────────────────────────────────────────────────────

  async createCampaign(
    data: DograhCampaignCreateRequest
  ): Promise<DograhCampaign> {
    return this.request<DograhCampaign>("/campaign/create", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getCampaign(campaignId: number): Promise<DograhCampaign> {
    return this.request<DograhCampaign>(`/campaign/${campaignId}`);
  }

  async startCampaign(campaignId: number): Promise<void> {
    await this.request(`/campaign/${campaignId}/start`, { method: "POST" });
  }

  async pauseCampaign(campaignId: number): Promise<void> {
    await this.request(`/campaign/${campaignId}/pause`, { method: "POST" });
  }

  async resumeCampaign(campaignId: number): Promise<void> {
    await this.request(`/campaign/${campaignId}/resume`, { method: "POST" });
  }

  async getCampaignRuns(
    campaignId: number,
    page = 1,
    limit = 50
  ): Promise<DograhCampaignRunsResponse> {
    return this.request<DograhCampaignRunsResponse>(
      `/campaign/${campaignId}/runs?page=${page}&limit=${limit}`
    );
  }

  // ─── Knowledge base ─────────────────────────────────────────────────────

  // Dograh ingests a document in three steps:
  //   1. request a presigned S3/MinIO PUT URL
  //   2. upload the raw bytes straight to that URL
  //   3. trigger async processing (chunking + embedding)
  async uploadDocument(
    file: File
  ): Promise<{ id: number; document_uuid: string; status: string }> {
    const mimeType = file.type || "application/octet-stream";

    // 1. presigned URL
    const presigned = await this.request<{
      upload_url: string;
      document_uuid: string;
      s3_key: string;
    }>("/knowledge-base/upload-url", {
      method: "POST",
      body: JSON.stringify({ filename: file.name, mime_type: mimeType }),
    });

    // 2. upload bytes to the presigned URL (no API key — the URL is signed)
    const putRes = await fetch(presigned.upload_url, {
      method: "PUT",
      headers: { "Content-Type": mimeType },
      body: file,
    });
    if (!putRes.ok) {
      throw new DograhClientError(
        `Presigned upload failed: ${putRes.status}`,
        putRes.status
      );
    }

    // 3. trigger processing
    const doc = await this.request<{
      id: number;
      document_uuid: string;
      processing_status: string;
    }>("/knowledge-base/process-document", {
      method: "POST",
      body: JSON.stringify({
        document_uuid: presigned.document_uuid,
        s3_key: presigned.s3_key,
        retrieval_mode: "chunked",
      }),
    });

    return {
      id: doc.id,
      document_uuid: doc.document_uuid,
      status: doc.processing_status,
    };
  }

  async deleteDocument(docUuid: string): Promise<void> {
    await this.request(`/knowledge-base/documents/${docUuid}`, {
      method: "DELETE",
    });
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createDograhClient(
  baseUrl: string,
  apiKeyCiphertext: string
): DograhClient {
  // Handles "enc:v1:" (AES-256-GCM) and legacy "plain:"/bare values.
  return new DograhClient(baseUrl, decryptSecret(apiKeyCiphertext));
}
