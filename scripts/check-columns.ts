import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  for (const table of ["option_values", "orders", "order_items", "products"]) {
    const r = await db.execute(
      sql.raw(`SELECT column_name FROM information_schema.columns WHERE table_name = '${table}' ORDER BY ordinal_position`),
    );
    console.log(`${table}:`, r.rows.map((x) => x["column_name"]).join(", "));
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
