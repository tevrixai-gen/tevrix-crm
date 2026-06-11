# 02 — Architecture Blueprint

## Topology (GCP project `tevrix-ecom-care`, region `asia-south1`)

```
                    ┌─────────────────────────────────────────────┐
  app.tevrixai.com  │  Cloud Run: tevrix-crm (Next.js full-stack) │
  ───────────────►  │  • client app + admin console + API routes  │
                    └──────┬──────────────┬───────────────┬───────┘
                           │              │               │
                ┌──────────▼───┐  ┌───────▼──────┐  ┌─────▼──────────┐
                │ Cloud SQL    │  │ GCS bucket   │  │ Cloud Tasks    │
                │ Postgres 17  │  │ crm-uploads  │  │ + Scheduler    │
                │ tevrix-crm-db│  └──────────────┘  └────────────────┘
                └──────────────┘
                           ▲ mirror (webhooks)        │ API calls (per-tenant key)
                           │                          ▼
                    ┌──────┴───────────────────────────────────────┐
 voice.tevrixai.com │  dograh-prod VM — STOCK Dograh OSS images    │
  ───────────────►  │  (engine: workflows, telephony, runs, KB)    │
                    └──────────────────────────────────────────────┘
```

- **One new deployable**: the CRM is a single Next.js app on Cloud Run (min instances 1 so
  webhooks are never cold). Internal Dograh UI remains the staff ops tool at
  `voice.tevrixai.com` — clients never see it.
- **Secrets**: GCP Secret Manager for app secrets; per-tenant Dograh API keys stored as
  KMS-encrypted columns (`dograh_api_key_ciphertext`) so they scale per row.
- **Environments**: `staging` and `prod` Cloud Run services + separate Cloud SQL databases.
  Local dev = docker Postgres. **Never share a database across environments** (lesson learned:
  the Supabase dev DB vs prod VM confusion).

## The #1 design rule: ZERO Dograh fork delta

Your stated friction is Dograh upgrades. The architecture eliminates it:

1. **Run stock Dograh images.** The prod VM already runs Dograh's published images
   (it reports v1.34.0 while the local fork is v1.32.0 — fork changes never shipped).
   Keep it that way. Upgrades become `docker compose pull && up` — zero merge work.
2. **The CRM consumes only Dograh's public API surface**, authenticated by per-tenant
   API keys (Dograh supports `X-API-Key` natively).
3. **Dograh → CRM events use Dograh's existing post-run webhook integration** (stock
   feature): each tenant workflow gets a webhook pointing at the CRM. The webhook is a
   *notification*; on receipt the CRM **reads the run back via the API** (source of truth).
   This "thin ping + API readback" pattern survives Dograh payload changes across versions.
4. **Org provisioning stays manual-assisted** (2 minutes of staff time per tenant in the
   Dograh UI: create org, copy API key into the CRM admin mapping form). Everything after
   that — workflow cloning, variable updates, KB upload, campaign start — is automated
   through the tenant's API key. If tenant volume ever makes those 2 minutes painful,
   *then* add one additive `partner.py` router to the fork (documented escape hatch in
   `FORK_DELTA.md`), not before.

**Version-pinning discipline**: the CRM's Dograh client is written against a pinned engine
version. Upgrading the engine = bump VM images on staging → run the contract-test suite
(06-TESTING) → bump prod. The CRM never imports Dograh code.

## Auth — one identity provider, three planes, zero token handshakes

The old design failed because two JWT systems verified each other's tokens. The new design
has **better-auth, owned by the CRM**, and no human token ever crosses to Dograh:

| Plane | Who | Mechanism |
| --- | --- | --- |
| **Tenant** | Client users | better-auth email/password sessions; organizations plugin maps user → tenant + role (`owner/admin/member`) |
| **Staff** | Tevrix admins | Same login, better-auth admin plugin role `staff`; admin console routes hard-gate on it |
| **Machine** | CRM server ↔ Dograh | Per-tenant Dograh API key, server-side only; webhook ingress verified by per-tenant HMAC secret |

- The browser **never** talks to Dograh. All engine calls go through CRM route handlers.
- **Impersonation**: staff "view as tenant" mints a short-lived scoped session and writes an
  `audit_log` row (actor, tenant, reason, expiry). No password sharing, ever.

## Provisioning — observable state machine (never fire-and-forget)

Lesson learned: the old `background_tasks.add_task` that silently never ran.

```
created → provisioning → ready → pending_approval → live
                │                                     │
                ▼                                     ▼
        provisioning_failed (error + Retry)        paused (kill switch)
```

Steps recorded per-attempt in `provisioning_runs` (step, status, error, payload):
1. Staff creates Dograh org + API key (manual, 2 min) and saves the mapping
2. CRM verifies the key (GET against the engine)
3. CRM clones the agent template workflow via API, applies tenant variables
4. CRM registers the post-run webhook for the workflow
5. CRM marks tenant `ready`; approval flips it `live`

Every step is **idempotent** (safe to retry), surfaced in the admin console with a Retry
button, and Cloud Tasks gives automatic backoff retries.

## Event flow — mirror, don't query

- `POST /api/webhooks/dograh` → verify HMAC → insert raw into `webhook_inbox`
  (unique `(source, external_id)` = idempotent replays) → enqueue processing.
- Processor reads run details from the Dograh API, projects into `calls`, updates
  `campaign` counters and `leads.status`, appends `usage_ledger`.
- **Dashboards read local tables only.** A client page load never calls Dograh live.
  Recording playback uses short-lived signed URLs fetched on demand.
- Reconciliation cron (Cloud Scheduler, every 10 min): sweep `calling` leads / running
  campaigns whose runs finished but whose webhook was missed; read back via API. Webhooks
  WILL be missed; the system self-heals.

## Tenant isolation (hard requirements)

- Every tenant-owned table carries `tenant_id`; every query goes through a scoped data-access
  layer that **requires** a tenant context — no raw table access from route handlers.
- Adversarial tests in CI: user of tenant A requests every endpoint with tenant B's ids →
  must get 404 (not 403, to prevent id probing).
- Quotas enforced at campaign launch and call enqueue.
- Kill switches: staff can pause a tenant (blocks launches + enqueues) or a single campaign.

## What this architecture refuses to repeat

1. Two auth systems verifying each other's tokens → one IdP + machine keys
2. CRM living inside the Dograh fork/UI → standalone app, **stock engine**
3. Silent provisioning → state machine with visible retries
4. Live-querying the engine for dashboards → webhook mirror + reconciliation
5. One database pretending to be three environments → strict env separation
