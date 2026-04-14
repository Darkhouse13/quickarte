import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

declare global {
  var __quickartePool: Pool | undefined;
}

export const pool =
  globalThis.__quickartePool ?? new Pool({ connectionString });

if (process.env.NODE_ENV !== "production") {
  globalThis.__quickartePool = pool;
}

export const db = drizzle(pool, { schema });

export type Database = typeof db;
export { schema };
