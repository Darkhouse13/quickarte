"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { businesses, orderItems, orders, products } from "@/lib/db/schema";
import { placeOrderSchema } from "./schemas";
import { hasEntitlement } from "@/lib/entitlements/queries";
import { recordOrderEvent } from "@/lib/ordering/events";
import { getMizaneIntegration } from "@/lib/integrations/mizane/queries";
import { postOrderToMizane } from "@/lib/integrations/mizane/order-sync";
import { generateCustomerAccessToken } from "./customer-token";
import {
  validateConfiguredLine,
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
  customerPhone: string | null;
  orderType: "dine_in" | "takeaway";
  tableNumber?: number;
  // Set by a per-table Mizane QR; tableLabel is the human label to display.
  mizaneTableId?: string;
  tableLabel?: string;
  notes?: string;
  items: {
    product_id: string;
    quantity: number;
    variant_id: string | null;
    selected_option_values: Array<{ id: string; quantity: number }>;
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
              allowQuantity: true,
              maxQuantity: true,
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
        mizaneTableId:
          data.orderType === "dine_in" ? data.mizaneTableId ?? null : null,
        tableNumber:
          data.orderType === "dine_in"
            ? data.tableLabel ??
              (data.tableNumber !== undefined ? String(data.tableNumber) : null)
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

  // Forward to Mizane POS when linked. Non-fatal: if Mizane is down or a line
  // can't be mapped, the order still lands in QuickArte and the customer can
  // track it; reconciliation retries on the next status poll. Mizane owns the
  // downstream side-effects QuickArte no longer does (kitchen routing, printing,
  // staff notifications, loyalty accrual by phone).
  try {
    const integration = await getMizaneIntegration(business.id);
    if (integration) {
      await postOrderToMizane(orderId, business.id, integration.apiKey);
    }
  } catch (err) {
    console.error("[mizane] order post failed (non-fatal):", err);
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
