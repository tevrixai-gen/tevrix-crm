import { describe, it, expect } from "vitest";
import { normalizePhone, formatPhoneDisplay } from "../phone";

describe("normalizePhone (Indian formats)", () => {
  const valid: Array<[string, string]> = [
    ["9876543210", "+919876543210"],
    ["98765 43210", "+919876543210"],
    ["98765-43210", "+919876543210"],
    ["09876543210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["+91 98765 43210", "+919876543210"],
    ["+91-98765-43210", "+919876543210"],
    ["+919876543210", "+919876543210"],
    ["(91) 98765 43210", "+919876543210"],
    ["6123456789", "+916123456789"],
    ["7000000000", "+917000000000"],
    ["8999999999", "+918999999999"],
  ];

  it.each(valid)("normalizes %s → %s", (input, expected) => {
    const r = normalizePhone(input);
    expect(r.ok).toBe(true);
    expect(r.e164).toBe(expected);
  });

  const invalid: string[] = [
    "",
    "abc",
    "12345",
    "1234567890",      // starts with 1 — not a valid Indian mobile
    "5876543210",      // starts with 5
    "98765432101234",  // too long
    "987654321",       // 9 digits
    "0098765432",      // junk
  ];

  it.each(invalid)("rejects %s", (input) => {
    expect(normalizePhone(input).ok).toBe(false);
  });

  it("accepts non-Indian E.164 when + prefix present", () => {
    const r = normalizePhone("+14155552671");
    expect(r.ok).toBe(true);
    expect(r.e164).toBe("+14155552671");
  });

  it("rejects + numbers that are too short or too long", () => {
    expect(normalizePhone("+1234567").ok).toBe(false);
    expect(normalizePhone("+1234567890123456").ok).toBe(false);
  });
});

describe("formatPhoneDisplay", () => {
  it("formats Indian numbers", () => {
    expect(formatPhoneDisplay("+919876543210")).toBe("+91 98765 43210");
  });
  it("passes through others", () => {
    expect(formatPhoneDisplay("+14155552671")).toBe("+14155552671");
  });
});
