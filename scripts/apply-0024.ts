import { db } from "../lib/db";
import { sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const sqlText = readFileSync(
    join(__dirname, "../lib/db/migrations/0024_mizane_order_id.sql"),
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
    sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'mizane_order_id'`,
  );
  console.log(
    "\norders.mizane_order_id present:",
    r.rows.length > 0,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
