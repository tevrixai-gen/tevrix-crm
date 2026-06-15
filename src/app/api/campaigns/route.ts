import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { requireTenantApi } from "@/lib/auth/require-tenant";
import { resolveAudience, type LeadFilter } from "@/lib/campaign-audience";

export async function GET() {
  const { error, tenant } = await requireTenantApi();
  if (error) return error;

  const rows = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.tenantId, tenant!.id))
    .orderBy(desc(campaigns.createdAt));

  return NextResponse.json({ campaigns: rows });
}

interface RetryConfigInput {
  enabled?: boolean;
  maxRetries?: number;
  retryDelaySeconds?: number;
  retryOnNoAnswer?: boolean;
  retryOnBusy?: boolean;
  retryOnVoicemail?: boolean;
  maxAttempts?: number; // legacy field
}

interface ScheduleSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface ScheduleConfigInput {
  enabled?: boolean;
  timezone?: string;
  slots?: ScheduleSlot[];
  windowStart?: string; // legacy field
  windowEnd?: string;   // legacy field
}

interface CircuitBreakerInput {
  enabled?: boolean;
  failureThreshold?: number;
  windowSeconds?: number;
  minCallsInWindow?: number;
}

export async function POST(req: NextRequest) {
  const { error, tenant } = await requireTenantApi({ allowPaused: false });
  if (error) return error;

  const body = await req.json();
  const {
    name,
    leadFilter,
    maxConcurrency,
    retryConfig,
    scheduleConfig,
    schedule: legacySchedule,
    circuitBreaker,
  } = body as {
    name?: string;
    leadFilter?: LeadFilter;
    maxConcurrency?: number;
    retryConfig?: RetryConfigInput;
    scheduleConfig?: ScheduleConfigInput | null;
    schedule?: { windowStart?: string; windowEnd?: string };
    circuitBreaker?: CircuitBreakerInput | null;
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
  }

  // Normalize retry config (support both old and new format)
  const normalizedRetry = retryConfig
    ? {
        enabled: retryConfig.enabled ?? true,
        maxRetries: retryConfig.maxRetries ?? retryConfig.maxAttempts ?? 2,
        retryDelaySeconds: retryConfig.retryDelaySeconds ?? 120,
        retryOnNoAnswer: retryConfig.retryOnNoAnswer ?? true,
        retryOnBusy: retryConfig.retryOnBusy ?? true,
        retryOnVoicemail: retryConfig.retryOnVoicemail ?? false,
      }
    : { enabled: true, maxRetries: 2, retryDelaySeconds: 120, retryOnNoAnswer: true, retryOnBusy: true, retryOnVoicemail: false };

  // Normalize schedule (support both new slots format and legacy windowStart/windowEnd)
  const normalizedSchedule = scheduleConfig
    ? scheduleConfig
    : legacySchedule
      ? { windowStart: legacySchedule.windowStart, windowEnd: legacySchedule.windowEnd }
      : null;

  // Snapshot audience size at draft time (recomputed at launch)
  const audience = await resolveAudience(tenant!.id, leadFilter ?? null);

  const [created] = await db
    .insert(campaigns)
    .values({
      tenantId: tenant!.id,
      name: name.trim(),
      status: "draft",
      leadFilter: leadFilter ?? null,
      schedule: normalizedSchedule,
      maxConcurrency: Math.min(Math.max(maxConcurrency ?? 5, 1), 100),
      retryConfig: normalizedRetry,
      totalLeads: audience.length,
    })
    .returning({ id: campaigns.id });

  return NextResponse.json(
    { ok: true, id: created.id, audienceSize: audience.length },
    { status: 201 }
  );
}
