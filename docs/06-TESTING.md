# 06 — Testing Strategy

Principle: the two things that kill this business are **tenant data leaking** and **calls
silently not happening / not appearing**. The test suite is weighted accordingly.

## Layers

### 1. Unit (Vitest) — fast, every push
- Phone normalization: Indian formats (`98765 43210`, `+91-98765…`, `09876…`) → E.164;
  rejects invalid
- CSV import parser: column mapping, duplicate detection, row-level error report
- Quota math: plan limits vs usage_ledger at launch and enqueue
- Working-hours guard: window/day/timezone edge cases (incl. midnight-crossing windows)
- Webhook HMAC verifier: valid, invalid, replayed, clock-skewed
- Provisioning state machine: legal/illegal transitions, idempotent re-runs
- Zod schemas: every route's input/output

### 2. Integration (Vitest + dockerized Postgres) — every push
- Route handlers against a real DB with seeded fixtures
- better-auth flows: signup, login, session, org membership, staff gate
- **Tenant isolation (adversarial, generated)**: for EVERY tenant-scoped endpoint,
  authenticated user of tenant A requests tenant B's resources → 404. This suite is
  generated from the route table so a new endpoint can't ship without it. **Hard CI gate.**
- Webhook inbox: duplicate `external_id` → single processing; malformed payload → `failed`
  row, no crash; replay endpoint reprocesses
- Projector: `call.completed` event → calls row + campaign counters + lead status +
  usage_ledger, all in one transaction
- Audit log: every admin mutation writes exactly one row

### 3. Contract tests — Dograh client
- **Recorded fixtures** (default, offline): every `lib/dograh/client.ts` method replays
  recorded engine responses; breaks loudly if our parsing drifts
- **Live smoke** (tagged `@live`, staging only): runs against a dedicated staging Dograh
  org — verifyKey, cloneWorkflow, variable update, webhook registration, one real test
  call end-to-end. **This suite IS the engine-upgrade gate**: bump engine on staging →
  run `@live` → green = safe to bump prod. This replaces fork-merge pain entirely.

### 4. E2E (Playwright) — PR gate, headless
Golden path with engine mocked at the HTTP boundary (MSW):
1. Signup → onboarding wizard → submit → `/pending`
2. Staff login → approve + map tenant → tenant becomes live
3. Import 50-lead CSV (3 bad rows → error report)
4. Create campaign → launch → mock webhook posts `call.completed` ×5
5. Calls appear in dashboard; counters correct; call detail renders transcript
6. Tenant B user logs in → sees none of it
Plus: impersonation flow, pause kill switch blocks launch.

### 5. Load sanity (k6, weekly + pre-launch)
- Webhook burst: 100 events/sec for 2 min → zero lost (inbox count = sent count)
- Dashboard p95 < 500 ms with 100k calls rows seeded

## CI/CD (GitHub Actions)

```
PR:    lint + typecheck → unit → integration (pg service) → E2E  (~6–8 min)
main:  all of the above → deploy Cloud Run staging → @live smoke vs staging engine
prod:  manual promote (gcloud run deploy with the staging-verified image)
```

- Migrations run via Drizzle on deploy, **expand → migrate → contract** pattern; never a
  destructive migration in the same release that deploys code depending on it
- Nightly: Cloud SQL automated backups (7-day PITR) + a restore drill script run monthly
- Error tracking: Sentry (server + client); alert on webhook processing failures > 1%

## Manual test script (per release, 10 min)

The Antigravity-style browser run, kept as `docs/manual-smoke.md`: real signup on staging,
real approval, real test call to a Tevrix phone, verify recording + transcript + dashboard
within 60 s. No release ships without it until E2E coverage proves itself for ~a month.
