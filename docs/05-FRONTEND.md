# 05 — Frontend Design

Stack: Next.js App Router, Tailwind + shadcn/ui, server components for data pages,
client components only where interactive. Brand: Tevrix AI (logo, indigo/violet primary,
generous whitespace — the product must feel calmer than the client's phone).

## Information architecture

```
PUBLIC          /login  /signup  /forgot-password

ONBOARDING      /onboarding            wizard (company → compliance → knowledge → leads → test call)
(GATED)         /pending               "under review" screen, support contact

CLIENT APP      /                      Dashboard
(tenant live)   /leads                 table + filters + import
                /leads/import          CSV flow: upload → map columns → preview → confirm → report
                /campaigns             list with live counters
                /campaigns/new         3-step builder: who → what → when
                /campaigns/[id]        live monitor + outcome breakdown
                /calls                 list + filters
                /calls/[id]            ★ HERO SCREEN (see below)
                /agent                 agent editor + test call
                /knowledge             documents + processing status
                /settings              profile, working hours, members (V1)

ADMIN           /admin                 approval queue + fleet snapshot
(staff only)    /admin/tenants/[id]    mapping editor, provisioning timeline + Retry,
                                       usage, kill switches, impersonate
                /admin/templates       agent template registry
                /admin/inbox           failed webhooks + replay
```

Route groups: `(public)`, `(onboarding)`, `(app)`, `(admin)` — each with its own layout
and guard. The `(app)` layout checks tenant status server-side: `created→/onboarding`,
`pending_approval→/pending`, `paused→banner+read-only`, staff bypass with banner.

## Screen notes

**Dashboard (/)** — four stat cards (Conversations, Connected %, Qualified leads, Minutes
used vs plan), "Needs your attention" list (callbacks due, qualified leads not actioned),
last 7 days activity chart, primary CTA: *New Campaign*.

**Call detail (/calls/[id]) — the hero screen.** Audio player with waveform; transcript
synced to playback (click a line → seek); AI summary card on top; "What we learned" card
(gathered_data rendered as labeled fields); disposition badge; one-click actions:
*Mark qualified · Schedule follow-up · Don't call again*. This screen is where clients
decide the product is magic. Build it early, polish it always.

**Campaign monitor (/campaigns/[id])** — progress bar (completed/total), live ticker of
calls in flight (polling is fine; SSE later), outcome donut (qualified / callback /
not interested / no answer), pause button always visible.

**Leads import flow** — upload CSV → auto-detect + manual column mapping → validation
preview (first 20 rows, error highlighting) → confirm → background processing with
progress → downloadable error report. Duplicate phones (per tenant) skipped and reported.
This flow makes or breaks trust with non-technical users; over-invest here.

**Agent editor (/agent)** — friendly form: agent's spoken name, "what should your agent
achieve" (goal textarea with vertical-specific placeholder), language select, voice select
with **preview playback**, then *Save draft* / *Publish*. Test-call box: enter number →
agent calls it within seconds. No graphs, no nodes — that complexity lives in Dograh,
mapped by staff via templates.

**Admin queue (/admin)** — table: tenant, status chip, provisioning chip, plan, usage,
created. Row actions: Approve / Provision / Map / Pause / Impersonate. Provisioning
timeline shows each step with error detail and Retry.

## Cross-cutting rules

- **Vocabulary**: Conversations, Campaigns, Leads, Qualified, Your Agent, Knowledge.
  Never: workflow, run, pipeline, webhook, provisioning (client-side).
- **Empty states teach**: every empty table explains the next action with the CTA inline.
- **Optimistic UI** only for trivial toggles; anything engine-bound shows honest progress.
- **All times in tenant timezone** (default Asia/Kolkata), formatted `dd MMM, h:mm a`.
- **Currency INR** for client-visible numbers; USD costs are staff-only.
- **Auth-ready data fetching**: server components read session server-side — the
  fetch-before-auth bug class from the old UI cannot exist.
- Component layout: `components/ui` (shadcn), `components/leads|campaigns|calls|admin`
  (feature), `lib/dograh` (engine client), `lib/db` (Drizzle + scoped repos), `lib/auth`.
