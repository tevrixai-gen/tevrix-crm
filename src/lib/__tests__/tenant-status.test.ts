import { describe, it, expect } from "vitest";
import { canTransition, legalTransitions } from "../db/tenant-status";

describe("tenant status machine", () => {
  it("follows the happy path", () => {
    expect(canTransition("created", "pending_approval")).toBe(true);
    expect(canTransition("pending_approval", "provisioning")).toBe(true);
    expect(canTransition("provisioning", "ready")).toBe(true);
    expect(canTransition("ready", "live")).toBe(true);
  });

  it("allows failure + retry", () => {
    expect(canTransition("provisioning", "provisioning_failed")).toBe(true);
    expect(canTransition("provisioning_failed", "provisioning")).toBe(true);
  });

  it("allows pause/resume", () => {
    expect(canTransition("live", "paused")).toBe(true);
    expect(canTransition("paused", "live")).toBe(true);
  });

  it("blocks illegal jumps", () => {
    expect(canTransition("created", "live")).toBe(false);
    expect(canTransition("pending_approval", "live")).toBe(false);
    expect(canTransition("live", "created")).toBe(false);
    expect(canTransition("paused", "pending_approval")).toBe(false);
  });

  it("legalTransitions returns the allowed set", () => {
    expect(legalTransitions("live")).toEqual(["paused"]);
    expect(legalTransitions("provisioning_failed")).toEqual(["provisioning"]);
  });
});
