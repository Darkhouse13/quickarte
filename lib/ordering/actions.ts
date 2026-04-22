"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { businesses, orderItems, orders, products } from "@/lib/db/schema";
import { placeOrderSchema } from "./schemas";
import { requireBusiness } from "@/lib/auth/get-business";
import { hasEntitlement } from "@/lib/entitlements/queries";
import { recordAccrual } from "@/lib/loyalty/service";
import { getProgram } from "@/lib/loyalty/queries";
import { createPaymentIntent, isStripeConfigured } from "@/lib/payments";
import { sendOrderNotification } from "@/lib/push/send";

export type PlaceOrderSuccess = {
  status: "success";
  orderId: string;
  orderNumber: string;
  businessSlug: string;
  payment:
    | {
        mode: "stripe";
        clientSecret: string;
        publishableKey: string;
        paymentIntentId: string;
      }
    | { mode: "cash" };
};

export type PlaceOrderResult =
  | PlaceOrderSuccess
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
    columns: {
      id: true,
      slug: true,
      stripeAccountId: true,
      stripeChargesEnabled: true,
    },
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

  try {
    const [hasLoyalty, hasOrdering] = await Promise.all([
      hasEntitlement(business.id, "loyalty"),
      hasEntitlement(business.id, "online_ordering"),
    ]);
    if (hasLoyalty && hasOrdering) {
      const program = await getProgram(business.id);
      if (program && program.enabled) {
        await recordAccrual({
          businessId: business.id,
          phone: data.customerPhone,
          name: data.customerName,
          amountSpent: total,
          orderId,
          source: "online_order",
        });
      }
    }
  } catch (err) {
    console.error("[loyalty] accrual on order failed (non-fatal):", err);
  }

  // Fire-and-forget push to merchant devices. A failure here must never
  // block the customer's order — mirrors the loyalty pattern above.
  try {
    const hasOrdering = await hasEntitlement(business.id, "online_ordering");
    if (hasOrdering) {
      await sendOrderNotification(business.id, orderId);
    }
  } catch (err) {
    console.error("[push] order notification failed (non-fatal):", err);
  }

  const orderNumber = orderId.replace(/-/g, "").slice(0, 8).toUpperCase();

  // Payment branch — only mint a PaymentIntent when everything lines up.
  // A single miss (no Stripe keys, no connected account, KYC not done) falls
  // back to the cash-on-arrival flow instead of blocking the order.
  const canCharge =
    isStripeConfigured() &&
    Boolean(business.stripeAccountId) &&
    business.stripeChargesEnabled;

  const hasOrderingEntitled = await hasEntitlement(
    business.id,
    "online_ordering",
  );

  if (hasOrderingEntitled && canCharge) {
    try {
      const intent = await createPaymentIntent({
        orderId,
        businessId: business.id,
        amount: total,
      });
      return {
        status: "success",
        orderId,
        orderNumber,
        businessSlug: business.slug,
        payment: {
          mode: "stripe",
          clientSecret: intent.clientSecret,
          publishableKey: intent.publishableKey,
          paymentIntentId: intent.paymentIntentId,
        },
      };
    } catch (err) {
      // Stripe outage or misconfig — order is already created; degrade to
      // cash flow rather than leave the customer stuck.
      console.error(
        "[payments] createPaymentIntent failed, falling back to cash:",
        err,
      );
    }
  }

  return {
    status: "success",
    orderId,
    orderNumber,
    businessSlug: business.slug,
    payment: { mode: "cash" },
  };
}

export async function confirmOrder(orderId: string): Promise<void> {
  const { business } = await requireBusiness();
  await db
    .update(orders)
    .set({ status: "confirmed", updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.businessId, business.id)));
  revalidatePath("/orders");
  revalidatePath("/home");
}

export async function completeOrder(orderId: string): Promise<void> {
  const { business } = await requireBusiness();
  await db
    .update(orders)
    .set({ status: "completed", updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.businessId, business.id)));
  revalidatePath("/orders");
  revalidatePath("/home");
}
