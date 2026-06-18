import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL);

const migrations = [
  {
    tag: "0001_webhook_retry",
    sql: `
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'dead_letter' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'webhook_inbox_status')) THEN
          ALTER TYPE "webhook_inbox_status" ADD VALUE 'dead_letter';
        END IF;
      END $$;
      ALTER TABLE "webhook_inbox" ADD COLUMN IF NOT EXISTS "attempts" integer NOT NULL DEFAULT 0;
      ALTER TABLE "webhook_inbox" ADD COLUMN IF NOT EXISTS "next_retry_at" timestamp;
    `,
  },
];

async function run() {
  await sql`CREATE TABLE IF NOT EXISTS "_migrations" (tag text PRIMARY KEY, applied_at timestamptz DEFAULT now())`;
  for (const m of migrations) {
    const [exists] = await sql`SELECT 1 FROM "_migrations" WHERE tag = ${m.tag}`;
    if (exists) continue;
    console.log(`Applying migration: ${m.tag}`);
    await sql.unsafe(m.sql);
    await sql`INSERT INTO "_migrations" (tag) VALUES (${m.tag})`;
    console.log(`Applied: ${m.tag}`);
  }
  await sql.end();
  console.log("Migrations complete");
}

run().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
