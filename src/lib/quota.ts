// Quota math — plan limits vs usage_ledger. Pure functions so they're
// trivially unit-testable; DB reads happen in the caller.

export interface PlanLimits {
  maxCallsPerMonth: number;
  maxMinutesPerMonth: number;
  maxConcurrency: number;
}

export interface Usage {
  callsUsed: number;
  minutesUsed: number;
}

export interface QuotaCheck {
  ok: boolean;
  reason?: string;
  callsRemaining: number;
  minutesRemaining: number;
}

// Default plan limits — mirrored in the plans table; used as fallback when a
// tenant has no plan row yet.
export const DEFAULT_PLAN_LIMITS: Record<string, PlanLimits> = {
  trial: { maxCallsPerMonth: 100, maxMinutesPerMonth: 200, maxConcurrency: 2 },
  starter: { maxCallsPerMonth: 2000, maxMinutesPerMonth: 4000, maxConcurrency: 5 },
  growth: { maxCallsPerMonth: 10000, maxMinutesPerMonth: 20000, maxConcurrency: 15 },
};

export function checkQuota(
  limits: PlanLimits,
  usage: Usage,
  requestedCalls: number
): QuotaCheck {
  const callsRemaining = Math.max(0, limits.maxCallsPerMonth - usage.callsUsed);
  const minutesRemaining = Math.max(0, limits.maxMinutesPerMonth - usage.minutesUsed);

  if (callsRemaining <= 0) {
    return {
      ok: false,
      reason: `Monthly call limit reached (${limits.maxCallsPerMonth}). Upgrade your plan or wait for the next cycle.`,
      callsRemaining,
      minutesRemaining,
    };
  }

  if (minutesRemaining <= 0) {
    return {
      ok: false,
      reason: `Monthly minutes limit reached (${limits.maxMinutesPerMonth}).`,
      callsRemaining,
      minutesRemaining,
    };
  }

  if (requestedCalls > callsRemaining) {
    return {
      ok: false,
      reason: `This campaign needs ${requestedCalls} calls but only ${callsRemaining} remain this month. Reduce the audience or upgrade.`,
      callsRemaining,
      minutesRemaining,
    };
  }

  return { ok: true, callsRemaining, minutesRemaining };
}

export function currentPeriod(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7); // "2026-06"
}
