import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  uuid,
  pgEnum,
  unique,
  index,
  decimal,
} from "drizzle-orm/pg-core";

// ─── better-auth required tables ─────────────────────────────────────────────

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  isStaff: boolean("is_staff").notNull().default(false),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  activeOrganizationId: text("active_organization_id"),
  impersonatedBy: text("impersonated_by"),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// ─── better-auth organization plugin tables ───────────────────────────────────

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  logo: text("logo"),
  createdAt: timestamp("created_at").notNull(),
  metadata: text("metadata"),
});

export const member = pgTable("member", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  createdAt: timestamp("created_at").notNull(),
});

export const invitation = pgTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role"),
  status: text("status").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

// ─── Tevrix CRM: plans ────────────────────────────────────────────────────────

export const planTierEnum = pgEnum("plan_tier", ["trial", "starter", "growth"]);

export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  tier: planTierEnum("tier").notNull().unique(),
  displayName: text("display_name").notNull(),
  maxCallsPerMonth: integer("max_calls_per_month").notNull(),
  maxMinutesPerMonth: integer("max_minutes_per_month").notNull(),
  maxConcurrency: integer("max_concurrency").notNull(),
  priceInrMonthly: decimal("price_inr_monthly", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Tevrix CRM: tenants ──────────────────────────────────────────────────────

export const tenantStatusEnum = pgEnum("tenant_status", [
  "created",
  "pending_approval",
  "provisioning",
  "provisioning_failed",
  "ready",
  "live",
  "paused",
]);

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id")
    .notNull()
    .unique()
    .references(() => organization.id, { onDelete: "restrict" }),
  status: tenantStatusEnum("status").notNull().default("created"),
  planTier: planTierEnum("plan_tier").notNull().default("trial"),
  // Onboarding fields
  companyName: text("company_name"),
  companyWebsite: text("company_website"),
  industry: text("industry"),
  dltEntityId: text("dlt_entity_id"),
  callingWindowStart: text("calling_window_start").notNull().default("10:00"),
  callingWindowEnd: text("calling_window_end").notNull().default("19:00"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  // Dograh mapping (set by staff)
  dograhOrgId: text("dograh_org_id"),
  dograhApiKeyCiphertext: text("dograh_api_key_ciphertext"),
  dograhWebhookSecret: text("dograh_webhook_secret"),
  dograhWorkflowId: text("dograh_workflow_id"),
  // Timestamps
  approvedAt: timestamp("approved_at"),
  approvedBy: text("approved_by").references(() => user.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Tevrix CRM: leads ────────────────────────────────────────────────────────

export const leadStatusEnum = pgEnum("lead_status", [
  "new",
  "queued",
  "calling",
  "connected",
  "not_answered",
  "callback",
  "qualified",
  "not_interested",
  "dnc",
  "failed",
]);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(), // E.164 normalized
    name: text("name"),
    email: text("email"),
    status: leadStatusEnum("status").notNull().default("new"),
    isDnc: boolean("is_dnc").notNull().default(false),
    isNdnc: boolean("is_ndnc").notNull().default(false),
    consentGiven: boolean("consent_given").notNull().default(false),
    attributes: jsonb("attributes"),
    tags: text("tags").array().notNull().default([]),
    importBatchId: uuid("import_batch_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("leads_tenant_phone_unique").on(t.tenantId, t.phone),
    index("leads_tenant_status_idx").on(t.tenantId, t.status),
  ]
);

// ─── Tevrix CRM: import_batches ───────────────────────────────────────────────

export const importBatches = pgTable("import_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  gcsPath: text("gcs_path").notNull(),
  totalRows: integer("total_rows").notNull().default(0),
  importedRows: integer("imported_rows").notNull().default(0),
  skippedRows: integer("skipped_rows").notNull().default(0),
  errorRows: integer("error_rows").notNull().default(0),
  errorReport: jsonb("error_report"),
  status: text("status").notNull().default("processing"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

// ─── Tevrix CRM: campaigns ────────────────────────────────────────────────────

export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "scheduled",
  "running",
  "paused",
  "completed",
  "cancelled",
]);

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: campaignStatusEnum("status").notNull().default("draft"),
  leadFilter: jsonb("lead_filter"),
  schedule: jsonb("schedule"),
  maxConcurrency: integer("max_concurrency").notNull().default(5),
  retryConfig: jsonb("retry_config"),
  // Counters (updated by projector)
  totalLeads: integer("total_leads").notNull().default(0),
  calledLeads: integer("called_leads").notNull().default(0),
  connectedLeads: integer("connected_leads").notNull().default(0),
  qualifiedLeads: integer("qualified_leads").notNull().default(0),
  // Dograh reference
  dograhCampaignId: text("dograh_campaign_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  launchedAt: timestamp("launched_at"),
  completedAt: timestamp("completed_at"),
});

// ─── Tevrix CRM: campaign_leads ───────────────────────────────────────────────

export const campaignLeads = pgTable(
  "campaign_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    status: leadStatusEnum("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at"),
  },
  (t) => [unique("campaign_leads_unique").on(t.campaignId, t.leadId)]
);

// ─── Tevrix CRM: calls ────────────────────────────────────────────────────────

export const callOutcomeEnum = pgEnum("call_outcome", [
  "connected",
  "not_answered",
  "callback",
  "qualified",
  "not_interested",
  "dnc",
  "failed",
  "error",
]);

export const calls = pgTable(
  "calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id),
    leadId: uuid("lead_id").references(() => leads.id),
    dograhRunId: text("dograh_run_id").unique(),
    phone: text("phone").notNull(),
    outcome: callOutcomeEnum("outcome"),
    durationSeconds: integer("duration_seconds"),
    transcript: jsonb("transcript"),
    summary: text("summary"),
    gatheredData: jsonb("gathered_data"),
    recordingRef: text("recording_ref"),
    costUsd: decimal("cost_usd", { precision: 8, scale: 4 }),
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("calls_tenant_created_idx").on(t.tenantId, t.createdAt)]
);

// ─── Tevrix CRM: agent_profiles ───────────────────────────────────────────────

export const agentProfiles = pgTable("agent_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .unique()
    .references(() => tenants.id, { onDelete: "cascade" }),
  agentName: text("agent_name").notNull().default("Alex"),
  goal: text("goal"),
  language: text("language").notNull().default("en-IN"),
  voiceId: text("voice_id"),
  isDraft: boolean("is_draft").notNull().default(true),
  dograhWorkflowId: text("dograh_workflow_id"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Tevrix CRM: documents ────────────────────────────────────────────────────

export const documentStatusEnum = pgEnum("document_status", [
  "uploading",
  "processing",
  "ready",
  "failed",
]);

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  gcsPath: text("gcs_path").notNull(),
  status: documentStatusEnum("status").notNull().default("uploading"),
  dograhDocRef: text("dograh_doc_ref"),
  uploadedBy: text("uploaded_by").references(() => user.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Tevrix CRM: usage_ledger ─────────────────────────────────────────────────

export const usageLedger = pgTable(
  "usage_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    period: text("period").notNull(), // "2026-06"
    callsUsed: integer("calls_used").notNull().default(0),
    minutesUsed: integer("minutes_used").notNull().default(0),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique("usage_ledger_tenant_period_unique").on(t.tenantId, t.period)]
);

// ─── Tevrix CRM: provisioning_runs ────────────────────────────────────────────

export const provisioningStepEnum = pgEnum("provisioning_step", [
  "verify_key",
  "clone_workflow",
  "apply_variables",
  "register_webhook",
  "complete",
]);

export const provisioningStepStatusEnum = pgEnum("provisioning_step_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
]);

export const provisioningRuns = pgTable("provisioning_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  step: provisioningStepEnum("step").notNull(),
  status: provisioningStepStatusEnum("status").notNull().default("pending"),
  payload: jsonb("payload"),
  error: text("error"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Tevrix CRM: webhook_inbox ────────────────────────────────────────────────

export const webhookInboxStatusEnum = pgEnum("webhook_inbox_status", [
  "pending",
  "processing",
  "processed",
  "failed",
]);

export const webhookInbox = pgTable(
  "webhook_inbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").notNull().default("dograh"),
    externalId: text("external_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    status: webhookInboxStatusEnum("status").notNull().default("pending"),
    processingError: text("processing_error"),
    receivedAt: timestamp("received_at").notNull().defaultNow(),
    processedAt: timestamp("processed_at"),
  },
  (t) => [unique("webhook_inbox_idempotency").on(t.source, t.externalId)]
);

// ─── Tevrix CRM: audit_log ────────────────────────────────────────────────────

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id"),
  actorId: text("actor_id").references(() => user.id),
  action: text("action").notNull(),
  resourceType: text("resource_type"),
  resourceId: text("resource_id"),
  before: jsonb("before"),
  after: jsonb("after"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
