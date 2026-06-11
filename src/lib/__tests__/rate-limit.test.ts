import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, resetRateLimits } from "../rate-limit";

describe("rateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to the limit", () => {
    for (let i = 0; i < 5; i++) {
      expect(rateLimit("k", 5, 60_000).allowed).toBe(true);
    }
  });

  it("blocks past the limit with retry hint", () => {
    for (let i = 0; i < 3; i++) rateLimit("k", 3, 60_000);
    const r = rateLimit("k", 3, 60_000);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("isolates keys", () => {
    for (let i = 0; i < 3; i++) rateLimit("a", 3, 60_000);
    expect(rateLimit("a", 3, 60_000).allowed).toBe(false);
    expect(rateLimit("b", 3, 60_000).allowed).toBe(true);
  });

  it("reports remaining count", () => {
    expect(rateLimit("k", 3, 60_000).remaining).toBe(2);
    expect(rateLimit("k", 3, 60_000).remaining).toBe(1);
  });
});
