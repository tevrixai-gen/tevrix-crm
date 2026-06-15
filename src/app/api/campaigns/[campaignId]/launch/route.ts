// Campaign launch — the full guard chain runs server-side, in order:
//   1. tenant must be live
//   2. campaign must be draft
//   3. audience resolved fresh (DNC excluded unconditionally)
//   4. quota check (plan limits vs usage ledger)
//   5. working-hours check (tenant timezone)
//   6. campaign_leads written, then the engine is invoked
// Nothing is enqueued to the engine unless every guard passes.

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { campaigns, campaignLeads, plans, usageLedger } from "@/lib/db/schema";
import { requireTenantApi } from "@/lib/auth/require-tenant";
import { resolveAudience, type LeadFilter } from "@/lib/campaign-audience";
import { checkQuota, DEFAULT_PLAN_LIMITS, currentPeriod } from "@/lib/quota";
import { isWithinCallingWindow } from "@/lib/working-hours";
import { createDograhClient, DograhClientError } from "@/lib/dograh/client";

interface StoredRetryConfig {
  enabled?: boolean;
  maxRetries?: number;
  maxAttempts?: number;
  retryDelaySeconds?: number;
  retryOnNoAnswer?: boolean;
  retryOnBusy?: boolean;
  retryOnVoicemail?: boolean;
}

interface StoredScheduleConfig {
  enabled?: boolean;
  timezone?: string;
  slots?: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
  windowStart?: string;
  windowEnd?: string;
}

interface StoredCircuitBreaker {
  enabled?: boolean;
  failureThreshold?: number;
  windowSeconds?: number;
  minCallsInWindow?: number;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { error, tenant } = await requireTenantApi({ allowPaused: false });
  if (error) return error;

  // 1. Tenant must be live
  if (tenant!.status !== "live") {
    return NextResponse.json(
      { error: "Your account must be approved and live before launching campaigns." },
      { status: 403 }
    );
  }

  const { campaignId } = await params;
  const campaignRows = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, tenant!.id)))
    .limit(1);

  const campaign = campaignRows[0];
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 2. Must be a draft
  if (campaign.status !== "draft") {
    return NextResponse.json(
      { error: `Campaign is ${campaign.status}, only drafts can be launched` },
      { status: 409 }
    );
  }

  // 3. Resolve audience fresh (lead statuses may have changed since draft)
  const audience = await resolveAudience(
    tenant!.id,
    (campaign.leadFilter as LeadFilter | null) ?? null
  );

  if (audience.length === 0) {
    return NextResponse.json(
      { error: "No callable leads match this campaign's filter (DNC leads are always excluded)." },
      { status: 400 }
    );
  }

  // 4. Quota check
  const period = currentPeriod();
  const [planRow, usageRow] = await Promise.all([
    db.select().from(plans).where(eq(plans.tier, tenant!.planTier)).limit(1),
    db.select().from(usageLedger)
      .where(and(eq(usageLedger.tenantId, tenant!.id), eq(usageLedger.period, period)))
      .limit(1),
  ]);

  const limits = planRow[0]
    ? {
        maxCallsPerMonth: planRow[0].maxCallsPerMonth,
        maxMinutesPerMonth: planRow[0].maxMinutesPerMonth,
        maxConcurrency: planRow[0].maxConcurrency,
      }
    : DEFAULT_PLAN_LIMITS[tenant!.planTier] ?? DEFAULT_PLAN_LIMITS.trial;

  const usage = {
    callsUsed: usageRow[0]?.callsUsed ?? 0,
    minutesUsed: usageRow[0]?.minutesUsed ?? 0,
  };

  const quota = checkQuota(limits, usage, audience.length);
  if (!quota.ok) {
    return NextResponse.json({ error: quota.reason }, { status: 403 });
  }

  // 5. Working-hours check
  const schedule = campaign.schedule as StoredScheduleConfig | null;
  const window = {
    start: schedule?.windowStart ?? schedule?.slots?.[0]?.startTime ?? tenant!.callingWindowStart,
    end: schedule?.windowEnd ?? schedule?.slots?.[0]?.endTime ?? tenant!.callingWindowEnd,
    timezone: schedule?.timezone ?? tenant!.timezone,
  };

  if (!isWithinCallingWindow(window)) {
    return NextResponse.json(
      {
        error: `Outside calling hours (${window.start}–${window.end} ${window.timezone}). Launch within the window or adjust your schedule.`,
      },
      { status: 403 }
    );
  }

  // 6. Write campaign_leads (idempotent on unique campaign+lead)
  const CHUNK = 500;
  for (let i = 0; i < audience.length; i += CHUNK) {
    await db
      .insert(campaignLeads)
      .values(
        audience.slice(i, i + CHUNK).map((l) => ({
          campaignId: campaign.id,
          leadId: l.id,
          status: "queued" as const,
        }))
      )
      .onConflictDoNothing({ target: [campaignLeads.campaignId, campaignLeads.leadId] });
  }

  // 7. Hand off to the engine
  if (!tenant!.dograhApiKeyCiphertext || !tenant!.dograhWorkflowId) {
    return NextResponse.json(
      { error: "Your voice agent isn't connected yet. Contact support to finish setup." },
      { status: 409 }
    );
  }

  let client: ReturnType<typeof createDograhClient>;
  try {
    client = createDograhClient(
      process.env.DOGRAH_API_BASE_URL ?? "http://localhost:8000",
      tenant!.dograhApiKeyCiphertext
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "decryption failed";
    return NextResponse.json(
      { error: `Cannot decrypt voice engine credentials (${msg}). Contact support.` },
      { status: 500 }
    );
  }

  const retry = (campaign.retryConfig as StoredRetryConfig | null) ?? {};

  // Build the Dograh createCampaign payload with all advanced settings
  const createPayload: Record<string, unknown> = {
    name: `${tenant!.companyName ?? "Tevrix"} — ${campaign.name}`,
    workflow_id: await client.resolveWorkflowUuid(tenant!.dograhWorkflowId),
    source_type: "inline",
    source_data: {
      contacts: audience.map((l) => ({
        phone_number: l.phone,
        context: { lead_name: l.name ?? undefined, company_name: tenant!.companyName ?? undefined },
      })),
    },
    max_concurrent_calls: Math.min(campaign.maxConcurrency, limits.maxConcurrency),
    retry_config: {
      enabled: retry.enabled ?? true,
      max_retries: retry.maxRetries ?? retry.maxAttempts ?? 2,
      retry_delay_seconds: retry.retryDelaySeconds ?? 120,
      retry_on_no_answer: retry.retryOnNoAnswer ?? true,
      retry_on_voicemail: retry.retryOnVoicemail ?? false,
      retry_on_busy: retry.retryOnBusy ?? true,
    },
  };

  // Pass schedule config if set
  if (schedule?.enabled && schedule.slots && schedule.slots.length > 0) {
    createPayload.schedule_config = {
      enabled: true,
      timezone: schedule.timezone ?? tenant!.timezone,
      slots: schedule.slots.map((s) => ({
        day_of_week: s.dayOfWeek,
        start_time: s.startTime,
        end_time: s.endTime,
      })),
    };
  }

  // Pass circuit breaker config if set
  const cb = campaign.retryConfig as Record<string, unknown> | null;
  const circuitBreaker = (cb?.circuitBreaker ?? null) as StoredCircuitBreaker | null;
  if (circuitBreaker?.enabled) {
    createPayload.circuit_breaker = {
      enabled: true,
      failure_threshold: circuitBreaker.failureThreshold ?? 0.5,
      window_seconds: circuitBreaker.windowSeconds ?? 120,
      min_calls_in_window: circuitBreaker.minCallsInWindow ?? 5,
    };
  }

  let dograhCampaignId: string | null = null;
  try {
    const engineCampaign = await client.createCampaign(createPayload as unknown as Parameters<typeof client.createCampaign>[0]);
    dograhCampaignId = String(engineCampaign.id);
    await client.startCampaign(engineCampaign.id);
  } catch (err) {
    const detail =
      err instanceof DograhClientError
        ? `engine returned ${err.status}`
        : "engine unreachable";
    return NextResponse.json(
      { error: `Could not start the calling engine (${detail}). Your campaign is saved as draft — try again or contact support.` },
      { status: 502 }
    );
  }

  // 8. Mark running
  await db
    .update(campaigns)
    .set({
      status: "running",
      totalLeads: audience.length,
      dograhCampaignId,
      launchedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaign.id));

  return NextResponse.json({
    ok: true,
    launched: audience.length,
    callsRemaining: quota.callsRemaining - audience.length,
  });
}
