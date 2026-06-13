// One-off migration: re-encrypt legacy tenant Dograh secrets.
//
// Covers BOTH dograh_api_key_ciphertext AND dograh_webhook_secret.
// Finds rows stored as "plain:<key>" (or bare keys) and rewrites them
// as AES-256-GCM "enc:v1:..." values. Idempotent — already-encrypted rows are skipped.
//
// Handles Cloud SQL unix socket URLs (strips ?host=/cloudsql/… and passes
// it as an explicit postgres.js host option — same logic as src/lib/db/index.ts).
//
// Usage (CRM_ENCRYPTION_KEY and DATABASE_URL must be set):
//   npx tsx scripts/reencrypt-dograh-keys.ts            # dry run
//   npx tsx scripts/reencrypt-dograh-keys.ts --apply    # write changes

import postgres from "postgres";
import {
  decryptSecret,
  encryptSecret,
  isEncrypted,
} from "../src/lib/crypto/secrets";

function parseDbUrl(raw: string): { url: string; host?: string } {
  try {
    const u = new URL(raw);
    const h = u.searchParams.get("host");
    if (h?.startsWith("/")) {
      u.searchParams.delete("host");
      return { url: u.toString(), host: h };
    }
  } catch {
    /* non-URL connection strings pass through untouched */
  }
  return { url: raw };
}

async function main() {
  const apply = process.argv.includes("--apply");

  if (!process.env.CRM_ENCRYPTION_KEY) {
    console.error("CRM_ENCRYPTION_KEY is not set — aborting.");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set — aborting.");
    process.exit(1);
  }

  const { url, host } = parseDbUrl(process.env.DATABASE_URL);
  const sql = postgres(url, {
    ...(host ? { host } : {}),
  });

  try {
    const rows = await sql<{ id: string; api_key: string | null; webhook_secret: string | null }[]>`
      SELECT
        id,
        dograh_api_key_ciphertext AS api_key,
        dograh_webhook_secret AS webhook_secret
      FROM tenants
      WHERE dograh_api_key_ciphertext IS NOT NULL
         OR dograh_webhook_secret IS NOT NULL
    `;

    let migrated = 0;
    let skipped = 0;

    for (const row of rows) {
      let changed = false;

      // Re-encrypt API key
      if (row.api_key && !isEncrypted(row.api_key)) {
        const plaintext = decryptSecret(row.api_key);
        const encrypted = encryptSecret(plaintext);
        if (apply) {
          await sql`
            UPDATE tenants
            SET dograh_api_key_ciphertext = ${encrypted}, updated_at = now()
            WHERE id = ${row.id}
          `;
          console.log(`tenant ${row.id}: re-encrypted API key`);
        } else {
          console.log(`tenant ${row.id}: would re-encrypt API key (dry run)`);
        }
        changed = true;
      }

      // Re-encrypt webhook secret
      if (row.webhook_secret && !isEncrypted(row.webhook_secret)) {
        const plaintext = decryptSecret(row.webhook_secret);
        const encrypted = encryptSecret(plaintext);
        if (apply) {
          await sql`
            UPDATE tenants
            SET dograh_webhook_secret = ${encrypted}, updated_at = now()
            WHERE id = ${row.id}
          `;
          console.log(`tenant ${row.id}: re-encrypted webhook secret`);
        } else {
          console.log(`tenant ${row.id}: would re-encrypt webhook secret (dry run)`);
        }
        changed = true;
      }

      if (changed) {
        migrated++;
      } else {
        skipped++;
      }
    }

    console.log(
      `\nDone. ${migrated} ${apply ? "migrated" : "pending"}, ${skipped} already encrypted, ${rows.length} total.`
    );
    if (!apply && migrated > 0) {
      console.log("Re-run with --apply to write changes.");
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
