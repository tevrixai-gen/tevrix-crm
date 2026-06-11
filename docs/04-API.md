# 04 — API Surface (Next.js route handlers)

All handlers: zod-validated input, tenant scoping via session → active organization,
errors as `{ error: { code, message } }`. Tenant routes return **404 for foreign tenant
resources** (never 403 — don't confirm existence). Staff routes hard-gate on `is_staff`.

## Auth (better-auth mounted)

```
/api/auth/*           sign-up, sign-in, sign-out, session, password reset,
                      organization management (internal use)
```

## Tenant app (client session required)

```
GET    /api/tenant                 profile + status + plan + usage snapshot
PATCH  /api/tenant                 onboarding fields (name, industry, DLT, working hours…)
POST   /api/tenant/submit          created → pending_approval (validates required fields)

GET    /api/leads                  list; filters: status, tag, batch, q; cursor pagination
POST   /api/leads                  create one (manual)
PATCH  /api/leads/:id              edit, set status / do_not_call
DELETE /api/leads/:id
POST   /api/leads/import           start CSV import: returns batch id
GET    /api/leads/import/:batchId  progress + error report download URL

GET    /api/campaigns              list with counters
POST   /api/campaigns              create draft (lead_filter, goal, schedule, concurrency)
GET    /api/campaigns/:id          detail + live counters
POST   /api/campaigns/:id/launch   quota + working-hours + DNC checks → enqueue
POST   /api/campaigns/:id/pause
POST   /api/campaigns/:id/cancel

GET    /api/calls                  list; filters: disposition, campaign, date range
GET    /api/calls/:id              detail: transcript, summary, gathered_data
GET    /api/calls/:id/recording    short-lived signed URL (fetched on click)

GET    /api/documents              list with processing status
POST   /api/documents              GCS signed upload URL + registration
DELETE /api/documents/:id

GET    /api/agent                  the tenant's agent profile
PATCH  /api/agent                  draft edits: agent_name, goal, language, voice_id
POST   /api/agent/publish          push variables to engine workflow + publish
POST   /api/agent/test-call        place one test call to a given number (quota-checked)
GET    /api/agent/voices           voice options (proxied from engine, cached)

GET    /api/dashboard/summary      period metrics: calls, connect rate, qualified, minutes
```

## Admin console (staff session required, every mutation → audit_log)

```
GET    /api/admin/tenants                    queue + filters (status)
GET    /api/admin/tenants/:id                full detail: mapping, usage, provisioning_runs
PATCH  /api/admin/tenants/:id/mapping        dograh_org_id, workflow id, API key (encrypted on write)
POST   /api/admin/tenants/:id/provision      run/retry the provisioning state machine
POST   /api/admin/tenants/:id/approve        pending_approval → live
POST   /api/admin/tenants/:id/pause          kill switch (+ /resume)
POST   /api/admin/tenants/:id/impersonate    scoped session, audited

GET    /api/admin/fleet                      cross-tenant: calls today, error rate,
                                             failed webhooks, cost per tenant
GET/POST/PATCH /api/admin/templates          agent template registry
GET    /api/admin/webhook-inbox              failed events + replay action
```

## Machine ingress

```
POST   /api/webhooks/dograh        HMAC-verified (per-tenant secret), inserts webhook_inbox,
                                   202 immediately; processing is async (Cloud Tasks)
POST   /api/jobs/reconcile         Cloud Scheduler (OIDC-authenticated): sweep stale
                                   calling/running records, read back from engine API
POST   /api/jobs/process-inbox     Cloud Tasks handler: project inbox → calls/leads/campaigns
```

## Dograh engine client (internal module, not HTTP routes)

One typed module `lib/dograh/client.ts` — the ONLY place that knows engine endpoints.
Per-tenant key injected from decrypted mapping; pinned to an engine version; covered by
contract tests (06-TESTING).

```
verifyKey()                          cheap authenticated GET
cloneWorkflow(templateId, vars)      template → tenant workflow
updateWorkflowVariables(id, vars)    agent_name, goal, language, voice
publishWorkflow(id)
registerWebhook(workflowId, url, secret)
startCalls(workflowId, batch)        enqueue outbound calls / engine campaign
getRun(runId)                        readback after webhook ping (source of truth)
getRecordingUrl(runId)
uploadKbDocument(file) / getKbStatus(ref)
listVoices()
```
