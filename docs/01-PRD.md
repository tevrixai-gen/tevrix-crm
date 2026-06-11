# 01 — Product Requirements (PRD)

## Product thesis

Tevrix CRM is **not a CRM in the Salesforce sense**. It is a *results console for an AI
calling workforce*. Clients bring leads; the product makes AI calls happen and surfaces
outcomes. Every screen answers two questions: **"What did my AI do for me?"** and
**"What should I do next?"**

Forbidden vocabulary in the client UI: workflow, run, pipeline, STT/TTS, LLM, webhook,
provisioning. Client-facing words: *Conversations, Campaigns, Leads, Qualified, Follow-ups,
Knowledge, Your Agent*.

## Personas

| Persona | Who | Needs |
| --- | --- | --- |
| **Client owner** | Small business (real estate, finance, services — India market), low tech literacy | Setup < 15 min, hear the agent before paying, visible ROI |
| **Client operator** (V1) | Their staff | Upload leads, listen to calls, work follow-up queues |
| **Tevrix staff (super admin)** | Panshul / future hires | Approve tenants, map agents, monitor usage & cost, intervene fast |

## The three product loops

1. **Onboarding loop** — signup → company profile → upload knowledge documents → import
   leads → **hear the agent in a test call** (the magic moment) → submit → Tevrix approves →
   live. Target: first test call within 15 minutes of signup.
2. **Campaign loop** — pick leads → pick goal → set calling window → launch → watch live →
   review outcomes → act on qualified leads.
3. **Improvement loop** — listen to calls → tweak agent (name, goal, voice, knowledge) →
   republish. This loop is what retains clients.

## MVP scope (Phase 1–4 in 07-TASKS.md)

- Email/password auth, onboarding wizard, pending-approval gate
- CSV lead import with validation, preview, and downloadable error report
- One agent per tenant (admin-mapped initially; client edits name/goal/voice/language later)
- Campaign: create → launch → monitor counters → pause/cancel
- Call log: recording playback, transcript, AI summary, disposition
- Dashboard: calls made, connect rate, qualified leads, minutes used (current period)
- Admin console: approval queue, provisioning status + retry, agent mapping, usage view,
  pause-tenant kill switch, audited impersonation

## Explicitly NOT in MVP (V1/V2 backlog)

- Multiple agents per tenant / agent template marketplace (V1)
- Self-serve knowledge-base upload to the engine (V1 — admin-assisted in MVP)
- Inbound numbers and IVR (V2)
- WhatsApp/SMS follow-up automations (V2)
- External CRM sync — HubSpot/Zoho (V2)
- Client teams, roles, invitations (V1)
- Self-serve billing/payments (V1 — manual invoicing in MVP, quotas enforced from day 1)

## India-market requirements (day 1)

- DLT entity ID + calling-party name captured at onboarding
- Calling-hours guardrails **on by default** (configurable window, default 10:00–19:00 IST,
  no Sundays) — enforced at campaign launch, not honor-system
- `do_not_call` honored everywhere: import marks, agent tool can set it, campaign queue skips it
- Languages: en-IN, hi-IN at launch; UI strings English-only in MVP

## Success metrics

| Metric | Target |
| --- | --- |
| Signup → first test call | < 15 min |
| Signup → approved+live | < 24 h (manual approval) |
| Campaign launch → first connected call | < 5 min |
| Call completed → visible in client dashboard | < 60 s |
| Tenant-isolation defects in production | 0 (hard gate, tested in CI) |

## Pricing/quota model (enforced, not billed, in MVP)

Plans: `trial` (50 calls / 100 min / 1 concurrent), `starter`, `growth` — each defines
`calls_per_month`, `minutes_per_month`, `max_concurrent`. Quota check at campaign launch
and per-call enqueue; usage visible to client and staff. Payment collection is manual
(invoice) until V1 billing.
