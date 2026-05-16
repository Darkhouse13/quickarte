import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@quickarte/db-schema";

export const PG_POOL = Symbol("PG_POOL");
export const DRIZZLE_CLIENT = Symbol("DRIZZLE_CLIENT");

export type QuickarteDatabase = NodePgDatabase<typeof schema>;
