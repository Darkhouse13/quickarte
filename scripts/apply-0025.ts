import { db } from "../lib/db";
import { sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const sqlText = readFileSync(
    join(__dirname, "../lib/db/migrations/0025_mizane_menu_etag.sql"),
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
    sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'mizane_integrations' AND column_name = 'menu_etag'`,
  );
  console.log("\nmizane_integrations.menu_etag present:", r.rows.length > 0);
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
