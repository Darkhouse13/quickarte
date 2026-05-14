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

export type TransitionOrderResult =
  | { status: "success"; fromStatus: OrderLifecycleStatus; toStatus: OrderLifecycleStatus }
  | { status: "not_found" }
  | { status: "invalid_transition"; fromStatus: OrderLifecycleStatus; toStatus: OrderLifecycleStatus };

type TransitionOrderOptions = {
  businessId?: string;
  notes?: string | null;
  payload?: Record<string, unknown>;
};

export async function transitionOrder(
  orderId: string,
  toStatus: OrderLifecycleStatus,
  actor: OrderEventActor,
  opts: TransitionOrderOptions = {},
): Promise<TransitionOrderResult> {
  return db.transaction(async (tx) => {
    const order = await tx.query.orders.findFirst({
      where: opts.businessId
        ? and(eq(orders.id, orderId), eq(orders.businessId, opts.businessId))
        : eq(orders.id, orderId),
      columns: { id: true, status: true },
    });
    if (!order) return { status: "not_found" };

    const fromStatus = order.status as OrderLifecycleStatus;
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

    await recordOrderEvent(orderId, eventForStatus(toStatus), {
      actor,
      payload: { from_status: fromStatus, to_status: toStatus, ...opts.payload },
      tx,
    });

    return { status: "success", fromStatus, toStatus };
  });
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
