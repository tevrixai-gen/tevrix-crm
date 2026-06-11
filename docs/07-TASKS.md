# 07 — Build Plan & Task List

Solo-developer estimates. Each phase ends **shippable** — never more than a few days from
a deployable state. Total: ~4–5 weeks to pilot-ready.

---

## Phase 0 — Foundation (2–3 days)

| # | Task | Acceptance |
| --- | --- | --- |
| 0.1 | Create `tevrix-crm` git repo (move this folder out of the Dograh repo) | repo with CI badge |
| 0.2 | Scaffold Next.js 15 + TS + Tailwind + shadcn/ui + ESLint/Prettier | `npm run dev` clean |
| 0.3 | Drizzle + local docker Postgres + migration scripts | `db:migrate`, `db:seed` work |
| 0.4 | better-auth: email/password + organizations + admin plugins; `is_staff` flag | signup/login/session E2E passes |
| 0.5 | GitHub Actions: lint, typecheck, unit, integration (pg service container) | red/green on PR |
| 0.6 | GCP: Cloud SQL instance (staging), Cloud Run service, Secret Manager, deploy workflow | staging URL serves the app |
| 0.7 | Domain `app.tevrixai.com` → Cloud Run (staging on subdomain) | TLS green |

## Phase 1 — Tenancy, onboarding, admin queue (3–4 days) → SELLABLE DEMO

| # | Task | Acceptance |
| --- | --- | --- |
| 1.1 | `tenants` table + status machine + scoped repo layer | unit tests on transitions |
| 1.2 | Signup → create org+tenant (status `created`) → `/onboarding` wizard (profile, DLT, working hours) | wizard saves; submit → `pending_approval` |
| 1.3 | `/pending` gate + `(app)` layout guards (server-side status routing) | guard matrix tested |
| 1.4 | Admin shell `(admin)` + approval queue + tenant detail | staff sees queue; non-staff 404 |
| 1.5 | Manual mapping form: dograh_org_id, workflow_id, API key (KMS-encrypt on write) | key never returned in any response |
| 1.6 | Approve / pause / resume actions + `audit_log` on every mutation | audit rows asserted in tests |
| 1.7 | Impersonation (scoped session + banner + audit) | E2E: staff views tenant, audit row exists |
| 1.8 | Tenant-isolation adversarial test generator wired into CI | hard gate green |

## Phase 2 — Dograh seam (4–5 days)

| # | Task | Acceptance |
| --- | --- | --- |
| 2.1 | `lib/dograh/client.ts` typed client + recorded-fixture contract tests | all methods covered |
| 2.2 | Staging Dograh org + template workflow ("Real Estate Qualifier en-IN") created in engine UI | documented in admin runbook |
| 2.3 | Provisioning state machine: verify key → clone workflow → apply variables → register webhook → ready; `provisioning_runs` rows; Cloud Tasks retries; admin Retry button | kill it mid-run → retry completes idempotently |
| 2.4 | `POST /api/webhooks/dograh`: HMAC verify, inbox insert, 202, async processing | replay-safe (unique external_id) |
| 2.5 | Projector: run readback via API → calls/lead/campaign/usage updates in one txn | integration tests |
| 2.6 | Reconciliation job (Cloud Scheduler 10 min): sweep stale `calling` rows | missed-webhook test heals |
| 2.7 | Agent editor `/agent` + publish (variables → engine) + voices list | publish reflects in engine |
| 2.8 | **Test call** button end-to-end on staging engine | real phone rings, call lands in `calls` |
| 2.9 | `@live` smoke suite vs staging engine (the upgrade gate) | one command, < 5 min |

## Phase 3 — Leads & campaigns (4–5 days)

| # | Task | Acceptance |
| --- | --- | --- |
| 3.1 | Phone normalization lib (Indian formats → E.164) | exhaustive unit tests |
| 3.2 | CSV import: GCS signed upload → parse → column mapping UI → preview → batch processing → error report | 10k-row file < 60 s; dupes skipped+reported |
| 3.3 | Leads table: filters, search, status edit, DNC toggle, manual add | p95 < 300 ms at 50k leads |
| 3.4 | Campaign builder (3 steps: who/what/when) + draft save | validates window vs working hours |
| 3.5 | Launch: quota check → working-hours check → DNC filter → enqueue to engine (respect max_concurrency) | over-quota blocked with clear message |
| 3.6 | Campaign monitor: counters, outcome donut, in-flight ticker (polling), pause/cancel | counters match projector |
| 3.7 | Retry logic for no-answer (attempts from retry_config) | attempts capped, recorded |

## Phase 4 — Calls & dashboard (3–4 days)

| # | Task | Acceptance |
| --- | --- | --- |
| 4.1 | Calls list + filters | |
| 4.2 | **Call detail hero**: player + synced transcript + summary + gathered_data + actions (qualified / follow-up / DNC) | actions update lead instantly |
| 4.3 | Signed recording URLs on demand | URLs expire; never stored client-side |
| 4.4 | Dashboard: 4 stat cards, needs-attention list, 7-day chart | reads local tables only |
| 4.5 | Usage ledger + plan quota surfacing (client + admin) | matches projector output |
| 4.6 | Admin fleet view: calls today, error rate, failed webhooks, cost/tenant | |

## Phase 5 — Knowledge base self-serve (2–3 days)

| # | Task | Acceptance |
| --- | --- | --- |
| 5.1 | Document upload → GCS → engine KB ingestion via tenant key | status reaches `ready` |
| 5.2 | Processing-status polling + failed-state retry | |
| 5.3 | Delete document (CRM + engine) | |

## Phase 6 — Hardening & pilot launch (3–4 days)

| # | Task | Acceptance |
| --- | --- | --- |
| 6.1 | Playwright E2E golden path in CI | green gate |
| 6.2 | k6 webhook burst + dashboard load test | zero lost events |
| 6.3 | Sentry, structured logs, alert on webhook failure rate | test alert fires |
| 6.4 | Cloud SQL backups + restore drill documented & executed once | restore verified |
| 6.5 | Rate limiting (auth + import + webhooks) | |
| 6.6 | Prod environment (Cloud Run + Cloud SQL + secrets) + promote workflow | prod URL live |
| 6.7 | `docs/manual-smoke.md` run on prod with a real test call | recording audible |
| 6.8 | Onboard first pilot tenant (real client) | first live campaign completes |

---

## Parallel track — Dograh engine housekeeping (independent, ~1 day)

| # | Task |
| --- | --- |
| D.1 | Confirm prod VM runs stock published images; document the upgrade runbook (`pull` → smoke → done) |
| D.2 | Decide fate of the local fork repo: keep as read-reference + contribution base, near-zero delta (see `FORK_DELTA.md` in the fork repo) |
| D.3 | Create the staging engine instance/org used by contract tests (can be a second compose stack on the VM or local) |
| D.4 | Retire the Supabase project once nothing references it (export anything needed first) |

## Standing decisions (so future-you doesn't relitigate)

1. **Stock Dograh, zero fork delta.** The fork repo is reference only. Any feature gap →
   first try API composition; the additive `partner.py` router is the documented last resort.
2. **One IdP (better-auth).** No second token system, ever.
3. **Mirror, don't query.** Client pages never call the engine synchronously.
4. **Every admin mutation is audited.** No exceptions.
5. **404 for foreign-tenant resources.** Never 403.
