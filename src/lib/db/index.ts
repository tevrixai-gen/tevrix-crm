import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  _pgClient?: ReturnType<typeof postgres>;
  _pgClientKey?: string;
};

// Cloud SQL unix socket: extract `?host=/cloudsql/…` and pass it as an explicit
// option. postgres.js neither honors it in the URL nor tolerates it as a query
// param (it forwards unknown params as Postgres session GUCs).
const { dbUrl, socketHost } = (() => {
  const raw = process.env.DATABASE_URL!;
  try {
    const u = new URL(raw);
    const h = u.searchParams.get("host");
    if (h?.startsWith("/")) {
      u.searchParams.delete("host");
      return { dbUrl: u.toString(), socketHost: h };
    }
  } catch {
    /* non-URL connection strings pass through untouched */
  }
  return { dbUrl: raw, socketHost: undefined };
})();

const cacheKey = `${dbUrl}|${socketHost ?? ""}`;

// Invalidate cached client if DATABASE_URL changed (dev HMR scenario)
if (globalForDb._pgClient && globalForDb._pgClientKey !== cacheKey) {
  globalForDb._pgClient.end({ timeout: 0 }).catch(() => {});
  globalForDb._pgClient = undefined;
  globalForDb._pgClientKey = undefined;
}

const isPooler = dbUrl.includes(".pooler.supabase.com");

const client =
  globalForDb._pgClient ??
  postgres(dbUrl, {
    max: isPooler ? 1 : 10,
    idle_timeout: 30,
    prepare: isPooler ? false : true,
    ...(socketHost ? { host: socketHost } : {}),
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb._pgClient = client;
  globalForDb._pgClientKey = cacheKey;
}

export const db = drizzle(client, { schema });
export type DB = typeof db;
