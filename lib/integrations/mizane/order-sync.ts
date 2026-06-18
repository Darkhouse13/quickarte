import "server-only";
import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { optionValues, orderItems, orders, productVariants } from "@/lib/db/schema";
import { recordOrderEvent } from "@/lib/ordering/events";
import { transitionOrder } from "@/lib/ordering/transitions";
import {
  isTerminalOrderStatus,
  type OrderLifecycleStatus,
} from "@/lib/ordering/status";
import { normalizeOrderItemOptions } from "@/lib/ordering/order-item-options";
import { MizaneError, getMizaneOrderStatus, postMizaneOrder } from "./client";
import { shouldPollMizane } from "./poll-throttle";
import { getMizaneIntegration } from "./queries";
import {
  ONLINE_ACTIVE_STATUSES,
  mizaneTargetStatus,
  nextStepToward,
} from "./status-map";
import type {
  MizaneFulfillment,
  MizaneOrderLine,
  MizaneOrderRequest,
  MizaneOrderStatus,
  MizaneSelectedOption,
} from "./types";

// Pending orders auto-expire on Mizane at 10 min, so the live set is small.
// Cap the per-poll fan-out so the worst case stays under the 120 req/min limit:
// at most ~4 polls/min (15s throttle) × 25 GETs = 100/min, leaving headroom for
// menu syncs and order POSTs.
const MAX_ORDERS_PER_POLL = 25;

export class MizaneOrderMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MizaneOrderMappingError";
  }
}

/**
 * Maps a placed QuickArte order to Mizane's order shape and POSTs it. The
 * QuickArte order id doubles as the idempotency key, so retries (or a 409
 * replay) resolve to the same Mizane order. Stores the returned Mizane order id
 * on the order row; polling later moves the order to confirmed/cancelled.
 *
 * Throws MizaneOrderMappingError if any line can't be expressed in Mizane terms
 * (missing variant/option mizane_id) — callers treat this as non-fatal and let
 * the order continue through QuickArte's own flow.
 */
export async function postOrderToMizane(
  orderId: string,
  businessId: string,
  apiKey: string,
): Promise<{ mizaneOrderId: string; status: MizaneOrderStatus } | null> {
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.businessId, businessId)),
    columns: {
      id: true,
      type: true,
      customerName: true,
      customerPhone: true,
      notes: true,
      tableNumber: true,
      mizaneTableId: true,
      mizaneOrderId: true,
    },
  });
  if (!order) throw new MizaneOrderMappingError("Commande introuvable.");

  // Already posted — nothing to do (idempotent).
  if (order.mizaneOrderId) {
    return null;
  }

  const items = await db
    .select({
      productId: orderItems.productId,
      quantity: orderItems.quantity,
      optionsJson: orderItems.optionsJson,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  if (items.length === 0) {
    throw new MizaneOrderMappingError("Commande sans articles.");
  }

  // Parse each line's stored configuration up front.
  const parsedItems = items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    options: normalizeOrderItemOptions(item.optionsJson),
  }));

  // Collect the catalog ids we need to translate into Mizane ids.
  const productIds = new Set<string>();
  const localVariantIds = new Set<string>();
  const localValueIds = new Set<string>();
  for (const item of parsedItems) {
    if (item.productId) productIds.add(item.productId);
    const explicitVariant = item.options?.variantId ?? null;
    if (explicitVariant) localVariantIds.add(explicitVariant);
    for (const selection of item.options?.selections ?? []) {
      for (const value of selection.values) {
        if (value.valueId) localValueIds.add(value.valueId);
      }
    }
  }

  // Load variants for the products in this order (covers both the explicit
  // snapshot variant and the default variant for single-variant products).
  const variantRows = productIds.size
    ? await db
        .select({
          id: productVariants.id,
          productId: productVariants.productId,
          mizaneId: productVariants.mizaneId,
          isDefault: productVariants.isDefault,
        })
        .from(productVariants)
        .where(
          and(
            inArray(productVariants.productId, [...productIds]),
            isNull(productVariants.deletedAt),
          ),
        )
    : [];

  const variantById = new Map(variantRows.map((v) => [v.id, v]));
  const defaultVariantByProduct = new Map<string, (typeof variantRows)[number]>();
  const variantsByProduct = new Map<string, (typeof variantRows)[number][]>();
  for (const v of variantRows) {
    const list = variantsByProduct.get(v.productId) ?? [];
    list.push(v);
    variantsByProduct.set(v.productId, list);
    if (v.isDefault) defaultVariantByProduct.set(v.productId, v);
  }

  const valueRows = localValueIds.size
    ? await db
        .select({ id: optionValues.id, mizaneId: optionValues.mizaneId })
        .from(optionValues)
        .where(inArray(optionValues.id, [...localValueIds]))
    : [];
  const valueMizaneById = new Map(valueRows.map((v) => [v.id, v.mizaneId]));

  const lines: MizaneOrderLine[] = parsedItems.map((item) => {
    const variantMizaneId = resolveVariantMizaneId(item, {
      variantById,
      defaultVariantByProduct,
      variantsByProduct,
    });

    const selectedOptions: MizaneSelectedOption[] = [];
    for (const selection of item.options?.selections ?? []) {
      for (const value of selection.values) {
        const mizaneId = valueMizaneById.get(value.valueId);
        if (!mizaneId) {
          throw new MizaneOrderMappingError(
            `Valeur d'option sans correspondance Mizane (${value.valueName}).`,
          );
        }
        selectedOptions.push({ optionValueId: mizaneId, quantity: value.quantity });
      }
    }

    return {
      variantId: variantMizaneId,
      quantity: item.quantity,
      selectedOptions,
    };
  });

  const tableId =
    order.type === "dine_in" && order.mizaneTableId
      ? order.mizaneTableId
      : undefined;

  const noteParts: string[] = [];
  // When the order carries a real Mizane tableId the POS already knows the
  // table, so the note is redundant; only surface the table label in notes for
  // a manual/legacy table number (no tableId to send).
  if (order.type === "dine_in" && order.tableNumber && !tableId) {
    noteParts.push(`Table ${order.tableNumber}`);
  }
  if (order.notes) noteParts.push(order.notes);

  const request: MizaneOrderRequest = {
    idempotencyKey: order.id,
    customerName: order.customerName || undefined,
    customerPhone: order.customerPhone || undefined,
    tableId,
    notes: noteParts.length ? noteParts.join(" — ") : undefined,
    lines,
  };

  let response: Awaited<ReturnType<typeof postMizaneOrder>>;
  try {
    response = await postMizaneOrder(apiKey, request);
  } catch (err) {
    // A stale QR can point at a table Mizane has since removed. Rather than drop
    // the order, fall back to a counter order (no table) — the contract's
    // recommended recovery for `table-unknown`.
    if (err instanceof MizaneError && err.code === "table-unknown" && tableId) {
      console.warn(
        `[mizane] table ${tableId} unknown for order ${order.id}; retrying as counter order.`,
      );
      response = await postMizaneOrder(apiKey, { ...request, tableId: undefined });
    } else {
      throw err;
    }
  }

  // Mizane recomputes prices/options server-side from its live menu, so its
  // total is authoritative — adopt it as THE order total (the customer tracker
  // reads orders.total). With a synced catalog this equals the local total; if
  // it diverges (stale local cache) Mizane wins, which is what the customer pays.
  await db
    .update(orders)
    .set({
      mizaneOrderId: response.orderId,
      total: response.total,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id));

  await recordOrderEvent(order.id, "order.mizane_posted", {
    actor: { userId: null, role: "system" },
    payload: {
      mizane_order_id: response.orderId,
      mizane_order_number: response.orderNumber,
      mizane_status: response.status,
      total: response.total,
    },
  });

  // The POST may already come back terminal; reconcile immediately.
  await applyMizaneStatus(order.id, businessId, response.orderId, response.status);

  return { mizaneOrderId: response.orderId, status: response.status };
}

function resolveVariantMizaneId(
  item: { productId: string | null; options: { variantId: string | null } | null },
  maps: {
    variantById: Map<string, { mizaneId: string | null }>;
    defaultVariantByProduct: Map<string, { mizaneId: string | null }>;
    variantsByProduct: Map<string, { mizaneId: string | null }[]>;
  },
): string {
  const explicitVariantId = item.options?.variantId ?? null;
  if (explicitVariantId) {
    const variant = maps.variantById.get(explicitVariantId);
    if (variant?.mizaneId) return variant.mizaneId;
    throw new MizaneOrderMappingError(
      "Variante de la commande sans correspondance Mizane.",
    );
  }

  if (!item.productId) {
    throw new MizaneOrderMappingError("Article sans produit lié.");
  }

  // Single-variant products store no explicit variant id — fall back to the
  // default variant, then to the sole variant if there is exactly one.
  const fallback =
    maps.defaultVariantByProduct.get(item.productId) ??
    (maps.variantsByProduct.get(item.productId)?.length === 1
      ? maps.variantsByProduct.get(item.productId)![0]
      : undefined);

  if (fallback?.mizaneId) return fallback.mizaneId;
  throw new MizaneOrderMappingError(
    "Produit de la commande sans variante Mizane.",
  );
}

export type MizanePollResult = {
  polled: number;
  confirmed: number;
  rejected: number;
  errors: number;
  // True when the call short-circuited on the throttle without contacting Mizane.
  skipped: boolean;
};

/**
 * Polls Mizane for every pending order this business has posted and applies the
 * resulting status: confirmed → order.confirmed, rejected → order.cancelled.
 * Designed to be called on garcon snapshot refresh — failures per order are
 * swallowed so one bad order never blocks the others. Throttled per business
 * (see {@link shouldPollMizane}); pass `force` to bypass (e.g. a manual refresh).
 */
export async function syncPendingMizaneOrders(
  businessId: string,
  apiKey: string,
  opts: { force?: boolean } = {},
): Promise<MizanePollResult> {
  const empty: MizanePollResult = {
    polled: 0,
    confirmed: 0,
    rejected: 0,
    errors: 0,
    skipped: false,
  };

  if (!opts.force && !shouldPollMizane(businessId, Date.now())) {
    return { ...empty, skipped: true };
  }

  // Poll every still-active order (not just pending) so downstream progress —
  // preparing → ready → done — keeps reconciling after the initial confirm.
  const pendingRows = await db
    .select({ id: orders.id, mizaneOrderId: orders.mizaneOrderId })
    .from(orders)
    .where(
      and(
        eq(orders.businessId, businessId),
        inArray(orders.status, ONLINE_ACTIVE_STATUSES),
        isNotNull(orders.mizaneOrderId),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(MAX_ORDERS_PER_POLL);

  if (pendingRows.length === MAX_ORDERS_PER_POLL) {
    console.warn(
      `[mizane] poll hit the ${MAX_ORDERS_PER_POLL}-order cap for business ${businessId}; some pending orders will reconcile on the next poll.`,
    );
  }

  const result: MizanePollResult = { ...empty };

  for (const row of pendingRows) {
    if (!row.mizaneOrderId) continue;
    result.polled += 1;
    try {
      const status = await getMizaneOrderStatus(apiKey, row.mizaneOrderId);
      const applied = await applyMizaneStatus(
        row.id,
        businessId,
        row.mizaneOrderId,
        status.status,
        status.fulfillment,
        status.rejectedReason,
      );
      if (applied === "cancelled") result.rejected += 1;
      else if (applied) result.confirmed += 1;
    } catch (err) {
      result.errors += 1;
      console.error(
        `[mizane] poll failed for order ${row.id} (mizane ${row.mizaneOrderId}):`,
        err,
      );
    }
  }

  return result;
}

/**
 * Translates a Mizane (status, fulfillment) pair into the QuickArte lifecycle
 * target and advances the order to it. Returns the QuickArte status applied (the
 * furthest step reached), or null when Mizane is still pending / reports nothing
 * actionable (we keep waiting).
 *
 * `confirmed` + `fulfillment` carries the real order's downstream POS state:
 *   in_progress → preparing, served → ready, paid/unpaid → completed (done),
 *   voided/refunded → cancelled. `rejected` → cancelled. The order only ever
 *   moves FORWARD along the online flow (never backward).
 */
async function applyMizaneStatus(
  orderId: string,
  businessId: string,
  mizaneOrderId: string,
  status: MizaneOrderStatus,
  fulfillment?: MizaneFulfillment,
  rejectedReason?: string,
): Promise<OrderLifecycleStatus | null> {
  const target = mizaneTargetStatus(status, fulfillment);
  if (!target) return null;

  if (target === "cancelled") {
    const result = await transitionOrder(
      orderId,
      "cancelled",
      { userId: null, role: "system" },
      {
        businessId,
        payload: {
          source: "mizane",
          mizane_order_id: mizaneOrderId,
          rejected_reason: rejectedReason ?? null,
        },
      },
    );
    return result.status === "success" ? "cancelled" : null;
  }

  return advanceOrderToward(orderId, businessId, target, mizaneOrderId);
}

/** Advance an order FORWARD along the online flow toward `target`, one valid
 * transition at a time (Mizane can jump stages between polls, e.g. pending →
 * ready). Never moves backward; stops at a terminal status. Returns the last
 * status applied, or null if nothing moved. */
async function advanceOrderToward(
  orderId: string,
  businessId: string,
  target: OrderLifecycleStatus,
  mizaneOrderId: string,
): Promise<OrderLifecycleStatus | null> {
  let applied: OrderLifecycleStatus | null = null;

  // Bounded by the flow length; re-reads current each step so concurrent polls
  // can't loop it.
  for (let guard = 0; guard < ONLINE_ACTIVE_STATUSES.length + 1; guard += 1) {
    const [row] = await db
      .select({ status: orders.status })
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.businessId, businessId)))
      .limit(1);
    if (!row) return applied;

    const current = row.status as OrderLifecycleStatus;
    if (isTerminalOrderStatus(current)) return applied;

    const next = nextStepToward(current, target);
    if (!next) return applied; // already at/past the target along the flow

    const result = await transitionOrder(orderId, next, { userId: null, role: "system" }, {
      businessId,
      payload: { source: "mizane", mizane_order_id: mizaneOrderId },
    });
    if (result.status !== "success") return applied;
    applied = next;
    if (next === target) return applied;
  }

  return applied;
}

/**
 * Token-keyed reconcile for the customer order tracker. Resolves the order's
 * business from its customer access token, then polls that business's pending
 * Mizane orders. This re-homes the reconcile that used to fire from the
 * (now-removed) garcon snapshot onto the customer status poll — non-fatal and
 * throttled per business (15s) by {@link syncPendingMizaneOrders}, so concurrent
 * customers polling the same business never fan out past the rate limit.
 */
export async function reconcileMizaneForCustomerToken(
  token: string,
): Promise<void> {
  const row = await db.query.orders.findFirst({
    where: eq(orders.customerAccessToken, token),
    columns: { businessId: true },
  });
  if (!row) return;
  const integration = await getMizaneIntegration(row.businessId);
  if (!integration) return;
  await syncPendingMizaneOrders(row.businessId, integration.apiKey);
}
