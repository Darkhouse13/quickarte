import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import {
  canTransitionOrderStatus,
  type OrderLifecycleStatus,
} from "@/lib/ordering/status";
import {
  recordOrderEvent,
  type OrderEventActor,
  type OrderEventType,
} from "@/lib/ordering/events";
import { accrueCreditsForServedOrder } from "@/lib/loyalty/accrual";

export type TransitionOrderResult =
  | { status: "success"; fromStatus: OrderLifecycleStatus; toStatus: OrderLifecycleStatus }
  | { status: "not_found" }
  | { status: "invalid_transition"; fromStatus: OrderLifecycleStatus; toStatus: OrderLifecycleStatus };

type TransitionOrderOptions = {
  businessId?: string;
  notes?: string | null;
  payload?: Record<string, unknown>;
  deps?: TransitionOrderDeps;
};

type TransactionLike = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type TransitionOrderDeps = {
  transaction: typeof db.transaction;
  recordEvent: typeof recordOrderEvent;
  accrueCredits?: typeof accrueCreditsForServedOrder;
};

const defaultDeps: TransitionOrderDeps = {
  transaction: db.transaction.bind(db) as typeof db.transaction,
  recordEvent: recordOrderEvent,
  accrueCredits: accrueCreditsForServedOrder,
};

export async function transitionOrder(
  orderId: string,
  toStatus: OrderLifecycleStatus,
  actor: OrderEventActor,
  opts: TransitionOrderOptions = {},
): Promise<TransitionOrderResult> {
  const deps = opts.deps ?? defaultDeps;
  const result: TransitionOrderResult = await deps.transaction(async (tx: TransactionLike) => {
    const order = await tx.query.orders.findFirst({
      where: opts.businessId
        ? and(eq(orders.id, orderId), eq(orders.businessId, opts.businessId))
        : eq(orders.id, orderId),
      columns: { id: true, status: true },
    });
    if (!order) return { status: "not_found" };

    const fromStatus = order.status as OrderLifecycleStatus;
    if (fromStatus === toStatus) {
      return { status: "success", fromStatus, toStatus };
    }

    if (!validateOrderTransition(fromStatus, toStatus)) {
      return { status: "invalid_transition", fromStatus, toStatus };
    }

    await tx
      .update(orders)
      .set({
        status: toStatus,
        notes: opts.notes,
        updatedAt: new Date(),
      })
      .where(
        opts.businessId
          ? and(eq(orders.id, orderId), eq(orders.businessId, opts.businessId))
          : eq(orders.id, orderId),
      );

    await deps.recordEvent(orderId, eventForStatus(toStatus), {
      actor,
      payload: { from_status: fromStatus, to_status: toStatus, ...opts.payload },
      tx,
    });

    return { status: "success", fromStatus, toStatus };
  });
  if (
    result.status === "success" &&
    result.toStatus === "completed" &&
    result.fromStatus !== "completed"
  ) {
    try {
      await deps.accrueCredits?.(orderId);
    } catch (err) {
      console.error("[loyalty] credit accrual on order.served failed (non-fatal):", err);
    }
  }
  return result;
}

export function validateOrderTransition(
  fromStatus: OrderLifecycleStatus,
  toStatus: OrderLifecycleStatus,
): boolean {
  return canTransitionOrderStatus(fromStatus, toStatus);
}

function eventForStatus(status: OrderLifecycleStatus): OrderEventType {
  switch (status) {
    case "confirmed":
      return "order.accepted";
    case "preparing":
      return "order.preparing";
    case "ready":
      return "order.ready";
    case "completed":
      return "order.served";
    case "cancelled":
      return "order.cancelled";
    case "pending":
      return "order.created";
  }
}
