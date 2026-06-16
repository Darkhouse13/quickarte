import { randomUUID } from "node:crypto";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "../lib/db";
import {
  mizaneIntegrations,
  optionValues,
  orderItems,
  orders,
  productOptions,
  productVariants,
  products,
} from "../lib/db/schema";
import {
  postOrderToMizane,
  syncPendingMizaneOrders,
} from "../lib/integrations/mizane/order-sync";
import { getMizaneOrderStatus } from "../lib/integrations/mizane/client";

async function main() {
  const [integration] = await db.select().from(mizaneIntegrations).limit(1);
  if (!integration) throw new Error("No Mizane integration configured.");
  const { businessId, apiKey } = integration;
  console.log("Business:", businessId);

  // Pick a synced product that has the required "Choisissez 3 garnitures" group.
  const [grp] = await db
    .select()
    .from(productOptions)
    .where(
      and(
        eq(productOptions.name, "Choisissez 3 garnitures"),
        isNotNull(productOptions.mizaneId),
      ),
    )
    .limit(1);
  if (!grp) throw new Error("Required option group not synced.");

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, grp.productId))
    .limit(1);
  console.log("Product:", product!.name, `(local ${product!.id})`);

  const variants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, grp.productId));
  const defaultVariant = variants.find((v) => v.isDefault) ?? variants[0]!;
  console.log(
    "Variant:",
    defaultVariant.name,
    `local ${defaultVariant.id} → mizane ${defaultVariant.mizaneId}`,
  );

  const vals = await db
    .select()
    .from(optionValues)
    .where(eq(optionValues.optionId, grp.id));
  const chosen = vals.slice(0, 3); // exactly min=max=3
  console.log(
    "Garnitures:",
    chosen
      .map((v) => `${v.name} (local ${v.id} → mizane ${v.mizaneId})`)
      .join(", "),
  );

  const optionsJson = {
    variantId: defaultVariant.id,
    variantName: defaultVariant.name,
    variantPriceOverride: defaultVariant.priceOverride
      ? Number(defaultVariant.priceOverride)
      : null,
    selections: [
      {
        optionId: grp.id,
        optionName: grp.name,
        optionType: grp.type,
        values: chosen.map((v) => ({
          valueId: v.id,
          valueName: v.name,
          priceAddition: Number(v.priceAddition),
          quantity: 1,
        })),
      },
    ],
  };

  // Insert a throwaway QuickArte order with local ids, mirroring placeOrder.
  const [order] = await db
    .insert(orders)
    .values({
      businessId,
      customerName: "Test Mizane Order",
      customerPhone: "+212600000000",
      customerAccessToken: `test-${randomUUID()}`,
      type: "dine_in",
      status: "pending",
      total: defaultVariant.priceOverride ?? "0",
      tableNumber: "5",
      notes: "Sans oignons",
    })
    .returning({ id: orders.id });
  const orderId = order!.id;
  console.log("\nInserted local order:", orderId);

  await db.insert(orderItems).values({
    orderId,
    productId: grp.productId,
    quantity: 1,
    unitPrice: defaultVariant.priceOverride ?? "0",
    subtotal: defaultVariant.priceOverride ?? "0",
    optionsJson,
  });

  try {
    console.log("\n→ POSTing to Mizane...");
    const result = await postOrderToMizane(orderId, businessId, apiKey);
    console.log("POST result:", result);

    const [after] = await db
      .select({ mizaneOrderId: orders.mizaneOrderId, status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId));
    console.log("Stored on order row:", after);

    if (after?.mizaneOrderId) {
      console.log("\n→ GET /orders/:id (status poll)...");
      const status = await getMizaneOrderStatus(apiKey, after.mizaneOrderId);
      console.log("Mizane status:", status);

      console.log("\n→ syncPendingMizaneOrders...");
      const poll = await syncPendingMizaneOrders(businessId, apiKey);
      console.log("Poll summary:", poll);

      const [final] = await db
        .select({ status: orders.status })
        .from(orders)
        .where(eq(orders.id, orderId));
      console.log("QuickArte order status after poll:", final?.status);
    }
  } finally {
    // Clean up the throwaway order (cascade removes items + events).
    await db.delete(orders).where(eq(orders.id, orderId));
    console.log("\nCleaned up local test order.");
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
