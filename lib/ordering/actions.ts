"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { businesses, orderItems, orders, products } from "@/lib/db/schema";
import { placeOrderSchema } from "./schemas";
import { DEMO_BUSINESS_SLUG } from "@/lib/catalog/constants";

export type PlaceOrderResult =
  | {
      status: "success";
      orderId: string;
      orderNumber: string;
      businessSlug: string;
    }
  | {
      status: "error";
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

type PlaceOrderPayload = {
  customerName: string;
  customerPhone: string;
  orderType: "dine_in" | "takeaway";
  tableNumber?: number;
  notes?: string;
  items: { productId: string; quantity: number }[];
  businessId: string;
};

export async function placeOrder(
  payload: PlaceOrderPayload,
): Promise<PlaceOrderResult> {
  const parsed = placeOrderSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Validation invalide",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }
  const data = parsed.data;

  const business = await db.query.businesses.findFirst({
    where: eq(businesses.id, data.businessId),
    columns: { id: true, slug: true },
  });
  if (!business) {
    return { status: "error", message: "Boutique introuvable" };
  }

  const productIds = data.items.map((i) => i.productId);
  const dbProducts = await db.query.products.findMany({
    where: and(
      eq(products.businessId, business.id),
      inArray(products.id, productIds),
    ),
    columns: { id: true, price: true, available: true },
  });

  const priceByProductId = new Map(
    dbProducts.map((p) => [p.id, Number(p.price)]),
  );

  for (const item of data.items) {
    const price = priceByProductId.get(item.productId);
    const product = dbProducts.find((p) => p.id === item.productId);
    if (price === undefined || !product || !product.available) {
      return {
        status: "error",
        message: "Un ou plusieurs articles sont indisponibles",
      };
    }
  }

  const itemLines = data.items.map((item) => {
    const unitPrice = priceByProductId.get(item.productId)!;
    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice,
      subtotal: unitPrice * item.quantity,
    };
  });
  const total = itemLines.reduce((sum, l) => sum + l.subtotal, 0);

  const orderId = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        businessId: business.id,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        type: data.orderType,
        status: "pending",
        total: total.toFixed(2),
        notes: data.notes ?? null,
        tableNumber:
          data.orderType === "dine_in" && data.tableNumber !== undefined
            ? String(data.tableNumber)
            : null,
      })
      .returning({ id: orders.id });

    if (!order) throw new Error("Failed to insert order");

    await tx.insert(orderItems).values(
      itemLines.map((l) => ({
        orderId: order.id,
        productId: l.productId,
        quantity: l.quantity,
        unitPrice: l.unitPrice.toFixed(2),
        subtotal: l.subtotal.toFixed(2),
      })),
    );

    return order.id;
  });

  revalidatePath("/orders");
  revalidatePath("/home");

  return {
    status: "success",
    orderId,
    orderNumber: orderId.replace(/-/g, "").slice(0, 8).toUpperCase(),
    businessSlug: business.slug,
  };
}

async function getDemoBusinessIdOrThrow(): Promise<string> {
  const row = await db.query.businesses.findFirst({
    where: eq(businesses.slug, DEMO_BUSINESS_SLUG),
    columns: { id: true },
  });
  if (!row) {
    throw new Error(
      `Demo business "${DEMO_BUSINESS_SLUG}" not found. Run \`npm run db:seed\`.`,
    );
  }
  return row.id;
}

export async function confirmOrder(orderId: string): Promise<void> {
  const businessId = await getDemoBusinessIdOrThrow();
  await db
    .update(orders)
    .set({ status: "confirmed", updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.businessId, businessId)));
  revalidatePath("/orders");
  revalidatePath("/home");
}

export async function completeOrder(orderId: string): Promise<void> {
  const businessId = await getDemoBusinessIdOrThrow();
  await db
    .update(orders)
    .set({ status: "completed", updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.businessId, businessId)));
  revalidatePath("/orders");
  revalidatePath("/home");
}
