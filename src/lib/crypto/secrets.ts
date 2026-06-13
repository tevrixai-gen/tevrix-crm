// AES-256-GCM encryption for tenant secrets (Dograh API keys).
//
// Stored format: "enc:v1:" + base64(iv | ciphertext | authTag)
//   - iv: 12 bytes (GCM standard nonce size)
//   - authTag: 16 bytes
//
// Key comes from CRM_ENCRYPTION_KEY (32 bytes, base64 — in GCP it lives in
// Secret Manager as `crm-encryption-key` in project tevrix-ecom-care).
//
// Legacy values written before encryption existed are either "plain:<key>"
// or a bare key — decryptSecret() passes both through unchanged so reads
// keep working until scripts/reencrypt-dograh-keys.ts migrates them.
//
// Reads process.env directly (not @/lib/env) so this module and its tests
// don't pull in the full t3-env validation of unrelated variables.

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ENC_PREFIX = "enc:v1:";
const PLAIN_PREFIX = "plain:";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function loadKey(): Buffer | null {
  const raw = process.env.CRM_ENCRYPTION_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "CRM_ENCRYPTION_KEY must be 32 bytes encoded as base64 (44 characters)"
    );
  }
  return key;
}

export function isEncrypted(stored: string): boolean {
  return stored.startsWith(ENC_PREFIX);
}

export function encryptSecret(plaintext: string): string {
  const key = loadKey();
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CRM_ENCRYPTION_KEY is required in production to store secrets"
      );
    }
    // Dev fallback: keep the legacy plain format so local setups work
    // without a key configured.
    console.warn(
      "[secrets] CRM_ENCRYPTION_KEY not set — storing secret unencrypted (dev only)"
    );
    return `${PLAIN_PREFIX}${plaintext}`;
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return ENC_PREFIX + Buffer.concat([iv, ciphertext, tag]).toString("base64");
}

export function decryptSecret(stored: string): string {
  // Legacy dev format
  if (stored.startsWith(PLAIN_PREFIX)) {
    return stored.slice(PLAIN_PREFIX.length);
  }
  // Legacy bare value (pre-dates even the "plain:" convention)
  if (!stored.startsWith(ENC_PREFIX)) {
    return stored;
  }

  const key = loadKey();
  if (!key) {
    throw new Error(
      "CRM_ENCRYPTION_KEY is required to decrypt stored secrets"
    );
  }

  const blob = Buffer.from(stored.slice(ENC_PREFIX.length), "base64");
  if (blob.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Stored secret is malformed: ciphertext too short");
  }
  const iv = blob.subarray(0, IV_LENGTH);
  const ciphertext = blob.subarray(IV_LENGTH, blob.length - TAG_LENGTH);
  const tag = blob.subarray(blob.length - TAG_LENGTH);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
