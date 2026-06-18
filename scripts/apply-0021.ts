import { db } from "../lib/db";
import { sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const sqlText = readFileSync(
    join(__dirname, "../lib/db/migrations/0021_option_value_quantity.sql"),
    "utf8",
  );

  const statements = sqlText
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    console.log("Running:", stmt.slice(0, 100).replace(/\n/g, " "));
    await db.execute(sql.raw(stmt));
    console.log("  ✓");
  }

  const r = await db.execute(
    sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'option_values' ORDER BY ordinal_position`,
  );
  console.log("\noption_values columns:", r.rows.map((x) => x["column_name"]).join(", "));
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
