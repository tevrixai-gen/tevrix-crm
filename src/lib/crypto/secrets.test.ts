import { randomBytes } from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret, isEncrypted } from "./secrets";

const TEST_KEY = randomBytes(32).toString("base64");

describe("secrets", () => {
  const originalKey = process.env.CRM_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.CRM_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.CRM_ENCRYPTION_KEY;
    } else {
      process.env.CRM_ENCRYPTION_KEY = originalKey;
    }
  });

  describe("roundtrip", () => {
    it("decrypts what it encrypts", () => {
      const stored = encryptSecret("dgr_secret_api_key_123");
      expect(stored.startsWith("enc:v1:")).toBe(true);
      expect(stored).not.toContain("dgr_secret_api_key_123");
      expect(decryptSecret(stored)).toBe("dgr_secret_api_key_123");
    });

    it("produces a different ciphertext each time (random IV)", () => {
      const a = encryptSecret("same-key");
      const b = encryptSecret("same-key");
      expect(a).not.toBe(b);
      expect(decryptSecret(a)).toBe("same-key");
      expect(decryptSecret(b)).toBe("same-key");
    });

    it("handles unicode and empty-ish values", () => {
      for (const value of ["", "🔑 क्लीड़", "a"]) {
        expect(decryptSecret(encryptSecret(value))).toBe(value);
      }
    });

    it("fails to decrypt with the wrong key", () => {
      const stored = encryptSecret("dgr_secret");
      process.env.CRM_ENCRYPTION_KEY = randomBytes(32).toString("base64");
      expect(() => decryptSecret(stored)).toThrow();
    });

    it("rejects tampered ciphertext (GCM auth)", () => {
      const stored = encryptSecret("dgr_secret");
      const blob = Buffer.from(stored.slice("enc:v1:".length), "base64");
      blob[blob.length - 1] ^= 0xff;
      expect(() =>
        decryptSecret("enc:v1:" + blob.toString("base64"))
      ).toThrow();
    });
  });

  describe("legacy fallback", () => {
    it('strips the "plain:" prefix', () => {
      expect(decryptSecret("plain:dgr_legacy_key")).toBe("dgr_legacy_key");
    });

    it("passes bare legacy values through unchanged", () => {
      expect(decryptSecret("dgr_bare_legacy_key")).toBe("dgr_bare_legacy_key");
    });

    it('reads "plain:" values even without a key configured', () => {
      delete process.env.CRM_ENCRYPTION_KEY;
      expect(decryptSecret("plain:dgr_legacy_key")).toBe("dgr_legacy_key");
    });
  });

  describe("key handling", () => {
    it("rejects a key that is not 32 bytes", () => {
      process.env.CRM_ENCRYPTION_KEY = Buffer.from("too-short").toString(
        "base64"
      );
      expect(() => encryptSecret("x")).toThrow(/32 bytes/);
    });

    it("throws on decrypt of encrypted value without a key", () => {
      const stored = encryptSecret("dgr_secret");
      delete process.env.CRM_ENCRYPTION_KEY;
      expect(() => decryptSecret(stored)).toThrow(/CRM_ENCRYPTION_KEY/);
    });

    it('falls back to "plain:" on encrypt without a key outside production', () => {
      delete process.env.CRM_ENCRYPTION_KEY;
      const stored = encryptSecret("dgr_dev_key");
      expect(stored).toBe("plain:dgr_dev_key");
      expect(isEncrypted(stored)).toBe(false);
    });
  });

  describe("isEncrypted", () => {
    it("detects formats correctly", () => {
      expect(isEncrypted(encryptSecret("x"))).toBe(true);
      expect(isEncrypted("plain:x")).toBe(false);
      expect(isEncrypted("bare-key")).toBe(false);
    });
  });
});
