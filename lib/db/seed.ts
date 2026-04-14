import { config } from "dotenv";
config({ path: ".env" });

async function main() {
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
  const { auth } = await import("../auth/server");

  console.log("→ Seeding Quickarte demo data…");

  const email = "karim@cafedesarts.ma";
  const password = "quickarte123";
  const name = "Karim";

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true },
  });
  if (existing) {
    console.log(`  existing demo user found, deleting (cascade)…`);
    await db.delete(users).where(eq(users.id, existing.id));
  }

  const signUp = await auth.api.signUpEmail({
    body: { email, password, name },
  });
  const ownerId = signUp.user.id;

  await db
    .update(users)
    .set({ role: "owner", name })
    .where(eq(users.id, ownerId));

  console.log(`  owner: ${name} (${ownerId})`);

  const [business] = await db
    .insert(businesses)
    .values({
      ownerId,
      name: cafeDesArts.name,
      slug: cafeDesArts.slug,
      type: "cafe",
      city: "Casablanca",
      address: "Quartier Gauthier",
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
  console.log(`✓ Seed complete. Login: ${email} / ${password}`);

  await pool.end();
}

main().catch((err) => {
  console.error("✗ Seed failed:", err);
  process.exitCode = 1;
});
