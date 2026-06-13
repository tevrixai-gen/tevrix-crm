// Types mirroring the Dograh engine's public API surface.
// Keep this in sync with the engine — the @live contract tests
// verify these shapes against the real API.

export interface DograhHealthResponse {
  status: string;
  version?: string;
  auth_provider?: string;
}

export interface DograhTriggerCallRequest {
  phone_number: string;
  initial_context?: Record<string, unknown>;
  telephony_configuration_id?: number;
}

export interface DograhTriggerCallResponse {
  status: string;
  workflow_run_id: number;
  workflow_run_name: string;
}

export interface DograhCampaignRun {
  id: number;
  name: string;
  status: string;
  phone_number?: string;
  duration?: number;
  disposition_code?: string;
  created_at: string;
  completed_at?: string;
  transcript?: Array<{ role: string; content: string }>;
  gathered_data?: Record<string, unknown>;
  recording_url?: string;
  cost?: number;
}

export interface DograhCampaignRunsResponse {
  runs: DograhCampaignRun[];
  total_count: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface DograhWorkflow {
  id: number;
  uuid: string;
  name: string;
  organization_id: number;
}

export interface DograhCampaign {
  id: number;
  name: string;
  status: string;
  workflow_id: number;
  total_contacts: number;
  completed_contacts: number;
  created_at: string;
}

export interface DograhCampaignCreateRequest {
  name: string;
  workflow_id: number | string;
  source_type: string;
  source_data: { contacts: Array<{ phone_number: string; context?: Record<string, unknown> }> };
  max_concurrent_calls?: number;
  retry_config?: {
    max_retries: number;
    retry_on_voicemail?: boolean;
    retry_on_no_answer?: boolean;
    retry_on_busy?: boolean;
    retry_delay_minutes?: number;
  };
}

export interface DograhServiceKey {
  id: number;
  key: string;
  name: string;
  created_at: string;
}

export interface DograhWebhookEvent {
  event_type: string;
  data: {
    run_id: number;
    workflow_id?: number;
    workflow_name?: string;
    campaign_id?: number;
    phone_number?: string;
    status: string;
    duration?: number;
    disposition_code?: string;
    transcript?: Array<{ role: string; content: string }>;
    gathered_data?: Record<string, unknown>;
    recording_url?: string;
    cost?: number;
    completed_at?: string;
  };
}
