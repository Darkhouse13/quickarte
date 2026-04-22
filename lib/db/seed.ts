import { config } from "dotenv";
config({ path: ".env" });

async function main() {
  const { eq } = await import("drizzle-orm");
  const { db, pool } = await import("./index");
  const {
    users,
    businesses,
    businessSettings,
    businessEntitlements,
    categories,
    products,
    orders,
    orderItems,
    loyaltyPrograms,
    loyaltyCustomers,
    loyaltyTransactions,
  } = await import("./schema");
  const { cafeDesArts } = await import("../catalog/fixtures");
  const { auth } = await import("../auth/server");
  const { MODULE_KEYS } = await import("../entitlements/types");

  console.log("→ Seeding Quickarte demo data…");

  await seedFullDemo();
  await seedSingleModuleDemo();

  console.log("✓ Seed complete.");
  await pool.end();

  async function seedFullDemo() {
    const email = "camille@cafedesarts.fr";
    const password = "quickarte123";
    const name = "Camille";

    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
      columns: { id: true },
    });
    if (existing) {
      console.log(`  [full] existing demo user found, deleting (cascade)…`);
      await db.delete(users).where(eq(users.id, existing.id));
    }

    const staleBySlug = await db.query.businesses.findFirst({
      where: eq(businesses.slug, cafeDesArts.slug),
      columns: { id: true, ownerId: true },
    });
    if (staleBySlug) {
      console.log(`  [full] stale business at slug, deleting owner (cascade)…`);
      await db.delete(users).where(eq(users.id, staleBySlug.ownerId));
    }

    const signUp = await auth.api.signUpEmail({
      body: { email, password, name },
    });
    const ownerId = signUp.user.id;

    await db
      .update(users)
      .set({ role: "owner", name })
      .where(eq(users.id, ownerId));

    console.log(`  [full] owner: ${name} (${ownerId})`);

    const [business] = await db
      .insert(businesses)
      .values({
        ownerId,
        name: cafeDesArts.name,
        slug: cafeDesArts.slug,
        type: "cafe",
        city: "Paris",
        address: "Rue Oberkampf",
        currency: "EUR",
        timezone: "Europe/Paris",
        locale: "fr",
        // Fake Stripe Connect state so the demo flows show "Paiements activés"
        // and a mix of paid vs sur-place orders without hitting real Stripe.
        // Real onboarding goes via the in-app "Connecter Stripe" button.
        stripeAccountId: "acct_DEMO_cafe_des_arts",
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        stripeOnboardingCompletedAt: new Date(),
      })
      .returning();
    if (!business) throw new Error("Failed to insert business");
    console.log(`  [full] business: ${business.name} (${business.id})`);

    await db.insert(businessSettings).values({
      businessId: business.id,
      orderingEnabled: true,
      reservationsEnabled: false,
      dineInEnabled: true,
      takeawayEnabled: true,
      deliveryEnabled: false,
    });

    await db.insert(businessEntitlements).values(
      MODULE_KEYS.map((module) => ({
        businessId: business.id,
        module,
        enabled: true,
        source: "manual" as const,
      })),
    );
    console.log(`  [full] entitlements: ${MODULE_KEYS.join(", ")}`);

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
    console.log(`  [full] categories: ${categoryIdByKey.size}`);

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
    console.log(`  [full] products: ${productCount}`);

    const [program] = await db
      .insert(loyaltyPrograms)
      .values({
        businessId: business.id,
        name: "Fidélité Café des Arts",
        accrualType: "per_visit",
        accrualRate: "1",
        rewardThreshold: "10",
        rewardDescription: "1 café offert",
        enabled: true,
      })
      .returning();
    if (!program) throw new Error("Failed to insert loyalty program");

    // Long-tail distribution tuned so that — after ~2 stamps each added by
    // historical online-order linking below — Camille ends up with:
    //   3 customers above the 10-stamp threshold,
    //   5 in the 5–9 range,
    //   7 below 5.
    // last_visit weighted toward recent (8 of 15 within 5 days).
    const loyaltySeedCustomers: Array<{
      phone: string;
      name: string;
      lifetimeEarned: number;
      daysAgo: number;
    }> = [
      { phone: "+33611223344", name: "Inès",       lifetimeEarned: 18, daysAgo: 0.2 },
      { phone: "+33612345678", name: "Sophie",     lifetimeEarned: 13, daysAgo: 0.5 },
      { phone: "+33698765432", name: "Thomas",     lifetimeEarned: 11, daysAgo: 1.2 },
      { phone: "+33688112233", name: "Camille D.", lifetimeEarned: 8,  daysAgo: 0.3 },
      { phone: "+33677998844", name: "Léa",        lifetimeEarned: 7,  daysAgo: 2 },
      { phone: "+33666554411", name: "Mehdi",      lifetimeEarned: 6,  daysAgo: 3 },
      { phone: "+33655443322", name: "Julien",     lifetimeEarned: 5,  daysAgo: 4 },
      { phone: "+33644332211", name: "Antoine",    lifetimeEarned: 2,  daysAgo: 6 },
      { phone: "+33633221100", name: "Sarah",      lifetimeEarned: 3,  daysAgo: 5 },
      { phone: "+33622110099", name: "Pauline",    lifetimeEarned: 1,  daysAgo: 9 },
      { phone: "+33611009988", name: "Karim",      lifetimeEarned: 2,  daysAgo: 11 },
      { phone: "+33699887766", name: "Raphaël",    lifetimeEarned: 2,  daysAgo: 14 },
      { phone: "+33688776655", name: "Noémie G.",  lifetimeEarned: 1,  daysAgo: 19 },
      { phone: "+33677665544", name: "Olivier",    lifetimeEarned: 1,  daysAgo: 22 },
      { phone: "+33655667788", name: "Claire",     lifetimeEarned: 1,  daysAgo: 27 },
    ];

    for (const c of loyaltySeedCustomers) {
      const lastVisit = new Date(Date.now() - c.daysAgo * 86400 * 1000);
      const [customer] = await db
        .insert(loyaltyCustomers)
        .values({
          businessId: business.id,
          phone: c.phone,
          name: c.name,
          balance: c.lifetimeEarned.toFixed(2),
          lifetimeEarned: c.lifetimeEarned.toFixed(2),
          lastVisitAt: lastVisit,
        })
        .returning();
      if (!customer) continue;

      await db.insert(loyaltyTransactions).values({
        businessId: business.id,
        customerId: customer.id,
        type: "earn",
        delta: c.lifetimeEarned.toFixed(2),
        source: "manual_in_person",
        createdAt: lastVisit,
        note: "Seed historique",
      });
    }
    console.log(
      `  [full] loyalty: program + ${loyaltySeedCustomers.length} customers`,
    );

    await seedHistoricalOrders(business.id);
    console.log(`  [full] login: ${email} / ${password}`);
  }

  async function seedHistoricalOrders(businessId: string) {
    const productRows = await db.query.products.findMany({
      where: eq(products.businessId, businessId),
    });
    if (productRows.length === 0) return;
    const loyaltyRows = await db.query.loyaltyCustomers.findMany({
      where: eq(loyaltyCustomers.businessId, businessId),
    });

    let state = 424242;
    const rand = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x1_0000_0000;
    };
    const randInt = (lo: number, hi: number) =>
      lo + Math.floor(rand() * (hi - lo + 1));
    const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;

    const FIRST_NAMES = [
      "Marie", "Pierre", "Jean", "Claire", "Nicolas", "Julie", "Antoine",
      "Lucas", "Emma", "Hugo", "Léa", "Paul", "Chloé", "Alex", "Sarah",
      "Manon", "Nathan", "Jade", "Louis", "Clara",
    ];

    type OrderSpec = {
      createdAt: Date;
      status: "completed" | "confirmed" | "cancelled";
      customerName: string;
      customerPhone: string | null;
      loyaltyCustomerId: string | null;
      items: Array<{ productId: string; price: number; qty: number }>;
      total: number;
    };

    function buildItems(maxCount: number): OrderSpec["items"] {
      const n = randInt(1, maxCount);
      const out: OrderSpec["items"] = [];
      for (let i = 0; i < n; i++) {
        const p = pick(productRows);
        out.push({
          productId: p.id,
          price: Number(p.price),
          qty: rand() < 0.82 ? 1 : 2,
        });
      }
      return out;
    }

    function total(items: OrderSpec["items"]): number {
      return items.reduce((s, it) => s + it.price * it.qty, 0);
    }

    const now = Date.now();
    const specs: OrderSpec[] = [];

    const HISTORICAL_COUNT = 52;
    for (let i = 0; i < HISTORICAL_COUNT; i++) {
      let daysAgo = randInt(3, 30);
      for (let t = 0; t < 2; t++) {
        const d = new Date(now - daysAgo * 86400 * 1000).getDay();
        const isWeekend = d === 0 || d === 6;
        if (isWeekend || rand() < 0.5) break;
        daysAgo = randInt(3, 30);
      }
      const hr = rand();
      const hour =
        hr < 0.42 ? pick([8, 9, 9, 10])
        : hr < 0.78 ? pick([12, 12, 13, 14])
        : pick([11, 15, 16, 17, 18]);
      const minute = randInt(0, 59);
      const createdAt = new Date(now - daysAgo * 86400 * 1000);
      createdAt.setHours(hour, minute, 0, 0);

      const items = buildItems(3);
      const linkToLoyalty = rand() < 0.55 && loyaltyRows.length > 0;
      const lc = linkToLoyalty ? pick(loyaltyRows) : null;
      specs.push({
        createdAt,
        status: "completed",
        customerName: lc?.name ?? pick(FIRST_NAMES),
        customerPhone: lc?.phone ?? null,
        loyaltyCustomerId: lc?.id ?? null,
        items,
        total: total(items),
      });
    }

    for (let i = 0; i < 3; i++) {
      const hoursAgo = randInt(2, 46);
      const createdAt = new Date(now - hoursAgo * 3600 * 1000);
      const items = buildItems(2);
      const lc = rand() < 0.5 && loyaltyRows.length > 0 ? pick(loyaltyRows) : null;
      specs.push({
        createdAt,
        status: "confirmed",
        customerName: lc?.name ?? pick(FIRST_NAMES),
        customerPhone: lc?.phone ?? null,
        loyaltyCustomerId: lc?.id ?? null,
        items,
        total: total(items),
      });
    }

    for (let i = 0; i < 2; i++) {
      const daysAgo = randInt(2, 20);
      const createdAt = new Date(now - daysAgo * 86400 * 1000);
      const items = buildItems(1);
      specs.push({
        createdAt,
        status: "cancelled",
        customerName: pick(FIRST_NAMES),
        customerPhone: null,
        loyaltyCustomerId: null,
        items,
        total: total(items),
      });
    }

    const loyaltyAdds = new Map<string, { count: number; lastVisit: Date }>();
    let insertedCount = 0;
    let paidCount = 0;
    for (const spec of specs) {
      // ~50% of non-cancelled orders marked paid via fake Stripe identifiers,
      // so the demo orders board shows a realistic mix of PAYÉ vs SUR PLACE.
      const markPaid = spec.status !== "cancelled" && rand() < 0.5;
      // Quickarte takes no percentage — see lib/payments/checkout.ts. Paid
      // orders record a 0 fee so historical rows are consistent with live ones.
      const platformFeeCents = markPaid ? 0 : null;
      const demoSuffix = Math.floor(rand() * 0xffffffff)
        .toString(16)
        .padStart(8, "0");

      const [order] = await db
        .insert(orders)
        .values({
          businessId,
          customerName: spec.customerName,
          customerPhone: spec.customerPhone,
          type: "dine_in",
          status: spec.status,
          paymentStatus: markPaid ? "paid" : "unpaid",
          total: spec.total.toFixed(2),
          stripePaymentIntentId: markPaid ? `pi_DEMO_${demoSuffix}` : null,
          stripeChargeId: markPaid ? `ch_DEMO_${demoSuffix}` : null,
          platformFeeCents,
          paidAt: markPaid ? spec.createdAt : null,
          createdAt: spec.createdAt,
          updatedAt: spec.createdAt,
        })
        .returning();
      if (!order) continue;
      insertedCount += 1;
      if (markPaid) paidCount += 1;

      for (const it of spec.items) {
        await db.insert(orderItems).values({
          orderId: order.id,
          productId: it.productId,
          quantity: it.qty,
          unitPrice: it.price.toFixed(2),
          subtotal: (it.price * it.qty).toFixed(2),
          createdAt: spec.createdAt,
          updatedAt: spec.createdAt,
        });
      }

      if (spec.status !== "cancelled" && spec.loyaltyCustomerId) {
        await db.insert(loyaltyTransactions).values({
          businessId,
          customerId: spec.loyaltyCustomerId,
          orderId: order.id,
          type: "earn",
          delta: "1.00",
          source: "online_order",
          createdAt: spec.createdAt,
        });
        const prev = loyaltyAdds.get(spec.loyaltyCustomerId) ?? {
          count: 0,
          lastVisit: spec.createdAt,
        };
        loyaltyAdds.set(spec.loyaltyCustomerId, {
          count: prev.count + 1,
          lastVisit:
            spec.createdAt > prev.lastVisit ? spec.createdAt : prev.lastVisit,
        });
      }
    }

    for (const [customerId, info] of loyaltyAdds) {
      const c = loyaltyRows.find((r) => r.id === customerId);
      if (!c) continue;
      const newBalance = Number(c.balance) + info.count;
      const newLifetime = Number(c.lifetimeEarned) + info.count;
      const lastVisit =
        c.lastVisitAt && c.lastVisitAt > info.lastVisit
          ? c.lastVisitAt
          : info.lastVisit;
      await db
        .update(loyaltyCustomers)
        .set({
          balance: newBalance.toFixed(2),
          lifetimeEarned: newLifetime.toFixed(2),
          lastVisitAt: lastVisit,
          updatedAt: new Date(),
        })
        .where(eq(loyaltyCustomers.id, customerId));
    }

    console.log(
      `  [full] historical orders: ${insertedCount} inserted (${paidCount} paid via Stripe), loyalty linked: ${loyaltyAdds.size} customers`,
    );
  }

  async function seedSingleModuleDemo() {
    const email = "noemie@boulangerie-test.fr";
    const password = "quickarte123";
    const name = "Noémie";
    const slug = "boulangerie-test";

    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
      columns: { id: true },
    });
    if (existing) {
      console.log(`  [solo] existing demo user found, deleting (cascade)…`);
      await db.delete(users).where(eq(users.id, existing.id));
    }

    const staleBySlug = await db.query.businesses.findFirst({
      where: eq(businesses.slug, slug),
      columns: { id: true, ownerId: true },
    });
    if (staleBySlug) {
      console.log(`  [solo] stale business at slug, deleting owner (cascade)…`);
      await db.delete(users).where(eq(users.id, staleBySlug.ownerId));
    }

    const signUp = await auth.api.signUpEmail({
      body: { email, password, name },
    });
    const ownerId = signUp.user.id;

    await db
      .update(users)
      .set({ role: "owner", name })
      .where(eq(users.id, ownerId));

    console.log(`  [solo] owner: ${name} (${ownerId})`);

    const [business] = await db
      .insert(businesses)
      .values({
        ownerId,
        name: "Boulangerie Test",
        slug,
        type: "boulangerie",
        city: "Lyon",
        address: "Rue Mercière",
        currency: "EUR",
        timezone: "Europe/Paris",
        locale: "fr",
      })
      .returning();
    if (!business) throw new Error("Failed to insert business");
    console.log(`  [solo] business: ${business.name} (${business.id})`);

    await db.insert(businessSettings).values({
      businessId: business.id,
      orderingEnabled: false,
      reservationsEnabled: false,
      dineInEnabled: false,
      takeawayEnabled: true,
      deliveryEnabled: false,
    });

    await db.insert(businessEntitlements).values({
      businessId: business.id,
      module: "menu_qr",
      enabled: true,
      source: "grandfathered",
    });
    console.log(`  [solo] entitlements: menu_qr only`);
    console.log(`  [solo] login: ${email} / ${password}`);
  }
}

main().catch((err) => {
  console.error("✗ Seed failed:", err);
  process.exitCode = 1;
});
