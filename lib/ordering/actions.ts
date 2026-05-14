"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  businesses,
  orderItems,
  orders,
  printers,
  products,
} from "@/lib/db/schema";
import { placeOrderSchema } from "./schemas";
import { requireBusiness } from "@/lib/auth/get-business";
import { hasEntitlement } from "@/lib/entitlements/queries";
import { recordAccrual } from "@/lib/loyalty/service";
import { getProgram } from "@/lib/loyalty/queries";
import { sendOrderNotification } from "@/lib/push/send";
import { assertRole } from "@/lib/identity/permissions";
import { recordOrderEvent } from "@/lib/ordering/events";
import { transitionOrder } from "@/lib/ordering/transitions";
import {
  markEnteredInPos,
  markSkippedInPos,
  revertPosStatus,
  type PosActionResult,
} from "@/lib/ordering/pos-reconciliation";
import { ensureDefaultCounterPrinter } from "@/lib/printing/printers";
import { enqueuePrintJobsForOrder } from "@/lib/printing/pipeline";
import {
  type OrderLifecycleStatus,
} from "./status";
import { generateCustomerAccessToken } from "./customer-token";
import {
  validateConfiguredLine,
  type DbProductForOrder,
  type OrderPlacementErrorCode,
  type ValidatedOrderLine,
} from "./line-validation";

export type PlaceOrderSuccess = {
  status: "success";
  orderId: string;
  orderNumber: string;
  businessSlug: string;
  customerUrl: string;
  payment: { mode: "cash" };
};

export type PlaceOrderResult =
  | PlaceOrderSuccess
  | {
      status: "error";
      message: string;
      code?: OrderPlacementErrorCode;
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
  // POS coexistence is snapshotted at insert time: new orders become
  // `pending` only when the setting is enabled right now. Later setting
  // changes never auto-migrate historical orders between POS dispositions.
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
      locale: true,
    },
    with: {
      settings: {
        columns: {
          orderingEnabled: true,
          dineInEnabled: true,
          takeawayEnabled: true,
          posCoexistenceEnabled: true,
        },
      },
    },
  });
  if (!business) {
    return { status: "error", message: "Boutique introuvable" };
  }
  const hasOrdering = await hasEntitlement(business.id, "online_ordering");
  if (!hasOrdering || business.settings?.orderingEnabled === false) {
    return { status: "error", message: "Commande en ligne desactivee" };
  }
  if (data.orderType === "dine_in" && business.settings?.dineInEnabled === false) {
    return { status: "error", message: "Commande sur place desactivee" };
  }
  if (data.orderType === "takeaway" && business.settings?.takeawayEnabled === false) {
    return { status: "error", message: "Commande a emporter desactivee" };
  }

  const productIds = [...new Set(data.items.map((i) => i.product_id))];
  const dbProducts = await db.query.products.findMany({
    where: and(
      eq(products.businessId, business.id),
      inArray(products.id, productIds),
    ),
    columns: { id: true, name: true, price: true, available: true },
    with: {
      variants: {
        orderBy: (table, { asc }) => [asc(table.position)],
        columns: {
          id: true,
          productId: true,
          name: true,
          priceOverride: true,
          isDefault: true,
          available: true,
        },
      },
      options: {
        orderBy: (table, { asc }) => [asc(table.position)],
        columns: {
          id: true,
          productId: true,
          name: true,
          type: true,
          required: true,
          minSelect: true,
          maxSelect: true,
          available: true,
        },
        with: {
          values: {
            orderBy: (table, { asc }) => [asc(table.position)],
            columns: {
              id: true,
              optionId: true,
              name: true,
              priceAddition: true,
              available: true,
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
    if (!product) {
      return {
        status: "error",
        code: "PRODUCT_UNAVAILABLE",
        message: "Un ou plusieurs articles sont indisponibles",
      };
    }

    const validation = validateConfiguredLine(item, product);
    if (validation.status === "error") return validation;
    itemLines.push(validation.line);
  }

  const total = itemLines.reduce((sum, l) => sum + l.subtotal, 0);

  const insertedOrder = await db.transaction(async (tx) => {
    const customerAccessToken = generateCustomerAccessToken();
    const [order] = await tx
      .insert(orders)
      .values({
        businessId: business.id,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerAccessToken,
        type: data.orderType,
        status: "pending",
        posStatus: business.settings?.posCoexistenceEnabled
          ? "pending"
          : "not_required",
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

    await recordOrderEvent(order.id, "order.created", {
      actor: { userId: null, role: "customer" },
      payload: { order_type: data.orderType, total: total.toFixed(2) },
      tx,
    });

    return { id: order.id, customerAccessToken };
  });
  const orderId = insertedOrder.id;

  try {
    await db.transaction(async (tx) => {
      const existingPrinter = await tx.query.printers.findFirst({
        where: and(
          eq(printers.businessId, business.id),
          isNull(printers.deletedAt),
        ),
        columns: { id: true },
      });
      if (!existingPrinter) {
        await ensureDefaultCounterPrinter(business.id, tx);
      }
    });

    const printResult = await enqueuePrintJobsForOrder(orderId, business.id);
    if (!printResult.ok) {
      console.error("[printing] auto-enqueue failed (non-fatal):", printResult.error);
    }
  } catch (err) {
    console.error("[printing] auto-enqueue failed (non-fatal):", err);
    try {
      await recordOrderEvent(orderId, "order.printed", {
        actor: { userId: null, role: "system" },
        payload: {
          status: "enqueue_failed",
          error: err instanceof Error ? err.message : "Unknown print error",
        },
      });
    } catch (eventErr) {
      console.error("[printing] failed to record enqueue failure:", eventErr);
    }
  }

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
    customerUrl: `/${business.locale.split("-")[0] ?? "fr"}/o/${insertedOrder.customerAccessToken}`,
    payment: { mode: "cash" },
  };
}

export type OrderTransitionResult =
  | { status: "success" }
  | { status: "error"; message: string };

export async function transitionOrderStatus(
  orderId: string,
  nextStatus: OrderLifecycleStatus,
): Promise<OrderTransitionResult> {
  const { session, business } = await requireBusiness();
  const role = await assertRole(session.user.id, business.id, [
    "owner",
    "manager",
    "waiter",
  ]);
  const result = await transitionOrder(
    orderId,
    nextStatus,
    { userId: session.user.id, role },
    { businessId: business.id },
  );
  if (result.status === "not_found") {
    return { status: "error", message: "Commande introuvable" };
  }
  if (result.status === "invalid_transition") {
    return { status: "error", message: "Transition de statut invalide" };
  }
  revalidatePath("/orders");
  revalidatePath("/home");
  return { status: "success" };
}

export async function cancelOrder(
  orderId: string,
  reason?: string,
): Promise<OrderTransitionResult> {
  const { session, business } = await requireBusiness();
  const role = await assertRole(session.user.id, business.id, [
    "owner",
    "manager",
    "waiter",
  ]);
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.businessId, business.id)),
    columns: { id: true, status: true, notes: true },
  });
  if (!order) {
    return { status: "error", message: "Commande introuvable" };
  }

  const trimmedReason = reason?.trim();
  const notes = trimmedReason
    ? [order.notes, `Annulation: ${trimmedReason}`].filter(Boolean).join("\n")
    : order.notes;

  const result = await transitionOrder(
    orderId,
    "cancelled",
    { userId: session.user.id, role },
    {
      businessId: business.id,
      notes,
      payload: trimmedReason ? { reason: trimmedReason } : undefined,
    },
  );
  if (result.status === "invalid_transition") {
    return { status: "error", message: "Transition de statut invalide" };
  }
  if (result.status === "not_found") {
    return { status: "error", message: "Commande introuvable" };
  }
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

export async function markOrderEnteredInPos(
  orderId: string,
  input: { posReference?: string } = {},
): Promise<PosActionResult> {
  const { session, business } = await requireBusiness();
  const role = await assertRole(session.user.id, business.id, [
    "owner",
    "manager",
    "cashier",
  ]);
  const result = await markEnteredInPos(
    orderId,
    business.id,
    { userId: session.user.id, role },
    input,
  );
  revalidatePath("/orders");
  revalidatePath("/cloture");
  return result;
}

export async function markOrderPosSkipped(
  orderId: string,
  input: { posReference?: string; reason?: string } = {},
): Promise<PosActionResult> {
  const { session, business } = await requireBusiness();
  const role = await assertRole(session.user.id, business.id, [
    "owner",
    "manager",
    "cashier",
  ]);
  const result = await markSkippedInPos(
    orderId,
    business.id,
    { userId: session.user.id, role },
    input,
  );
  revalidatePath("/orders");
  revalidatePath("/cloture");
  return result;
}

export async function revertOrderPosStatus(
  orderId: string,
): Promise<PosActionResult> {
  const { session, business } = await requireBusiness();
  const role = await assertRole(session.user.id, business.id, [
    "owner",
    "manager",
  ]);
  const result = await revertPosStatus(orderId, business.id, {
    userId: session.user.id,
    role,
  });
  revalidatePath("/orders");
  revalidatePath("/cloture");
  return result;
}
