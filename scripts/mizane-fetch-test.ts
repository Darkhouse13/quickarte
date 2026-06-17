import { getMizaneMenu, getMizaneTables } from "../lib/integrations/mizane/client";

async function main() {
  const API_KEY = process.env.MIZANE_INTEGRATION_KEY;
  if (!API_KEY) throw new Error("Set MIZANE_INTEGRATION_KEY in .env");

  console.log("=== GET /tables ===");
  const tables = await getMizaneTables(API_KEY);
  console.log(JSON.stringify(tables, null, 2));

  console.log("\n=== GET /menu ===");
  const fetched = await getMizaneMenu(API_KEY);
  if (fetched.notModified) {
    console.log("304 Not Modified (unexpected without an If-None-Match)");
    process.exit(0);
  }
  const menu = fetched.menu;
  console.log(`etag: ${fetched.etag ?? "(none)"}`);

  console.log(`currency: ${menu.currency}`);
  console.log(`categories: ${menu.categories.length}`);
  console.log(`products: ${menu.products.length}`);
  console.log(`variants: ${menu.variants.length}`);
  console.log(`optionGroups: ${menu.optionGroups.length}`);
  console.log(`productOptionGroups: ${menu.productOptionGroups.length}`);

  console.log("\n--- categories ---");
  for (const c of menu.categories) {
    console.log(`  [${c.id}] ${c.name}`, c.localizedNames);
  }

  console.log("\n--- products ---");
  for (const p of menu.products) {
    console.log(`  [${p.id}] ${p.name} imageUrl=${p.imageUrl ?? "null"}`, p.localizedNames);
  }

  console.log("\n--- variants ---");
  for (const v of menu.variants) {
    console.log(`  [${v.id}] ${v.name} price=${v.price} isDefault=${v.isDefault}`, v.localizedNames);
  }

  console.log("\n--- optionGroups ---");
  for (const g of menu.optionGroups) {
    console.log(`  [${g.id}] ${g.name} type=${g.type} required=${g.required} min=${g.minSelect} max=${g.maxSelect}`);
    for (const v of g.values) {
      console.log(`    value [${v.id}] ${v.name} delta=${v.priceDelta} allowQty=${v.allowQuantity} maxQty=${v.maxQuantity}`, v.localizedNames);
    }
  }

  console.log("\n--- productOptionGroups ---");
  for (const pog of menu.productOptionGroups) {
    console.log(`  product=${pog.productId} group=${pog.optionGroupId} pos=${pog.position}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
