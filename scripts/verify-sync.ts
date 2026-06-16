import { db } from "../lib/db";
import {
  categories,
  products,
  productVariants,
  productOptions,
  optionValues,
} from "../lib/db/schema";
import { eq, isNotNull } from "drizzle-orm";

async function main() {
  const cats = await db
    .select()
    .from(categories)
    .where(isNotNull(categories.mizaneId));

  console.log("=== CATEGORIES ===");
  for (const c of cats) {
    console.log(`  [${c.mizaneId}] ${c.name}`);
    console.log(`    localizedNames:`, c.localizedNames);
  }

  const prods = await db
    .select()
    .from(products)
    .where(isNotNull(products.mizaneId));

  console.log("\n=== PRODUCTS ===");
  for (const p of prods) {
    console.log(`  [${p.mizaneId}] ${p.name}`);
    console.log(`    localizedNames:`, p.localizedNames);
    console.log(`    image:`, p.image);
    console.log(`    available:`, p.available);
  }

  const vars = await db
    .select()
    .from(productVariants)
    .where(isNotNull(productVariants.mizaneId));

  console.log("\n=== VARIANTS ===");
  for (const v of vars) {
    console.log(`  [${v.mizaneId}] ${v.name} price=${v.priceOverride} isDefault=${v.isDefault}`);
    console.log(`    localizedNames:`, v.localizedNames);
  }

  const opts = await db
    .select()
    .from(productOptions)
    .where(isNotNull(productOptions.mizaneId));

  console.log("\n=== OPTION GROUPS ===");
  for (const o of opts) {
    console.log(`  [${o.mizaneId}] ${o.name}`);
    console.log(`    type=${o.type} required=${o.required} min=${o.minSelect} max=${o.maxSelect}`);
    console.log(`    localizedNames:`, o.localizedNames);

    const vals = await db
      .select()
      .from(optionValues)
      .where(eq(optionValues.optionId, o.id));

    console.log(`    values (${vals.length}):`);
    for (const v of vals) {
      console.log(
        `      [${v.mizaneId}] ${v.name} delta=${v.priceAddition} allowQty=${v.allowQuantity} maxQty=${v.maxQuantity}`,
      );
      console.log(`        localizedNames:`, v.localizedNames);
    }
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
