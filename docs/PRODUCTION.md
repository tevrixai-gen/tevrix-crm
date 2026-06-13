# Tevrix AI — Production Architecture & Deployment

> Last updated: 2026-06-13 · GCP project: `tevrix-ecom-care` · Account: tevrixai@gmail.com · Region: `asia-south1` (Mumbai)

## 1. System overview

Two independently deployed systems, integrated only through Dograh's public API + webhooks
(per `FORK_DELTA.md` policy: zero fork delta, stock engine images).

```
                        ┌──────────────────────────────────────────────┐
  Client browser ──────▶│  Tevrix CRM  (Next.js 16, Cloud Run)         │
  app.tevrixai.com      │  - better-auth (sessions, orgs, staff)       │
                        │  - Leads / Campaigns / Conversations / KB UI │
                        │  - Admin console (approve→map→provision)     │
                        └──────┬───────────────────────┬───────────────┘
                               │ unix socket           │ HTTPS (API key per tenant)
                               ▼                       ▼
                  ┌────────────────────┐   ┌───────────────────────────────┐
                  │ Cloud SQL PG 17    │   │  Dograh Engine (stock OSS)    │
                  │ tevrix-crm-db      │   │  voice.tevrixai.com           │
                  │ db: tevrix_crm     │   │  GCE VM dograh-prod           │
                  └────────────────────┘   │  e2-standard-4, asia-south1-a │
                               ▲           │  34.100.152.166 (static IP)   │
                               │ webhooks  │  docker-compose remote profile│
                               └───────────│  nginx + api + ui + postgres  │
                                           │  + redis + minio + coturn     │
                                           └───────────┬───────────────────┘
                                                       │ SIP/media
                                                       ▼
                                                 Plivo (telephony)
```

## 2. Components

### 2.1 Dograh Engine (voice core) — DO NOT REBUILD, ONLY MAP
| Item | Value |
| --- | --- |
| URL | https://voice.tevrixai.com (health: `/api/v1/health`) |
| Host | GCE VM `dograh-prod`, zone `asia-south1-a`, e2-standard-4 |
| Static IP | 34.100.152.166 (`dograh-static-ip`) |
| Images | `dograhai/dograh-api:latest`, `dograh-ui:latest` (Docker Hub, stock) |
| Stack | docker-compose `remote` profile: nginx (TLS), api, ui, pgvector PG17, redis, minio, coturn (TURN/WebRTC) |
| Version | 1.34.0 (oss mode, local auth, TURN enabled) |
| Upgrade | `docker compose pull && docker compose up -d` (see FORK_DELTA.md runbook) |

Built-in engine features the CRM must *map to*, never reimplement:
retry/redial policies, campaign scheduling, workflow builder, STT/TTS/LLM config,
knowledge base RAG pipeline, telephony (Plivo/Twilio), recordings, transcripts, webhooks.

### 2.2 Tevrix CRM (client + admin frontend, backend-for-frontend)
| Item | Value |
| --- | --- |
| URL | https://app.tevrixai.com (Cloud Run direct: https://tevrix-crm-124346574650.asia-south1.run.app) |
| Runtime | Cloud Run `tevrix-crm`, asia-south1, 512Mi/1cpu, min 1 / max 3 instances |
| Image | `asia-south1-docker.pkg.dev/tevrix-ecom-care/voice-agents/tevrix-crm:<tag>` |
| Service account | `crm-run-sa@tevrix-ecom-care.iam.gserviceaccount.com` (cloudsql.client + secret accessor only) |
| Framework | Next.js 16 (standalone output), React 19, Tailwind v4, shadcn/ui, drizzle ORM, better-auth |

### 2.3 CRM database
| Item | Value |
| --- | --- |
| Instance | Cloud SQL `tevrix-crm-db`, PostgreSQL 17, db-g1-small, 10GB SSD, zonal |
| Connection | unix socket `/cloudsql/tevrix-ecom-care:asia-south1:tevrix-crm-db` (Cloud Run connector) |
| Database / user | `tevrix_crm` / `crm_app` |
| Backups | daily 21:00 UTC, 7 retained |
| Migrations | drizzle (`drizzle/migrations/`), run via temporarily authorized IP + `npm run db:migrate` |

### 2.4 Secrets (GCP Secret Manager)
| Secret | Purpose |
| --- | --- |
| `crm-database-url` | postgres.js URL (socket form: `postgresql://crm_app:…@localhost/tevrix_crm?host=/cloudsql/…`) |
| `crm-better-auth-secret` | better-auth session signing |
| `crm-db-password` | raw DB password (operator use: migrations) |

Runtime env (non-secret): `BETTER_AUTH_URL=https://app.tevrixai.com`,
`NEXT_PUBLIC_APP_URL=https://app.tevrixai.com` (build-time inlined),
`DOGRAH_API_BASE_URL=https://voice.tevrixai.com`.

## 3. Build & deploy

```powershell
# Build (Cloud Build, ~2 min) — bump _TAG each release
cd tevrix-crm
gcloud builds submit --config=cloudbuild.yaml --region=asia-south1 --substitutions=_TAG=vN .

# Deploy
gcloud run deploy tevrix-crm --region=asia-south1 `
  --image=asia-south1-docker.pkg.dev/tevrix-ecom-care/voice-agents/tevrix-crm:vN

# Migrations (when schema changed)
gcloud sql instances patch tevrix-crm-db --authorized-networks=<your-ip>/32
$env:DATABASE_URL="postgresql://crm_app:<pw>@<sql-public-ip>:5432/tevrix_crm?sslmode=require"
npm run db:migrate
gcloud sql instances patch tevrix-crm-db --clear-authorized-networks
```

## 4. Domains & TLS
| Domain | Target | TLS |
| --- | --- | --- |
| voice.tevrixai.com | A → 34.100.152.166 (VM nginx) — **live** | certs on VM (`setup_custom_domain.sh`) |
| app.tevrixai.com | A → **34.8.64.233** (`crm-lb-ip`: HTTPS LB → serverless NEG → Cloud Run) | Google-managed cert `crm-cert` (activates after DNS cutover) |

**DNS action required**: change the `app.tevrixai.com` A record (currently pointing at
Vercel 64.29.17.x) to `34.8.64.233`. Port 80 redirects to HTTPS. The managed cert
provisions automatically ~15–60 min after DNS propagates.

## 5. Tenant lifecycle (production flow)
1. Client signs up at app.tevrixai.com → org + tenant (`created` → `pending_approval`)
2. Staff (`user.is_staff=true`) opens `/admin` → reviews → **Approve**
3. Staff maps tenant: Dograh org ID + API key (created in voice.tevrixai.com UI) + workflow template ID
4. **Run Provisioning** → verifies key, clones workflow, applies variables, registers webhook → `live`
5. Client: import leads → create campaign → launch → engine dials via Plivo → webhooks
   (`call.completed` etc.) → CRM inbox → projector updates leads/calls/dashboards

## 6. Ops runbook
- **Logs (CRM)**: `gcloud run services logs read tevrix-crm --region=asia-south1`
- **Logs (engine)**: SSH to `dograh-prod` → `docker compose logs api --tail 200`
- **Engine health**: https://voice.tevrixai.com/api/v1/health
- **Roll back CRM**: `gcloud run services update-traffic tevrix-crm --to-revisions=<rev>=100`
- **DB console**: `gcloud sql connect tevrix-crm-db --user=crm_app --database=tevrix_crm`
- **Costs (approx/mo)**: VM e2-standard-4 ≈ $100, Cloud SQL g1-small ≈ $25, Cloud Run min-1 ≈ $10, LB ≈ $18

## 7. Hardening backlog
- [ ] AES-GCM encryption for tenant Dograh API keys (currently `plain:` prefix; Cloud SQL is encrypted at rest)
- [ ] Transactional email (Resend/SES): password reset, approval notices
- [ ] Uptime checks + alerting (Cloud Monitoring) on `/api/v1/health` and CRM `/login`
- [ ] TRAI DND scrubbing + DLT enforcement before tenant go-live
- [ ] Webhook outbound (lead.qualified) + Sheets/Zoho integrations (Phase 3)
