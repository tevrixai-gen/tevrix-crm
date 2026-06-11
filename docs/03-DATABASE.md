# 03 — Database Schema (Cloud SQL Postgres 17, Drizzle ORM)

Conventions: `uuid` PKs (v7), `timestamptz` everywhere, `created_at/updated_at` on all
tables (omitted below for brevity), every tenant-owned table has `tenant_id uuid NOT NULL`
with a composite index leading on it. India-specific fields carried over from the v1 schema.

## Identity (managed by better-auth, generated tables)

- `user` — id, email, name, email_verified, image, `is_staff boolean default false`
- `account` — credential storage (password hash lives here)
- `session` — sessions; impersonation sessions carry `impersonated_by`
- `organization` / `member` / `invitation` — better-auth organizations plugin.
  **`organization` = the tenant.** Our `tenants` table extends it 1:1 via `org_id`.

## tenants (extends better-auth organization)

| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| org_id | text UNIQUE NOT NULL | FK → better-auth organization |
| name | text NOT NULL | |
| industry | text | |
| website, logo_url | text | |
| status | text NOT NULL | `created · provisioning · provisioning_failed · ready · pending_approval · live · paused` |
| provisioning_error | text | last failure, shown in admin |
| timezone | text default 'Asia/Kolkata' | |
| preferred_language | text default 'en-IN' | |
| working_hours | jsonb | calling window, default 10:00–19:00 IST, no Sun |
| dlt_entity_id | text | India TRAI/DLT |
| calling_party_name | text | |
| plan_id | text FK → plans, default 'trial' | |
| plan_started_at / plan_expires_at | timestamptz | |
| dograh_org_id | bigint UNIQUE | mapping to engine |
| dograh_workflow_id | bigint | default agent workflow |
| dograh_api_key_ciphertext | bytea | KMS-encrypted tenant key |
| webhook_secret | text | per-tenant HMAC secret for inbound webhooks |

## plans

`id text PK` (`trial/starter/growth`), `name`, `price_inr numeric`,
`calls_per_month int`, `minutes_per_month int`, `max_concurrent int`, `features jsonb`.

## leads

| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| tenant_id | uuid NOT NULL | |
| full_name | text NOT NULL | |
| phone | text NOT NULL | as imported |
| phone_normalized | text NOT NULL | E.164; UNIQUE per tenant |
| email, city, state, pincode | text | |
| language | text default 'en-IN' | |
| status | text NOT NULL default 'new' | `new · queued · calling · qualified · callback · not_interested · do_not_call · completed · failed` |
| interest_score | int | 0–100, set by call analysis |
| source | text default 'import' | `import · manual · api` |
| do_not_call | boolean default false | honored at every enqueue |
| consent_given | boolean default false; consent_date timestamptz | |
| next_action_at | timestamptz | follow-up queue driver |
| last_contact_at | timestamptz | |
| import_batch_id | uuid FK | |
| external_id / external_source | text | future CRM-sync seam |
| attributes | jsonb default '{}' | vertical-specific fields (loan_type, budget…) |
| tags | text[] | |

Indexes: `(tenant_id, status)`, `UNIQUE (tenant_id, phone_normalized)`,
`(tenant_id, next_action_at)`.

## import_batches

`id`, `tenant_id`, `filename`, `gcs_path`, `total_rows int`, `valid_rows int`,
`skipped_rows int`, `error_report jsonb` (row-level errors for download),
`status` (`processing · completed · failed`), `created_by uuid`.

## campaigns

| column | type | notes |
| --- | --- | --- |
| id, tenant_id | | |
| name | text NOT NULL | |
| goal_prompt | text | client-written objective, merged into agent variables |
| agent_profile_id | uuid FK | |
| status | text | `draft · scheduled · running · paused · completed · cancelled` |
| lead_filter | jsonb | saved selection (statuses, tags, batch) |
| schedule | jsonb | window/days; validated against tenant working_hours |
| max_concurrency | int default 1 | capped by plan.max_concurrent |
| retry_config | jsonb | attempts, backoff for no-answer |
| dograh_campaign_id | bigint UNIQUE | engine handle if engine-side campaigns used |
| total / queued / completed / failed / skipped | int | counters maintained by projector |
| started_at / completed_at | timestamptz | |
| created_by | uuid | |

## campaign_leads

`id`, `campaign_id`, `lead_id`, `status` (`pending · queued · calling · done · failed · skipped`),
`attempts int default 0`, `last_call_id uuid`. `UNIQUE (campaign_id, lead_id)`.

## calls (mirror of engine runs — the read model)

| column | type | notes |
| --- | --- | --- |
| id, tenant_id | | |
| lead_id / campaign_id | uuid NULL | |
| dograh_run_id | bigint UNIQUE NOT NULL | idempotency anchor |
| direction | text | `outbound · inbound · test` |
| from_number / to_number | text | |
| state | text | `initiated · ringing · in_progress · completed · failed · no_answer · busy` |
| disposition | text | `qualified · callback · not_interested · do_not_call · voicemail · error` |
| duration_seconds | numeric | |
| recording_ref | text | engine reference; signed URL fetched on demand |
| transcript | jsonb | turns: speaker/ts/text |
| summary | text | AI summary |
| sentiment | text | |
| gathered_data | jsonb | structured extraction (budget, preferred time…) |
| cost_usd | numeric | staff-visible only |
| started_at / ended_at | timestamptz | |

Indexes: `(tenant_id, started_at DESC)`, `(tenant_id, disposition)`, `(campaign_id)`.

## call_notes (V1) — client annotations on calls

## documents (knowledge base)

`id`, `tenant_id`, `filename`, `gcs_path`, `mime`, `size_bytes`,
`status` (`uploaded · processing · ready · failed`), `error`,
`dograh_doc_ref text` (engine-side document id), `created_by`.

## agent_profiles

`id`, `tenant_id`, `display_name` ("Lead Qualifier"), `agent_name` (spoken: "Priya"),
`goal text`, `language`, `voice_id`, `template_id uuid FK → agent_templates`,
`dograh_workflow_id bigint`, `status` (`draft · published`), `published_at`.
MVP: exactly one per tenant; schema already supports many.

## agent_templates (staff-owned, no tenant_id)

`id`, `name`, `vertical`, `description`, `dograh_template_workflow_id bigint`,
`default_variables jsonb`, `active boolean`.

## usage_ledger

`id`, `tenant_id`, `period date` (month bucket), `calls_count int`, `minutes numeric`,
`cost_usd numeric`. `UNIQUE (tenant_id, period)`; incremented by the call projector.

## provisioning_runs

`id`, `tenant_id`, `step text` (`verify_key · clone_workflow · apply_variables ·
register_webhook · finalize`), `status` (`pending · running · succeeded · failed`),
`error text`, `payload jsonb`, `started_at`, `finished_at`.

## webhook_inbox

`id`, `source text` ('dograh'), `external_id text` (run id + event),
`signature_valid boolean`, `payload jsonb`, `status` (`received · processed · failed · ignored`),
`error text`, `received_at`, `processed_at`. `UNIQUE (source, external_id)` → replay-safe.

## audit_log (append-only)

`id`, `actor_user_id`, `actor_is_staff boolean`, `tenant_id`, `action text`
(`tenant.approve · tenant.pause · impersonation.start · mapping.update · campaign.launch · …`),
`target_type/target_id`, `metadata jsonb`, `created_at`. No updates, no deletes.
