# Tevrix CRM — Technical Architecture

Complete technical reference for the Tevrix CRM platform, its integration with the Dograh voice engine, and the cloud infrastructure that runs it.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Database Schema](#4-database-schema)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Dograh Voice Engine Integration](#6-dograh-voice-engine-integration)
7. [API Reference](#7-api-reference)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Cloud Infrastructure](#9-cloud-infrastructure)
10. [Security Architecture](#10-security-architecture)
11. [Data Flows](#11-data-flows)

---

## 1. System Overview

Tevrix CRM is a multi-tenant SaaS platform that lets businesses run AI-powered outbound voice campaigns. It connects to **Dograh**, an open-source voice AI engine, to make calls, collect responses, and report results — all from a single web dashboard.

```
┌─────────────────────────────────────────────────────────────────┐
│                        TEVRIX CRM                               │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐    │
│  │  Next.js  │   │  API     │   │  Drizzle │   │  Dograh  │    │
│  │  Frontend │──▶│  Routes  │──▶│  ORM     │   │  Client  │    │
│  │  (React)  │   │  (App    │   │  (Pg)    │   │  (HTTP)  │    │
│  └──────────┘   │  Router) │   └────┬─────┘   └────┬─────┘    │
│                  └──────────┘        │               │          │
└──────────────────────────────────────┼───────────────┼──────────┘
                                       │               │
                              ┌────────▼──────┐  ┌─────▼──────────┐
                              │  Cloud SQL    │  │  Dograh Engine  │
                              │  (PostgreSQL) │  │  (GCE VM)       │
                              └───────────────┘  │  voice.tevrixai │
                                                 │  .com            │
                                                 └──────────────────┘
```

**Two deployed services:**

| Service | URL | Runs On |
|---------|-----|---------|
| Tevrix CRM | `tevrix-crm-124346574650.asia-south1.run.app` | Cloud Run |
| Dograh Engine | `voice.tevrixai.com` | GCE VM (v1.34.0) |

---

## 2. Tech Stack

### Backend (runs inside Next.js server)

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | 22 (Alpine) |
| Framework | Next.js App Router | 16.2.9 |
| Language | TypeScript | 5.x |
| ORM | Drizzle ORM | 0.45.2 |
| DB Driver | postgres.js | 3.4.9 |
| Auth | better-auth | 1.6.16 |
| Validation | Zod | 4.4.3 |
| Env Validation | @t3-oss/env-nextjs | 0.13.11 |

### Frontend

| Layer | Technology | Version |
|-------|-----------|---------|
| UI Framework | React | 19.2.4 |
| Styling | Tailwind CSS | 4.x |
| Components | shadcn/ui (Base UI) | 4.11.0 |
| Icons | Lucide React | 1.17.0 |
| Toasts | Sonner | 2.0.7 |
| Theming | next-themes | 0.4.6 |

### Infrastructure

| Layer | Technology |
|-------|-----------|
| Container Runtime | Cloud Run (asia-south1) |
| Database | Cloud SQL for PostgreSQL |
| Secret Management | GCP Secret Manager |
| Container Registry | Artifact Registry (asia-south1) |
| CI/CD | Cloud Build |
| Voice Engine VM | Compute Engine (e2-standard-4) |
| DNS | Cloud DNS (tevrixai.com) |

---

## 3. Project Structure

```
tevrix-crm/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (admin)/admin/            # Staff-only pages
│   │   │   ├── inbox/page.tsx        #   Webhook inbox viewer
│   │   │   ├── templates/page.tsx    #   Agent template library
│   │   │   └── tenants/              #   Tenant management
│   │   │       ├── page.tsx          #     Tenants list
│   │   │       └── [tenantId]/page.tsx #   Tenant detail + mapping
│   │   ├── (app)/                    # Authenticated tenant pages
│   │   │   ├── agent/page.tsx        #   Agent profile editor
│   │   │   ├── calls/                #   Call history
│   │   │   │   ├── page.tsx          #     Calls list
│   │   │   │   └── [callId]/page.tsx #     Call detail + transcript
│   │   │   ├── campaigns/            #   Campaign management
│   │   │   │   ├── page.tsx          #     Campaigns list
│   │   │   │   ├── new/page.tsx      #     Create campaign
│   │   │   │   └── [campaignId]/page.tsx # Campaign detail
│   │   │   ├── dashboard/page.tsx    #   Main dashboard
│   │   │   ├── knowledge/page.tsx    #   Knowledge base docs
│   │   │   ├── leads/                #   Lead management
│   │   │   │   ├── page.tsx          #     Leads list
│   │   │   │   └── import/page.tsx   #     CSV import wizard
│   │   │   └── settings/page.tsx     #   Tenant settings
│   │   ├── (onboarding)/             # Post-signup flow
│   │   │   ├── onboarding/page.tsx   #   2-step onboarding wizard
│   │   │   └── pending/page.tsx      #   "Account under review"
│   │   ├── (public)/                 # Unauthenticated pages
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   └── forgot-password/page.tsx
│   │   └── api/                      # API routes (see §7)
│   ├── components/
│   │   ├── layout/                   # AppSidebar, AdminSidebar, ImpersonationBanner
│   │   ├── calls/CallsView.tsx
│   │   ├── campaigns/CampaignsList.tsx
│   │   ├── knowledge/KnowledgeView.tsx
│   │   ├── leads/LeadsView.tsx, AddLeadDialog.tsx
│   │   └── ui/                       # shadcn primitives (button, card, dialog, etc.)
│   └── lib/
│       ├── auth/                     # Auth guards + client (see §5)
│       ├── crypto/secrets.ts         # AES-256-GCM encrypt/decrypt
│       ├── db/                       # Drizzle instance, schema, repos
│       ├── dograh/                   # Dograh client, projector, provisioning (see §6)
│       ├── env/index.ts              # Validated env vars (Zod)
│       ├── phone.ts                  # E.164 normalization (India-first)
│       ├── csv.ts                    # RFC-4180 CSV parser
│       ├── quota.ts                  # Plan limit checks
│       ├── working-hours.ts          # IANA timezone calling window enforcement
│       ├── campaign-audience.ts      # Lead query for campaign targeting
│       └── rate-limit.ts             # Sliding-window rate limiter
├── drizzle/                          # Generated migration SQL
├── scripts/
│   └── reencrypt-dograh-keys.ts      # One-time migration for encrypted secrets
├── Dockerfile                        # Multi-stage production build
├── cloudbuild.yaml                   # GCP Cloud Build pipeline
├── drizzle.config.ts                 # Drizzle Kit config
└── next.config.ts                    # output: "standalone"
```

---

## 4. Database Schema

PostgreSQL on Cloud SQL. ORM: Drizzle. Schema defined in `src/lib/db/schema.ts`.

### 4.1 Entity-Relationship Diagram

```
user ─────┬──── account (provider credentials)
          ├──── session (active sessions)
          └──── member ──── organization ──── tenant
                                                │
                    ┌───────────────────────────┤
                    │           │               │
                 leads     campaigns      agentProfiles
                    │           │
                    └─── campaignLeads
                              │
                           calls ──── usageLedger
                              │
                        webhookInbox ──── auditLog
```

### 4.2 Table Definitions

#### `user` (better-auth)
| Column | Type | Notes |
|--------|------|-------|
| id | text PK | Generated by better-auth |
| name | text | |
| email | text | UNIQUE |
| emailVerified | boolean | |
| image | text | Nullable |
| **isStaff** | boolean | `false` default. Never settable from client (`input: false`) |
| createdAt, updatedAt | timestamp | |

#### `session` (better-auth)
| Column | Type | Notes |
|--------|------|-------|
| id | text PK | |
| token | text | UNIQUE, used as cookie value |
| userId | text FK → user | |
| activeOrganizationId | text | Tracks which org the user is working in |
| impersonatedBy | text | Staff user ID when impersonating |
| ipAddress, userAgent | text | Audit fields |
| expiresAt | timestamp | 7-day default |

#### `tenant`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organizationId | text FK → organization | UNIQUE (1:1 with org) |
| **status** | enum | `created → pending_approval → provisioning → provisioning_failed → ready → live → paused` |
| planTier | enum | `trial`, `starter`, `growth` |
| companyName | text | Set during onboarding |
| companyWebsite, industry | text | Optional |
| dltEntityId | text | TRAI DLT registration (India compliance) |
| callingWindowStart | text | Default `"10:00"` |
| callingWindowEnd | text | Default `"19:00"` |
| timezone | text | Default `"Asia/Kolkata"` (IANA) |
| **dograhOrgId** | text | Dograh organization ID (set by admin via `/map`) |
| **dograhApiKeyCiphertext** | text | AES-256-GCM encrypted API key |
| **dograhWebhookSecret** | text | AES-256-GCM encrypted webhook HMAC secret |
| **dograhWorkflowId** | text | Dograh workflow ID or UUID |
| approvedAt | timestamp | Set on admin approval |
| approvedBy | text FK → user | Staff who approved |

**Status state machine:**
```
created ──▶ pending_approval ──▶ provisioning ──▶ ready ──▶ live ──▶ paused
                  │                    │                         │
                  │                    ▼                         ▼
                  │          provisioning_failed                live
                  │                    │
                  └────────────────────┘  (can re-approve)
```

#### `leads`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenantId | uuid FK → tenant | |
| phone | text | E.164 format. UNIQUE with tenantId |
| name | text | |
| email | text | |
| status | enum | `new`, `contacted`, `qualified`, `not_interested`, `dnc` |
| isDnc | boolean | Do-Not-Call flag |
| isNdnc | boolean | National DNC registry flag |
| consentGiven | boolean | |
| attributes | jsonb | Arbitrary key-value data |
| tags | text[] | Filterable labels |
| importBatchId | uuid FK → importBatches | Null if manually created |

Indexes: `(tenantId, status)` for campaign audience queries.

#### `campaigns`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenantId | uuid FK → tenant | |
| name | text | |
| status | enum | `draft → running → paused → completed → cancelled` |
| leadFilter | jsonb | `{status?: string[], tags?: string[]}` |
| maxConcurrency | integer | Capped by plan limits |
| retryConfig | jsonb | `{maxRetries, retryOnNoAnswer, retryOnVoicemail, retryOnBusy}` |
| totalLeads | integer | Set at launch |
| calledLeads | integer | Bumped by projector |
| connectedLeads | integer | Bumped on connected/qualified outcome |
| qualifiedLeads | integer | Bumped on qualified outcome |
| **dograhCampaignId** | text | Set after engine campaign creation |
| launchedAt, completedAt | timestamp | |

#### `calls`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenantId | uuid FK → tenant | |
| campaignId | uuid FK → campaigns | Nullable (test calls have no campaign) |
| leadId | uuid FK → leads | Nullable |
| **dograhRunId** | text | UNIQUE — Dograh workflow_run_id |
| phone | text | E.164 |
| outcome | enum | `connected`, `not_answered`, `callback`, `qualified`, `not_interested`, `dnc`, `failed` |
| durationSeconds | integer | |
| transcript | jsonb | Array of `{role, content}` objects |
| summary | text | AI-generated call summary |
| gatheredData | jsonb | Structured data collected by the voice agent |
| recordingRef | text | S3/GCS path to recording |
| costUsd | decimal | Per-call cost from engine |
| startedAt, endedAt | timestamp | |

Index: `(tenantId, createdAt)` for call listing.

#### `usageLedger`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenantId | uuid FK → tenant | |
| period | text | `"YYYY-MM"` format. UNIQUE with tenantId |
| callsUsed | integer | Incremented per processed call |
| minutesUsed | integer | Incremented by call duration |

Used for quota enforcement at campaign launch.

#### `webhookInbox`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| source | text | Default `"dograh"` |
| externalId | text | Dograh `workflow_run_id`. UNIQUE with source |
| eventType | text | `call.completed`, `call.failed`, etc. |
| payload | jsonb | Raw webhook body |
| status | enum | `pending → processing → processed` or `failed` |
| processingError | text | Error message if failed |
| receivedAt | timestamp | When webhook arrived |
| processedAt | timestamp | When projector finished |

#### `provisioningRuns`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenantId | uuid FK → tenant | |
| step | enum | `verify_key`, `clone_workflow`, `apply_variables`, `register_webhook`, `complete` |
| status | enum | `running`, `succeeded`, `failed` |
| payload | jsonb | Step-specific data |
| error | text | Error message if failed |

UNIQUE on `(tenantId, step)` — idempotent, retryable.

#### `auditLog`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenantId | uuid | |
| actorId | text FK → user | Who performed the action |
| action | text | `tenant.approve`, `tenant.map`, `tenant.provision`, etc. |
| resourceType | text | `tenant`, `campaign`, etc. |
| resourceId | text | |
| before | jsonb | State before change |
| after | jsonb | State after change |

---

## 5. Authentication & Authorization

### 5.1 Auth Provider: better-auth

Configuration in `src/lib/auth/index.ts`:

```typescript
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: { ... } }),
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL!,
  trustedOrigins: [
    process.env.BETTER_AUTH_URL!,
    process.env.NEXT_PUBLIC_APP_URL!
  ].filter(Boolean),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  rateLimit: { enabled: true, window: 60, max: 20 },
  plugins: [
    organization({ allowUserToCreateOrganization: true, organizationLimit: 1 }),
  ],
  user: {
    additionalFields: {
      isStaff: { type: "boolean", defaultValue: false, input: false },
    },
  },
  session: {
    cookieCache: { enabled: true, maxAge: 300 }, // 5 min
  },
});
```

**Key design decisions:**
- `organizationLimit: 1` — each user owns exactly one tenant organization
- `isStaff` field has `input: false` — can never be set from the client API, only via direct DB update
- `trustedOrigins` lists both `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` so the system works during domain migrations
- Session cookies are `__Secure-better-auth.session_token` (SameSite, Secure, HttpOnly)

### 5.2 Client-Side Auth (`src/lib/auth/client.ts`)

```typescript
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL!,  // baked in at build time
  plugins: [organizationClient()],
});
export const { signIn, signUp, signOut, useSession, getSession } = authClient;
```

The `baseURL` is a **build-time** constant (`NEXT_PUBLIC_` prefix). Changing it requires a rebuild — runtime env vars do not affect client-side code.

### 5.3 API Guards

Three guard functions protect API routes:

#### `requireTenantApi()` — `src/lib/auth/require-tenant.ts`
Used by all tenant-scoped API routes (leads, campaigns, calls, documents, agent).

```
1. Get session from better-auth headers
2. Check for impersonation cookie → if present, use impersonated tenantId
3. Otherwise, resolve tenant from user's organization membership
4. Optionally check tenant isn't paused
5. Return { tenant, userId, isImpersonating } or { error: Response }
```

#### `requireStaffApi()` — `src/lib/auth/require-staff.ts`
Used by all `/api/admin/*` routes.

```
1. Get session from better-auth headers
2. Check user.isStaff === true
3. Return { session } or { error: 403 }
```

#### `getTenantContext()` — `src/lib/auth/get-tenant-context.ts`
Used by server components (pages). Redirects to `/login` if unauthenticated, `/pending` if tenant not approved.

### 5.4 Staff Impersonation

Staff can impersonate any tenant for debugging. The flow:

1. Staff calls `POST /api/admin/impersonate` with `{ tenantId }`
2. Server sets an `impersonation` cookie: `{ tenantId, staffUserId }`
3. All subsequent `requireTenantApi()` calls see the impersonated tenant
4. `ImpersonationBanner` component shows a yellow alert bar in the UI
5. Staff's own identity is preserved in `staffUserId` for audit purposes

---

## 6. Dograh Voice Engine Integration

### 6.1 Architecture

The CRM talks to Dograh over HTTP. The engine talks back via webhooks.

```
    ┌─────────────────┐              ┌──────────────────────┐
    │   TEVRIX CRM    │   HTTP API   │    DOGRAH ENGINE     │
    │                 │─────────────▶│                      │
    │  DograhClient   │  X-API-Key   │  /api/v1/*           │
    │  (client.ts)    │              │                      │
    │                 │◀─────────────│  Webhook POST        │
    │  Webhook Handler│  HMAC signed │  (on call complete)  │
    │  (route.ts)     │              │                      │
    └─────────────────┘              └──────────────────────┘
```

### 6.2 DograhClient (`src/lib/dograh/client.ts`)

Typed HTTP client wrapping all Dograh API endpoints:

```typescript
class DograhClient {
  constructor(private baseUrl: string, private apiKey: string) {}

  // Health & auth
  async health(): Promise<DograhHealthResponse>
  async verifyKey(): Promise<boolean>            // GET /service-keys, checks if key is valid

  // Workflows
  async resolveWorkflowUuid(idOrUuid: string): Promise<string>  // GET /workflows

  // Calls
  async triggerCall(workflowUuid: string, req: DograhTriggerCallRequest): Promise<DograhTriggerCallResponse>
  async triggerTestCall(workflowUuid: string, req: DograhTriggerCallRequest): Promise<DograhTriggerCallResponse>

  // Campaigns
  async createCampaign(data: DograhCampaignCreateRequest): Promise<DograhCampaign>
  async startCampaign(campaignId: number): Promise<void>
  async pauseCampaign(campaignId: number): Promise<void>
  async getCampaign(campaignId: number): Promise<DograhCampaign>
  async getCampaignRuns(campaignId: number, page?, limit?): Promise<DograhCampaignRunsResponse>

  // Knowledge Base
  async uploadDocument(file: File): Promise<void>     // 3-step: presigned URL → PUT → trigger processing
  async deleteDocument(docUuid: string): Promise<void>
}
```

**Factory function:**
```typescript
export async function createDograhClient(tenant: Tenant): Promise<DograhClient> {
  const apiKey = decryptSecret(tenant.dograhApiKeyCiphertext);
  return new DograhClient(process.env.DOGRAH_API_BASE_URL!, apiKey);
}
```

The API key is stored encrypted in the database and decrypted at call time — it never persists in memory.

### 6.3 Tenant-to-Dograh Mapping

Each CRM tenant maps to one Dograh organization. The mapping is set by staff via `POST /api/admin/tenants/{id}/map`:

| CRM Field | Dograh Concept | How It's Set |
|-----------|---------------|-------------|
| `dograhOrgId` | Organization ID | Admin enters during mapping |
| `dograhApiKeyCiphertext` | Service API key | Admin enters, CRM encrypts with AES-256-GCM |
| `dograhWebhookSecret` | Webhook HMAC secret | Admin enters, CRM encrypts |
| `dograhWorkflowId` | Workflow ID or UUID | Admin enters; resolved to UUID at call time |

### 6.4 Provisioning State Machine (`src/lib/dograh/provisioning.ts`)

After mapping, staff triggers provisioning. The state machine runs 5 idempotent steps:

```
Step 1: verify_key
  └─ Call client.verifyKey() to confirm API key is valid
       ↓
Step 2: clone_workflow
  └─ MVP: Skip (verify workflow exists). Future: clone a template workflow
       ↓
Step 3: apply_variables
  └─ MVP: No-op. Future: push tenant variables (company name, greeting) to workflow
       ↓
Step 4: register_webhook
  └─ MVP: No-op. Webhooks configured manually in Dograh UI
       ↓
Step 5: complete
  └─ Set tenant.status = "ready", write audit log
```

Each step is recorded in `provisioningRuns` with status `running → succeeded | failed`. On failure, tenant moves to `provisioning_failed` and can be re-provisioned.

### 6.5 Campaign Launch Flow (`src/app/api/campaigns/[campaignId]/launch/route.ts`)

When a user launches a campaign, seven server-side guards run in sequence:

```
Guard 1: Tenant Status
  └─ tenant.status must be "live"

Guard 2: Campaign Status
  └─ campaign.status must be "draft"

Guard 3: Audience Resolution
  └─ Query leads matching campaign filter, exclude DNC unconditionally
  └─ Fail if audience is empty

Guard 4: Quota Check (src/lib/quota.ts)
  └─ Compare plan limits vs usageLedger for current YYYY-MM period
  └─ Fail if insufficient calls or minutes remaining

Guard 5: Working Hours (src/lib/working-hours.ts)
  └─ Check current time in tenant's timezone is within callingWindow
  └─ Fail if outside hours

Guard 6: Write Campaign Leads
  └─ Batch-insert campaignLeads records (500-row chunks)
  └─ Idempotent: ON CONFLICT DO NOTHING on (campaignId, leadId)

Guard 7: Engine Handoff
  └─ client.createCampaign({
       name: "{companyName} — {campaignName}",
       workflow_id: resolvedUUID,
       source_data: { contacts: [{phone_number, context: {lead_name}}] },
       max_concurrent_calls: min(campaign.maxConcurrency, plan.maxConcurrency),
       retry_config: { max_retries: 2, retry_on_no_answer: true, ... }
     })
  └─ client.startCampaign(dograhCampaignId)
  └─ Update campaign: status="running", dograhCampaignId, totalLeads, launchedAt
```

### 6.6 Webhook Ingestion (`src/app/api/webhooks/dograh/route.ts`)

Dograh sends HTTP POST webhooks when calls complete. The handler:

```
1. Rate Limit
   └─ 600 requests/60s per IP

2. Parse Payload (two formats supported)
   ├─ Format 1 (CRM envelope): { event_type, external_id, data: {...} }
   └─ Format 2 (Dograh webhook node): { workflow_run_id, status, phone_number, ... }
       └─ Normalized into Format 1 internally

3. Resolve Tenant
   └─ Extract dograhOrgId from X-Dograh-Org-Id header or payload
   └─ Look up tenant by dograhOrgId

4. Authenticate (unless WEBHOOK_SKIP_VERIFICATION=true)
   ├─ Option A: HMAC signature (x-webhook-signature header)
   │   └─ SHA-256 HMAC of raw body with tenant's decrypted webhook secret
   │   └─ Timing-safe comparison via crypto.timingSafeEqual
   └─ Option B: Bearer token (Authorization header)
       └─ Token compared to tenant's decrypted webhook secret
       └─ Timing-safe comparison

5. Insert into webhookInbox
   └─ Idempotent: UNIQUE(source, externalId)
   └─ Duplicate → return 202 (already received)

6. Return 202 Accepted (processing is async)
```

### 6.7 Webhook Projector (`src/lib/dograh/projector.ts`)

A background process reads pending inbox entries and projects them into CRM data:

```
processInboxEntry(entryId):
  1. Load inbox entry, set status = "processing"

  2. Resolve tenant (fallback chain):
     ├─ workflow_id from event → tenant lookup
     ├─ dograh_org_id from event → tenant lookup
     └─ campaign_id from event → campaign → tenant

  3. Map disposition → outcome:
     ├─ answered/connected    → "connected"
     ├─ no_answer/noanswer    → "not_answered"
     ├─ voicemail/callback    → "callback"
     ├─ qualified/interested  → "qualified"
     ├─ not_interested        → "not_interested"
     ├─ dnc/do_not_call       → "dnc"
     ├─ failed/error          → "failed"
     └─ (default)             → "connected"

  4. Upsert call record
     └─ INSERT ... ON CONFLICT (dograhRunId) DO UPDATE
     └─ Fields: phone, outcome, duration, transcript, gatheredData, recording, cost

  5. Update lead status
     └─ Find lead by phone + tenantId
     └─ Set lead outcome based on call disposition

  6. Bump campaign counters
     └─ calledLeads += 1
     └─ connectedLeads += 1 (if connected or qualified)
     └─ qualifiedLeads += 1 (if qualified)

  7. Bump usage ledger
     └─ UPSERT usageLedger for tenant + YYYY-MM period
     └─ callsUsed += 1, minutesUsed += ceil(durationSeconds / 60)

  8. Mark inbox entry as "processed"
```

### 6.8 Dograh Type Definitions (`src/lib/dograh/types.ts`)

```typescript
// Call trigger
interface DograhTriggerCallRequest {
  phone_number: string;
  initial_context?: Record<string, unknown>;
  telephony_configuration_id?: number;
}

interface DograhTriggerCallResponse {
  status: string;
  workflow_run_id: string;
  workflow_run_name: string;
}

// Campaign
interface DograhCampaignCreateRequest {
  name: string;
  workflow_id: number | string;
  source_type: "manual";
  source_data: {
    contacts: Array<{ phone_number: string; context?: Record<string, unknown> }>;
  };
  max_concurrent_calls?: number;
  retry_config?: {
    max_retries?: number;
    retry_on_no_answer?: boolean;
    retry_on_voicemail?: boolean;
    retry_on_busy?: boolean;
  };
}

// Campaign run (individual call result from engine)
interface DograhCampaignRun {
  id: number;
  name: string;
  status: string;
  phone_number: string;
  duration_seconds: number;
  disposition: string;
  transcript: Array<{ role: string; content: string }>;
  gathered_data: Record<string, unknown>;
  recording_url: string;
  cost_usd: number;
  started_at: string;
  completed_at: string;
}

// Webhook event
interface DograhWebhookEvent {
  event_type: string;
  data: {
    run_id: string;
    workflow_id: number;
    campaign_id?: number;
    phone_number: string;
    status: string;
    duration: number;
    disposition_code: string;
    transcript: unknown;
    gathered_data: unknown;
    recording_url: string;
    cost: number;
    completed_at: string;
  };
}
```

---

## 7. API Reference

### 7.1 Authentication Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| * | `/api/auth/[...all]` | Public | better-auth catch-all (login, signup, logout, session) |

### 7.2 Tenant API Routes

All require `requireTenantApi()` — valid session + active tenant.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/leads` | List leads (search, filter, paginate) |
| POST | `/api/leads` | Create single lead |
| GET | `/api/leads/[leadId]` | Get lead detail |
| PATCH | `/api/leads/[leadId]` | Update lead fields |
| POST | `/api/leads/import/preview` | Preview CSV (parse headers, suggest mapping) |
| POST | `/api/leads/import` | Import CSV (bulk insert with error report) |
| GET | `/api/campaigns` | List campaigns |
| POST | `/api/campaigns` | Create campaign (draft) |
| GET | `/api/campaigns/[id]` | Get campaign detail |
| PATCH | `/api/campaigns/[id]` | Update campaign (name, filter, retry config) |
| DELETE | `/api/campaigns/[id]` | Delete draft campaign |
| POST | `/api/campaigns/[id]/launch` | Launch campaign (7 guards) |
| POST | `/api/campaigns/[id]/pause` | Pause running campaign |
| POST | `/api/campaigns/[id]/cancel` | Cancel campaign |
| GET | `/api/calls` | List calls for tenant |
| GET | `/api/calls/[callId]` | Get call detail (transcript, recording, gathered data) |
| GET | `/api/calls/[callId]/recording` | Get recording URL |
| GET | `/api/documents` | List knowledge base documents |
| POST | `/api/documents` | Upload document (proxied to Dograh KB) |
| GET | `/api/documents/[docId]` | Get document detail |
| DELETE | `/api/documents/[docId]` | Delete document |
| GET | `/api/agent` | Get agent profile |
| PUT | `/api/agent` | Update agent profile (name, goal, language, voice) |
| POST | `/api/agent/test-call` | Trigger test call via Dograh |
| POST | `/api/onboarding` | Complete onboarding (create tenant) |

### 7.3 Admin API Routes

All require `requireStaffApi()` — session with `isStaff: true`.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/tenants` | List all tenants |
| GET | `/api/admin/tenants/[id]` | Get tenant detail (includes Dograh mapping) |
| PATCH | `/api/admin/tenants/[id]` | Update tenant fields |
| POST | `/api/admin/tenants/[id]/approve` | Approve tenant (pending_approval → provisioning) |
| POST | `/api/admin/tenants/[id]/map` | Map Dograh org/API key/workflow to tenant |
| POST | `/api/admin/tenants/[id]/provision` | Run provisioning state machine |
| POST | `/api/admin/tenants/[id]/pause` | Pause tenant account |
| POST | `/api/admin/tenants/[id]/resume` | Resume paused tenant |
| POST | `/api/admin/impersonate` | Set impersonation cookie |

### 7.4 Internal/Webhook Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/webhooks/dograh` | HMAC/Bearer | Receive Dograh webhook events |
| POST | `/api/jobs/process-inbox` | Internal | Process pending webhook inbox entries |
| POST | `/api/jobs/reconcile` | Internal | Reconcile campaign counters |

---

## 8. Frontend Architecture

### 8.1 Route Groups

Next.js route groups organize pages by auth requirement:

| Group | Layout | Auth Requirement | Sidebar |
|-------|--------|-----------------|---------|
| `(public)` | Centered card | None (redirect away if logged in) | None |
| `(onboarding)` | Centered full-page | Session required, no tenant needed | None |
| `(app)` | AppSidebar + main content | Session + active tenant | AppSidebar |
| `(admin)` | AdminSidebar + main content | Session + isStaff | AdminSidebar |

### 8.2 Key UI Patterns

**Client-side auth flow** (login/signup pages):
```typescript
// src/app/(public)/login/page.tsx
const router = useRouter();
const [loading, setLoading] = useState(false);

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setLoading(true);
  try {
    const result = await signIn.email({ email, password });
    if (result.error) {
      setError(result.error.message ?? "Invalid credentials");
      setLoading(false);
    } else {
      router.push("/dashboard");  // explicit redirect on success
    }
  } catch {
    setError("Something went wrong. Please try again.");
    setLoading(false);
  }
}
```

**Loading states**: All submit buttons use `Loader2` spinner from lucide-react with `animate-spin`:
```tsx
<Button disabled={loading}>
  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  {loading ? "Signing in..." : "Sign in"}
</Button>
```

**Onboarding wizard**: 2-step form (company details → compliance/calling hours). Uses React state to track step number. Submits via `fetch('/api/onboarding', ...)` then redirects to `/pending`.

**Navigation guard**: `getTenantContext()` (server component helper) redirects:
- No session → `/login`
- Session but no tenant → `/onboarding`
- Tenant status not `live`/`ready` → `/pending`

### 8.3 Component Library

Built on shadcn/ui (Base UI primitives + Tailwind):

| Component | File | Usage |
|-----------|------|-------|
| Button | `ui/button.tsx` | All clickable actions |
| Card | `ui/card.tsx` | Content containers (auth cards, settings sections) |
| Dialog | `ui/dialog.tsx` | Modals (add lead, confirm actions) |
| Input / Label | `ui/input.tsx`, `ui/label.tsx` | Form fields |
| Tabs | `ui/tabs.tsx` | Campaign detail sections |
| Badge | `ui/badge.tsx` | Status indicators |
| StatusBadge | `ui/status-badge.tsx` | Lead/call status with color coding |
| Skeleton | `ui/skeleton.tsx` | Loading placeholders |
| Sonner | `ui/sonner.tsx` | Toast notifications |
| Sheet | `ui/sheet.tsx` | Mobile sidebar drawer |
| DropdownMenu | `ui/dropdown-menu.tsx` | Action menus |

### 8.4 Data Fetching

All data fetching uses server components with `fetch()` or Drizzle queries directly. Client components use `useSession()` for auth state and `fetch('/api/...')` for mutations.

---

## 9. Cloud Infrastructure

### 9.1 GCP Project

| Setting | Value |
|---------|-------|
| Project ID | `tevrix-ecom-care` |
| Project Number | `124346574650` |
| Region | `asia-south1` (Mumbai) |

### 9.2 Cloud Run Service

| Setting | Value |
|---------|-------|
| Service Name | `tevrix-crm` |
| Image | `asia-south1-docker.pkg.dev/tevrix-ecom-care/voice-agents/tevrix-crm:v7` |
| Port | 8080 |
| Memory | 512 MiB (default) |
| CPU | 1 vCPU |
| Min Instances | 0 (scale to zero) |
| Max Instances | 100 |
| Concurrency | 80 |

**Environment variables** (set on Cloud Run service):

| Variable | Source | Description |
|----------|--------|-------------|
| `DATABASE_URL` | Secret Manager | `postgresql://user:pass@/db?host=/cloudsql/connection` |
| `BETTER_AUTH_SECRET` | Secret Manager | 32+ char random secret |
| `BETTER_AUTH_URL` | Plain | `https://tevrix-crm-...run.app` |
| `NEXT_PUBLIC_APP_URL` | Build arg | Baked into client JS at build time |
| `DOGRAH_API_BASE_URL` | Plain | `https://voice.tevrixai.com` |
| `CRM_ENCRYPTION_KEY` | Secret Manager | 32-byte base64 AES key |

### 9.3 Cloud SQL

| Setting | Value |
|---------|-------|
| Instance | `tevrix-crm-db` |
| Connection | `tevrix-ecom-care:asia-south1:tevrix-crm-db` |
| Engine | PostgreSQL 15 |
| Tier | db-f1-micro |
| Access | Cloud Run via Unix socket (`/cloudsql/...`) |

### 9.4 Dockerfile (Multi-Stage Build)

```dockerfile
# Stage 1: Install dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build Next.js
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"  # placeholder
ENV BETTER_AUTH_SECRET="build-time-placeholder-secret-32-chars!!"
ENV BETTER_AUTH_URL=$NEXT_PUBLIC_APP_URL
ENV DOGRAH_API_BASE_URL="https://voice.tevrixai.com"
ENV NODE_ENV="production"
RUN npm run build

# Stage 3: Production runtime
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
ENV PORT=8080 HOSTNAME=0.0.0.0
EXPOSE 8080
CMD ["node", "server.js"]
```

Key: `output: "standalone"` in `next.config.ts` makes Next.js produce a self-contained `server.js` — no `node_modules` needed at runtime (reduces image from ~1GB to ~150MB).

### 9.5 Cloud Build Pipeline (`cloudbuild.yaml`)

```yaml
steps:
  - name: gcr.io/cloud-builders/docker
    args:
      - build
      - --build-arg
      - NEXT_PUBLIC_APP_URL=${_APP_URL}
      - -t
      - asia-south1-docker.pkg.dev/$PROJECT_ID/voice-agents/tevrix-crm:$_TAG
      - .
images:
  - asia-south1-docker.pkg.dev/$PROJECT_ID/voice-agents/tevrix-crm:$_TAG
substitutions:
  _APP_URL: https://app.tevrixai.com
  _TAG: ${SHORT_SHA}
options:
  machineType: E2_HIGHCPU_8
timeout: 1200s
```

**Deploy command:**
```bash
# Build
gcloud builds submit --config=cloudbuild.yaml --region=asia-south1 \
  --substitutions="_TAG=v7,_APP_URL=https://tevrix-crm-...run.app" .

# Deploy
gcloud run services update tevrix-crm --region=asia-south1 \
  --image=asia-south1-docker.pkg.dev/tevrix-ecom-care/voice-agents/tevrix-crm:v7
```

### 9.6 Dograh Engine (GCE VM)

| Setting | Value |
|---------|-------|
| Host | `voice.tevrixai.com` |
| Version | Dograh v1.34.0 (stock OSS) |
| VM Type | e2-standard-4 |
| Services | API (FastAPI), Pipecat workers, Redis, PostgreSQL, MinIO |
| Deployment | docker-compose on the VM |

The Dograh engine is a **stock** deployment — no custom code changes. All CRM-specific behavior lives in the CRM codebase.

---

## 10. Security Architecture

### 10.1 Encryption at Rest

**Algorithm:** AES-256-GCM (authenticated encryption)

```typescript
// src/lib/crypto/secrets.ts
const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;   // 96-bit IV (NIST recommendation)
const TAG_LENGTH = 16;  // 128-bit auth tag

function encryptSecret(plaintext: string): string {
  const key = Buffer.from(process.env.CRM_ENCRYPTION_KEY!, "base64");
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return "enc:v1:" + Buffer.concat([iv, encrypted, tag]).toString("base64");
}
```

**What's encrypted:**
- `tenant.dograhApiKeyCiphertext` — Dograh API key
- `tenant.dograhWebhookSecret` — Webhook HMAC secret

**Format:** `enc:v1:` + base64(12-byte IV | ciphertext | 16-byte auth tag)

**Key management:** `CRM_ENCRYPTION_KEY` is a 32-byte key stored in GCP Secret Manager, injected as an environment variable at runtime.

### 10.2 Webhook Authentication

Two methods supported (tenant chooses during mapping):

**HMAC-SHA256:**
```
x-webhook-signature: <hex-encoded HMAC of raw request body>
```
Verified with timing-safe comparison (`crypto.timingSafeEqual`).

**Bearer Token:**
```
Authorization: Bearer <webhook-secret>
```
Also verified with timing-safe comparison.

### 10.3 Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| Auth (login/signup) | 20 requests | 60 seconds per IP |
| Webhooks | 600 requests | 60 seconds per IP |
| CSV Import | 10 uploads | 60 minutes per tenant |

Implementation: sliding-window in-memory counter (`src/lib/rate-limit.ts`).

### 10.4 Input Validation

- **Phone numbers:** Normalized to E.164 via `normalizePhone()` (India-first: `+91` prefix assumed for 10-digit numbers)
- **Environment variables:** Validated at startup with Zod via `@t3-oss/env-nextjs`
- **API inputs:** Validated in each route handler before database operations
- **CSV files:** Parsed with RFC-4180 compliant parser, per-row validation

### 10.5 Audit Trail

All administrative actions are logged to `auditLog` table:
- `tenant.approve` — who approved, when
- `tenant.map` — before/after Dograh credentials (encrypted values only)
- `tenant.provision` — step results, pass/fail
- `tenant.pause` / `tenant.resume` — status transitions

---

## 11. Data Flows

### 11.1 User Signup → First Campaign Call

```
                    USER                          CRM                           DOGRAH
                      │                            │                              │
                      │  1. POST /signup            │                              │
                      │───────────────────────────▶│                              │
                      │                            │ Create user + session        │
                      │  ◀─ redirect /onboarding   │                              │
                      │                            │                              │
                      │  2. POST /api/onboarding   │                              │
                      │───────────────────────────▶│                              │
                      │                            │ Create org + tenant          │
                      │                            │ (status: pending_approval)   │
                      │  ◀─ redirect /pending      │                              │
                      │                            │                              │
                   STAFF                           │                              │
                      │  3. POST /admin/.../approve│                              │
                      │───────────────────────────▶│                              │
                      │                            │ status → provisioning        │
                      │                            │                              │
                      │  4. POST /admin/.../map    │                              │
                      │───────────────────────────▶│                              │
                      │                            │ Store encrypted API key,     │
                      │                            │ orgId, workflowId, secret    │
                      │                            │                              │
                      │  5. POST /admin/.../provision                             │
                      │───────────────────────────▶│                              │
                      │                            │──── verifyKey() ───────────▶│
                      │                            │◀─── 200 OK ────────────────│
                      │                            │ status → ready → live       │
                      │                            │                              │
                    USER                           │                              │
                      │  6. POST /api/leads        │                              │
                      │───────────────────────────▶│                              │
                      │                            │ Insert lead (E.164 phone)   │
                      │                            │                              │
                      │  7. POST /api/campaigns    │                              │
                      │───────────────────────────▶│                              │
                      │                            │ Create draft campaign        │
                      │                            │                              │
                      │  8. POST /.../launch       │                              │
                      │───────────────────────────▶│                              │
                      │                            │ Guards: quota, hours, DNC   │
                      │                            │──── createCampaign() ──────▶│
                      │                            │──── startCampaign() ───────▶│
                      │                            │ status → running             │
                      │                            │                              │
                      │                            │         ENGINE DIALS         │
                      │                            │                              │
                      │                            │◀─── POST /webhooks/dograh ──│
                      │                            │ Verify HMAC → insert inbox  │
                      │                            │                              │
                      │                            │ [projector runs]             │
                      │                            │ • Upsert call record         │
                      │                            │ • Update lead status         │
                      │                            │ • Bump campaign counters     │
                      │                            │ • Bump usage ledger          │
                      │                            │                              │
                      │  9. GET /api/calls         │                              │
                      │───────────────────────────▶│                              │
                      │  ◀─ Call list with results │                              │
```

### 11.2 Webhook Processing Pipeline

```
Dograh Engine
     │
     │  POST /api/webhooks/dograh
     │  Headers: x-webhook-signature or Authorization: Bearer
     │  Body: { event_type, external_id, data: { run_id, phone, status, ... } }
     ▼
┌─────────────────────────────────────────┐
│          WEBHOOK HANDLER                │
│  1. Rate limit (600/min)                │
│  2. Parse payload (Format 1 or 2)       │
│  3. Resolve tenant by org ID            │
│  4. Verify HMAC / Bearer (timing-safe)  │
│  5. INSERT webhookInbox (idempotent)    │
│  6. Return 202 Accepted                 │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│          WEBHOOK INBOX TABLE            │
│  status: "pending"                      │
│  source: "dograh"                       │
│  externalId: workflow_run_id            │
│  payload: raw webhook body              │
└────────────────┬────────────────────────┘
                 │
                 │  POST /api/jobs/process-inbox (background job)
                 ▼
┌─────────────────────────────────────────┐
│          PROJECTOR                      │
│  1. Set inbox status → "processing"     │
│  2. Resolve tenant (3-level fallback)   │
│  3. Map disposition → outcome           │
│  4. UPSERT calls (by dograhRunId)       │
│  5. UPDATE lead status (by phone)       │
│  6. INCREMENT campaign counters         │
│  7. UPSERT usage ledger (YYYY-MM)       │
│  8. Set inbox status → "processed"      │
└─────────────────────────────────────────┘
```

### 11.3 Encryption Flow

```
Admin enters API key "sk_live_abc123"
          │
          ▼
    encryptSecret("sk_live_abc123")
          │
          ├─ Generate random 12-byte IV
          ├─ AES-256-GCM encrypt with CRM_ENCRYPTION_KEY
          ├─ Append 16-byte auth tag
          ▼
    "enc:v1:base64(iv + ciphertext + tag)"
          │
          ▼
    Stored in tenant.dograhApiKeyCiphertext
          │
          │  ... later, when making API call ...
          │
          ▼
    decryptSecret("enc:v1:base64(...)")
          │
          ├─ Decode base64
          ├─ Split: iv (12) | ciphertext | tag (16)
          ├─ AES-256-GCM decrypt + verify tag
          ▼
    "sk_live_abc123"  →  passed to DograhClient
```

---

## Appendix: Environment Variables

### Server-Side (runtime)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (includes Cloud SQL socket path) |
| `BETTER_AUTH_SECRET` | Yes | 32+ char secret for session signing |
| `BETTER_AUTH_URL` | Yes | Full URL of the CRM (for cookie domain, CORS) |
| `DOGRAH_API_BASE_URL` | Yes | Dograh engine URL (e.g. `https://voice.tevrixai.com`) |
| `CRM_ENCRYPTION_KEY` | Yes (prod) | 32-byte base64 AES key for secret encryption |
| `WEBHOOK_SKIP_VERIFICATION` | No | Set to `"true"` to skip HMAC verification (dev only) |

### Client-Side (build-time)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | Yes | Public-facing URL. Baked into client JS. Requires rebuild to change. |

---

*Last updated: 2026-06-13 — Tevrix CRM v7, Dograh v1.34.0*
