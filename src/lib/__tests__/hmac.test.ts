import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { verifyHmac } from "../dograh/hmac";

const SECRET = "whsec_test_secret";

function sign(payload: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

describe("verifyHmac", () => {
  it("accepts a valid signature", () => {
    const payload = JSON.stringify({ event: "call.completed", run_id: 42 });
    expect(verifyHmac(payload, sign(payload), SECRET)).toBe(true);
  });

  it("rejects a tampered payload", () => {
    const payload = JSON.stringify({ run_id: 42 });
    const sig = sign(payload);
    expect(verifyHmac(payload.replace("42", "43"), sig, SECRET)).toBe(false);
  });

  it("rejects the wrong secret", () => {
    const payload = "x";
    expect(verifyHmac(payload, sign(payload, "other"), SECRET)).toBe(false);
  });

  it("rejects empty signature / secret", () => {
    expect(verifyHmac("x", "", SECRET)).toBe(false);
    expect(verifyHmac("x", sign("x"), "")).toBe(false);
  });

  it("rejects malformed hex without throwing", () => {
    expect(verifyHmac("x", "not-hex-at-all", SECRET)).toBe(false);
  });
});
