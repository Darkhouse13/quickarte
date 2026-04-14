import { config } from "dotenv";
config({ path: ".env" });

async function main() {
  // Dynamic imports so dotenv loads before lib/db reads process.env
  const { eq } = await import("drizzle-orm");
  const { db, pool } = await import("./index");
  const {
    users,
    businesses,
    businessSettings,
    categories,
    products,
  } = await import("./schema");
  const { cafeDesArts } = await import("../catalog/fixtures");

  console.log("→ Seeding Quickarte demo data…");

  const ownerPhone = "+212600000000";
  const existingOwner = await db.query.users.findFirst({
    where: eq(users.phone, ownerPhone),
  });

  const owner =
    existingOwner ??
    (
      await db
        .insert(users)
        .values({
          phone: ownerPhone,
          email: "karim@cafedesarts.ma",
          name: "Karim",
          role: "owner",
        })
        .returning()
    )[0];

  if (!owner) throw new Error("Failed to upsert owner");
  console.log(`  owner: ${owner.name} (${owner.id})`);

  const existingBusiness = await db.query.businesses.findFirst({
    where: eq(businesses.slug, cafeDesArts.slug),
  });

  if (existingBusiness) {
    console.log(`  existing business found, deleting (cascade)…`);
    await db.delete(businesses).where(eq(businesses.id, existingBusiness.id));
  }

  const [business] = await db
    .insert(businesses)
    .values({
      ownerId: owner.id,
      name: cafeDesArts.name,
      slug: cafeDesArts.slug,
      type: "restaurant",
      currency: "MAD",
      timezone: "Africa/Casablanca",
      locale: "fr",
    })
    .returning();

  if (!business) throw new Error("Failed to insert business");
  console.log(`  business: ${business.name} (${business.id})`);

  await db.insert(businessSettings).values({
    businessId: business.id,
    orderingEnabled: true,
    reservationsEnabled: false,
    dineInEnabled: true,
    takeawayEnabled: true,
    deliveryEnabled: false,
  });

  const categoryIdByKey = new Map<string, string>();
  for (const [index, section] of cafeDesArts.sections.entries()) {
    const [cat] = await db
      .insert(categories)
      .values({
        businessId: business.id,
        name: section.label,
        position: index,
        visible: true,
      })
      .returning();
    if (!cat) throw new Error(`Failed to insert category ${section.label}`);
    categoryIdByKey.set(section.id, cat.id);
  }
  console.log(`  categories: ${categoryIdByKey.size}`);

  let productCount = 0;
  for (const section of cafeDesArts.sections) {
    const categoryId = categoryIdByKey.get(section.id);
    if (!categoryId) continue;
    for (const [i, item] of section.items.entries()) {
      await db.insert(products).values({
        businessId: business.id,
        categoryId,
        name: item.name,
        description: item.description ?? null,
        price: item.price.toFixed(2),
        image: item.image?.src ?? null,
        available: true,
        position: i,
      });
      productCount += 1;
    }
  }
  console.log(`  products: ${productCount}`);
  console.log("✓ Seed complete");

  await pool.end();
}

main().catch((err) => {
  console.error("✗ Seed failed:", err);
  process.exitCode = 1;
});
