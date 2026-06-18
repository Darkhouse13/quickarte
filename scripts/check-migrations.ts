import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  const migrations = await db.execute(
    sql`SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at`,
  );
  console.log("Applied migrations:");
  for (const r of migrations.rows) console.log(" ", r);

  const cols = await db.execute(
    sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'categories' ORDER BY ordinal_position`,
  );
  console.log("\ncategories columns:");
  for (const r of cols.rows) console.log(" ", r["column_name"]);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
