# Tevrix CRM

Standalone client console + admin control plane for the Tevrix AI voice
agency. Talks to the [Dograh](https://github.com/dograh-tech/dograh) voice
engine **only** through its public API and webhooks — the engine runs stock
published images and is never forked (see `FORK_DELTA.md` in the engine repo).

## Stack

- **Next.js 15** (App Router, server components) + TypeScript + Tailwind + shadcn/ui
- **better-auth** — email/password, organizations plugin (org = tenant), `is_staff` flag
- **Drizzle ORM** + PostgreSQL 17
- **Vitest** — unit suite (phone, CSV, quota, working hours, HMAC, state machines)
- Target deploy: **Cloud Run + Cloud SQL** (`asia-south1`), GCS for files,
  Cloud Tasks/Scheduler for retries and reconciliation

## Architecture in five rules

1. **One identity provider.** better-auth only. No second token system, ever.
2. **Machine boundary.** The browser never talks to Dograh. The CRM backend
   calls the engine with per-tenant API keys (`src/lib/dograh/client.ts` is
   the only module that knows engine endpoints).
3. **Mirror, don't query.** Engine events land in `webhook_inbox`
   (idempotent), a projector materializes `calls`/counters/usage, dashboards
   read local tables only. A reconciliation job heals missed webhooks.
4. **Observable provisioning.** Tenant setup is a state machine recorded in
   `provisioning_runs` — every step visible, idempotent, retryable from the
   admin console. Never fire-and-forget.
5. **Tenant isolation.** Every query is scoped by `tenant_id` derived from
   the session. Foreign-tenant resources return **404**, never 403.

## Development

```bash
docker compose up -d postgres   # Postgres 17 on :5433
npm install
npm run db:migrate              # apply Drizzle migrations
npm run dev                     # http://localhost:3001
```

`.env.local` needs: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`NEXT_PUBLIC_APP_URL`, `DOGRAH_API_BASE_URL`.

First staff user: sign up in the app, then `npx tsx scripts/seed-staff.ts`.

```bash
npm test            # unit suite
npm run typecheck   # tsc --noEmit
npm run lint
```

## Docs

| Doc | Contents |
| --- | --- |
| `docs/01-PRD.md` | Product thesis, personas, loops, MVP cut, India/DLT requirements |
| `docs/02-ARCHITECTURE.md` | Topology, auth planes, provisioning machine, event flow |
| `docs/03-DATABASE.md` | Full schema rationale |
| `docs/04-API.md` | Route surface |
| `docs/05-FRONTEND.md` | IA, screen notes, vocabulary rules |
| `docs/06-TESTING.md` | Test strategy; `@live` smoke = engine upgrade gate |
| `docs/07-TASKS.md` | Phased build plan |
| `docs/manual-smoke.md` | Per-release manual test script |

## Status

Phases 0–6 core build complete (auth, tenancy, admin console, engine seam,
leads/campaigns, calls/dashboard, knowledge base, hardening). Remaining for
production: GCP deploy (Cloud Run/SQL/GCS/Scheduler), KMS encryption for
tenant API keys, email provider for password reset, Sentry, Playwright E2E,
`@live` contract suite against a staging engine.
