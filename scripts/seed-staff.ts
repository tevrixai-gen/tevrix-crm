// Run: npx tsx scripts/seed-staff.ts
// Creates a staff user directly in the database for initial admin access.

import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://tevrix:tevrix@localhost:5433/tevrix_crm";
const sql = postgres(DATABASE_URL);

async function main() {
  // Check if staff user already exists
  const existing = await sql`SELECT id FROM "user" WHERE email = 'panshulsharma93@gmail.com' LIMIT 1`;

  if (existing.length > 0) {
    console.log("Staff user already exists, updating is_staff flag...");
    await sql`UPDATE "user" SET is_staff = true WHERE email = 'panshulsharma93@gmail.com'`;
    console.log("Done. User is now staff.");
  } else {
    console.log("No user found with that email.");
    console.log("Sign up at http://localhost:3001/signup first, then re-run this script.");
    console.log("The script will promote the user to staff.");
  }

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
