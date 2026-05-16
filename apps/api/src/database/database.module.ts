import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@quickarte/db-schema";
import { DatabaseService } from "./database.service";
import { DRIZZLE_CLIENT, PG_POOL, type QuickarteDatabase } from "./database.tokens";

@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new Pool({
          connectionString: configService.getOrThrow<string>("DATABASE_URL"),
        }),
    },
    {
      provide: DRIZZLE_CLIENT,
      inject: [PG_POOL],
      useFactory: (pool: Pool): QuickarteDatabase =>
        drizzle(pool, { schema }),
    },
    DatabaseService,
  ],
  exports: [PG_POOL, DatabaseService],
})
export class DatabaseModule {}
