import fs from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

type Journal = {
  entries: Array<{
    idx: number;
    when: number;
    tag: string;
    breakpoints: boolean;
  }>;
};

async function getLastAppliedMigrationMs(pool: Pool): Promise<number | null> {
  try {
    const result = await pool.query<{ created_at: string | number | null }>(
      'select created_at from drizzle.__drizzle_migrations order by created_at desc limit 1',
    );
    const value = result.rows[0]?.created_at;
    return value == null ? null : Number(value);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "42P01" || code === "3F000") return null;
    throw error;
  }
}

function readJournal(migrationsFolder: string): Journal {
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  return JSON.parse(fs.readFileSync(journalPath, "utf8")) as Journal;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const migrationsFolder = path.resolve(
    process.cwd(),
    "lib/db/migrations",
  );

  readMigrationFiles({ migrationsFolder });
  const journal = readJournal(migrationsFolder);

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  try {
    const lastAppliedMs = await getLastAppliedMigrationMs(pool);
    const pending = journal.entries.filter(
      (entry) => lastAppliedMs == null || entry.when > lastAppliedMs,
    );

    if (pending.length === 0) {
      console.log("[db:migrate:prod] No pending migrations.");
    } else {
      for (const migration of pending) {
        console.log(
          `[db:migrate:prod] Applying ${migration.tag} (${migration.idx})`,
        );
      }
    }

    await migrate(db, { migrationsFolder });
    console.log("[db:migrate:prod] Migrations complete.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[db:migrate:prod] Migration failed.");
  console.error(error);
  process.exit(1);
});
