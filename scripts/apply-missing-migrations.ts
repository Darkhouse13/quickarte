import { db } from "../lib/db";
import { sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const migrationsDir = join(__dirname, "../lib/db/migrations");

  // Check what columns categories actually has
  const cols = await db.execute(
    sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'categories' ORDER BY ordinal_position`,
  );
  const catCols = cols.rows.map((r) => r["column_name"] as string);
  console.log("Current categories columns:", catCols);

  const hasMizaneId = catCols.includes("mizane_id");
  if (hasMizaneId) {
    console.log("Columns already present — nothing to do.");
    process.exit(0);
  }

  console.log("\nApplying 0022 and 0023 manually...");

  const sql22 = readFileSync(join(migrationsDir, "0022_mizane_integration.sql"), "utf8");
  const sql23 = readFileSync(join(migrationsDir, "0023_m1_order_loop.sql"), "utf8");

  // Split on --> statement-breakpoint and execute each statement
  const statements22 = sql22.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
  const statements23 = sql23.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);

  for (const stmt of [...statements22, ...statements23]) {
    if (!stmt) continue;
    try {
      console.log("Running:", stmt.slice(0, 80).replace(/\n/g, " ") + "...");
      await db.execute(sql.raw(stmt));
      console.log("  ✓");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // IF NOT EXISTS guards mean duplicates are safe to ignore
      if (msg.includes("already exists") || msg.includes("duplicate")) {
        console.log("  ⚠ already exists, skipped");
      } else {
        console.error("  ✗ ERROR:", msg);
      }
    }
  }

  // Verify
  const after = await db.execute(
    sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'categories' ORDER BY ordinal_position`,
  );
  console.log("\ncategories columns after:", after.rows.map((r) => r["column_name"]));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
