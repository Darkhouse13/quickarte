import { Inject, Injectable, OnApplicationShutdown } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { Pool } from "pg";
import { DRIZZLE_CLIENT, PG_POOL, type QuickarteDatabase } from "./database.tokens";

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(DRIZZLE_CLIENT) readonly db: QuickarteDatabase,
  ) {}

  async checkHealth(timeoutMs = 1000): Promise<"ok" | "error"> {
    try {
      await Promise.race([
        this.db.execute(sql`select 1`),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Database health check timed out")), timeoutMs),
        ),
      ]);
      return "ok";
    } catch {
      return "error";
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
