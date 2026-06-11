# Manual smoke test (per release, ~10 min)

No release ships without this run passing. Use a real browser (or the
Antigravity browser agent) against staging; on prod, run steps 1–8 only.

## Setup
- App running (`npm run dev`, default http://localhost:3001)
- Postgres up (`docker compose up -d postgres`)
- A staff account exists (`npx tsx scripts/seed-staff.ts` after signup)

## The golden path

1. **Signup** — `/signup` with a fresh email → lands on `/onboarding`.
2. **Onboarding** — fill company name + calling hours, submit → `/pending`
   ("Account under review").
3. **Approve** — log in as staff in a second browser → `/admin` → the new
   tenant shows `pending approval` → open it → fill the Dograh mapping
   (org ID + API key + workflow ID) → **Run Provisioning** → status `ready`
   → **Go Live** → status `live`. Audit log shows every step.
4. **Client sees the app** — refresh the client browser → dashboard loads
   with zero-state cards.
5. **Import leads** — `/leads/import` → upload a CSV with at least one bad
   phone row → mapping auto-detected → preview correct → import → report
   shows imported/skipped/error counts → bad rows downloadable.
6. **Add a lead manually** — `/leads` → Add Lead with phone `98765 43210`
   → appears as `+91 98765 43210`. Adding the same number again → clear
   duplicate error.
7. **Campaign** — `/campaigns/new` → 3 steps → **Launch now**.
   - Inside calling window: launches, monitor shows progress.
   - Outside window: blocked with the calling-hours message, saved as draft.
8. **Test call** — `/agent` → enter a Tevrix test phone → phone rings within
   seconds → after hangup, call appears in `/calls` within 60 s with
   transcript + recording (requires engine webhook configured).
9. **Call actions** — open the call detail → **Mark qualified** → lead
   status flips to qualified → appears in dashboard "Needs your attention".
10. **Isolation spot-check** — copy a call/lead/campaign URL from tenant A,
    open it logged in as tenant B → must be 404, never data.
11. **Kill switch** — staff pauses the tenant → client sees the paused
    banner; campaign launch returns 403.

## Sign-off
Date, tester, build SHA, and any deviations go in the release notes.
