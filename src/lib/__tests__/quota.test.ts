import { describe, it, expect } from "vitest";
import { checkQuota, DEFAULT_PLAN_LIMITS, currentPeriod } from "../quota";

const trial = DEFAULT_PLAN_LIMITS.trial;

describe("checkQuota", () => {
  it("passes when usage is well under limits", () => {
    const r = checkQuota(trial, { callsUsed: 10, minutesUsed: 20 }, 50);
    expect(r.ok).toBe(true);
    expect(r.callsRemaining).toBe(90);
  });

  it("blocks when calls exhausted", () => {
    const r = checkQuota(trial, { callsUsed: 100, minutesUsed: 0 }, 1);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/call limit/i);
  });

  it("blocks when minutes exhausted", () => {
    const r = checkQuota(trial, { callsUsed: 0, minutesUsed: 200 }, 1);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/minutes/i);
  });

  it("blocks when campaign exceeds remaining calls", () => {
    const r = checkQuota(trial, { callsUsed: 80, minutesUsed: 0 }, 50);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/only 20 remain/);
  });

  it("allows exactly the remaining amount", () => {
    const r = checkQuota(trial, { callsUsed: 80, minutesUsed: 0 }, 20);
    expect(r.ok).toBe(true);
  });
});

describe("currentPeriod", () => {
  it("formats YYYY-MM", () => {
    expect(currentPeriod(new Date("2026-06-11T12:00:00Z"))).toBe("2026-06");
  });
});
