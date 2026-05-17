import { Inject, Injectable, OnApplicationShutdown } from "@nestjs/common";
import { businesses } from "@quickarte/db-schema";
import { eq, sql } from "drizzle-orm";
import type { Pool } from "pg";
import { DRIZZLE_CLIENT, PG_POOL, type QuickarteDatabase } from "./database.tokens";

export type TenantedDrizzleClient = Parameters<
  Parameters<QuickarteDatabase["transaction"]>[0]
>[0];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(DRIZZLE_CLIENT) private readonly db: QuickarteDatabase,
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

  async findBusinessIdBySlug(slug: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.slug, slug))
      .limit(1);

    return row?.id ?? null;
  }

  /**
   * The only approved entry point for querying tenanted tables.
   *
   * PostgreSQL pools reuse connections, so tenant context must be transaction
   * scoped. Do not set app.current_business_id at session scope, and do not
   * inject DRIZZLE_CLIENT into feature modules that touch tenanted data.
   */
  async withTenant<T>(
    businessId: string,
    callback: (tx: TenantedDrizzleClient) => Promise<T>,
  ): Promise<T> {
    if (!UUID_PATTERN.test(businessId)) {
      throw new Error("Invalid business_id tenant context");
    }

    return this.db.transaction(async (tx) => {
      await tx.execute(sql.raw(`SET LOCAL app.current_business_id = '${businessId}'`));
      return callback(tx);
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
