"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  businesses,
  orderItems,
  orders,
  products,
} from "@/lib/db/schema";
import { placeOrderSchema } from "./schemas";
import { requireBusiness } from "@/lib/auth/get-business";
import { hasEntitlement } from "@/lib/entitlements/queries";
import { recordAccrual } from "@/lib/loyalty/service";
import { getProgram } from "@/lib/loyalty/queries";
import { sendOrderNotification } from "@/lib/push/send";
import {
  canTransitionOrderStatus,
  type OrderLifecycleStatus,
} from "./status";

export type PlaceOrderSuccess = {
  status: "success";
  orderId: string;
  orderNumber: string;
  businessSlug: string;
  payment: { mode: "cash" };
};

export type PlaceOrderResult =
  | PlaceOrderSuccess
  | {
      status: "error";
      message: string;
      statusCode?: 422;
      fieldErrors?: Record<string, string[]>;
    };

type PlaceOrderPayload = {
  customerName: string;
  customerPhone: string;
  orderType: "dine_in" | "takeaway";
  tableNumber?: number;
  notes?: string;
  items: {
    product_id: string;
    quantity: number;
    variant_id: string | null;
    selected_option_value_ids: string[];
    unit_price: number;
  }[];
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
    },
  });
  if (!business) {
    return { status: "error", message: "Boutique introuvable" };
  }

  const productIds = [...new Set(data.items.map((i) => i.product_id))];
  const dbProducts = await db.query.products.findMany({
    where: and(
      eq(products.businessId, business.id),
      inArray(products.id, productIds),
    ),
    columns: { id: true, price: true, available: true },
    with: {
      variants: {
        columns: { id: true, productId: true, name: true, priceOverride: true },
      },
      options: {
        columns: {
          id: true,
          productId: true,
          name: true,
          type: true,
          required: true,
          maxSelections: true,
        },
        with: {
          values: {
            columns: {
              id: true,
              optionId: true,
              name: true,
              priceAddition: true,
            },
          },
        },
      },
    },
  });

  const productById = new Map(dbProducts.map((p) => [p.id, p]));
  const itemLines: ValidatedOrderLine[] = [];

  for (const item of data.items) {
    const product = productById.get(item.product_id);
    if (!product || !product.available) {
      return {
        status: "error",
        message: "Un ou plusieurs articles sont indisponibles",
      };
    }

    const validation = validateConfiguredLine(item, product);
    if (validation.status === "error") return validation;
    itemLines.push(validation.line);
  }

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
        optionsJson: l.optionsJson,
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

  return {
    status: "success",
    orderId,
    orderNumber,
    businessSlug: business.slug,
    payment: { mode: "cash" },
  };
}

type DbProductForOrder = {
  id: string;
  price: string;
  available: boolean;
  variants: Array<{
    id: string;
    productId: string;
    name: string;
    priceOverride: string | null;
  }>;
  options: Array<{
    id: string;
    productId: string;
    name: string;
    type: "single_select" | "multi_select";
    required: boolean;
    maxSelections: number | null;
    values: Array<{
      id: string;
      optionId: string;
      name: string;
      priceAddition: string;
    }>;
  }>;
};

type IncomingOrderLine = PlaceOrderPayload["items"][number];
type ValidatedOrderLine = {
  productId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  optionsJson: {
    variant_id: string | null;
    variant_name: string | null;
    selected_options_summary: Array<{
      option_id: string;
      option_name: string;
      option_type: "single_select" | "multi_select";
      values: Array<{
        value_id: string;
        value_name: string;
        price_addition: number;
      }>;
    }>;
  } | null;
};

function validateConfiguredLine(
  item: IncomingOrderLine,
  product: DbProductForOrder,
):
  | {
      status: "success";
      line: ValidatedOrderLine;
    }
  | { status: "error"; message: string; statusCode?: 422 } {
  const variants = product.variants ?? [];
  if (variants.length > 0 && item.variant_id === null) {
    return { status: "error", message: "Variante requise" };
  }
  if (variants.length === 0 && item.variant_id !== null) {
    return { status: "error", message: "Variante invalide" };
  }

  const variant = item.variant_id
    ? variants.find((v) => v.id === item.variant_id)
    : null;
  if (item.variant_id && !variant) {
    return { status: "error", message: "Variante invalide" };
  }

  const selectedIds = new Set(item.selected_option_value_ids);
  if (selectedIds.size !== item.selected_option_value_ids.length) {
    return { status: "error", message: "Choix invalides" };
  }

  const selectedOptionsSummary = [];
  let additions = 0;
  for (const option of product.options ?? []) {
    const selectedValues = option.values.filter((value) =>
      selectedIds.has(value.id),
    );

    if (option.type === "single_select") {
      if (option.required && selectedValues.length !== 1) {
        return { status: "error", message: "Choix requis manquant" };
      }
      if (selectedValues.length > 1) {
        return { status: "error", message: "Choix unique invalide" };
      }
    } else {
      if (option.required && selectedValues.length < 1) {
        return { status: "error", message: "Choix requis manquant" };
      }
      if (option.maxSelections && selectedValues.length > option.maxSelections) {
        return { status: "error", message: "Trop de choix sélectionnés" };
      }
    }

    if (selectedValues.length > 0) {
      const values = selectedValues.map((value) => {
        const priceAddition = Number(value.priceAddition);
        additions += priceAddition;
        return {
          value_id: value.id,
          value_name: value.name,
          price_addition: priceAddition,
        };
      });
      selectedOptionsSummary.push({
        option_id: option.id,
        option_name: option.name,
        option_type: option.type,
        values,
      });
    }
  }

  const allowedValueIds = new Set(
    (product.options ?? []).flatMap((option) =>
      option.values.map((value) => value.id),
    ),
  );
  for (const selectedId of selectedIds) {
    if (!allowedValueIds.has(selectedId)) {
      return { status: "error", message: "Choix invalides" };
    }
  }

  const unitPrice = roundMoney(
    Number(variant?.priceOverride ?? product.price) + additions,
  );
  if (unitPrice !== roundMoney(item.unit_price)) {
    return {
      status: "error",
      statusCode: 422,
      message: "Les prix ont été mis à jour. Veuillez vérifier votre commande.",
    };
  }

  const subtotal = roundMoney(unitPrice * item.quantity);
  const hasConfiguration =
    variant !== null || selectedOptionsSummary.length > 0;

  return {
    status: "success",
    line: {
      productId: product.id,
      quantity: item.quantity,
      unitPrice,
      subtotal,
      optionsJson: hasConfiguration
        ? {
            variant_id: variant?.id ?? null,
            variant_name: variant?.name ?? null,
            selected_options_summary: selectedOptionsSummary,
          }
        : null,
    },
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export type OrderTransitionResult =
  | { status: "success" }
  | { status: "error"; message: string };

export async function transitionOrderStatus(
  orderId: string,
  nextStatus: OrderLifecycleStatus,
): Promise<OrderTransitionResult> {
  const { business } = await requireBusiness();
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.businessId, business.id)),
    columns: { id: true, status: true },
  });
  if (!order) {
    return { status: "error", message: "Commande introuvable" };
  }

  const currentStatus = order.status as OrderLifecycleStatus;
  if (!canTransitionOrderStatus(currentStatus, nextStatus)) {
    return { status: "error", message: "Transition de statut invalide" };
  }

  await db
    .update(orders)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.businessId, business.id)));
  revalidatePath("/orders");
  revalidatePath("/home");
  return { status: "success" };
}

export async function cancelOrder(
  orderId: string,
  reason?: string,
): Promise<OrderTransitionResult> {
  const { business } = await requireBusiness();
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.businessId, business.id)),
    columns: { id: true, status: true, notes: true },
  });
  if (!order) {
    return { status: "error", message: "Commande introuvable" };
  }

  const currentStatus = order.status as OrderLifecycleStatus;
  if (!canTransitionOrderStatus(currentStatus, "cancelled")) {
    return { status: "error", message: "Transition de statut invalide" };
  }

  const trimmedReason = reason?.trim();
  const notes = trimmedReason
    ? [order.notes, `Annulation: ${trimmedReason}`].filter(Boolean).join("\n")
    : order.notes;

  await db
    .update(orders)
    .set({ status: "cancelled", notes, updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.businessId, business.id)));
  revalidatePath("/orders");
  revalidatePath("/home");
  return { status: "success" };
}

export async function confirmOrder(orderId: string): Promise<void> {
  await transitionOrderStatus(orderId, "confirmed");
}

export async function completeOrder(orderId: string): Promise<void> {
  await transitionOrderStatus(orderId, "completed");
}
