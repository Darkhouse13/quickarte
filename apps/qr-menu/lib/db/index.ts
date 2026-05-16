import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __quickartePool: Pool | undefined;
}

// Module-scope throws break Next.js 15's page-data-collection phase of
// `next build`, which imports every compiled route module to generate
// the route manifest. A missing DATABASE_URL at that point would crash
// the build even for routes marked force-dynamic.
//
// Resolution: always construct the Pool, using a DNS-unresolvable
// placeholder if DATABASE_URL is absent or empty. pg.Pool is lazy —
// no connection is attempted at construction. At runtime, any genuine
// misconfiguration will:
//   1. Be caught first by lib/env.ts's schema validation at server boot
//      (which DOES throw loudly, and is imported eagerly by the app).
//   2. Otherwise fail on first query with ENOTFOUND — clear enough.
const connectionString =
  process.env.DATABASE_URL ||
  "postgres://placeholder:placeholder@unresolved-db-host.invalid:5432/placeholder";

export const pool =
  globalThis.__quickartePool ?? new Pool({ connectionString });

if (process.env.NODE_ENV !== "production") {
  globalThis.__quickartePool = pool;
}

export const db = drizzle(pool, { schema });

export type Database = typeof db;
export { schema };
