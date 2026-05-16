import { db } from "@/lib/db";
import { orderEvents } from "@quickarte/db-schema";
import type { StaffRole } from "@/lib/identity/permissions";

export const ORDER_EVENT_TYPES = [
  "order.created",
  "order.accepted",
  "order.preparing",
  "order.ready",
  "order.served",
  "order.cancelled",
  "order.printed",
  "order.reprinted",
  "order.pos_entered",
  "order.pos_skipped",
  "order.pos_reverted",
] as const;

export type OrderEventType = (typeof ORDER_EVENT_TYPES)[number];

export type OrderEventActor = {
  userId: string | null;
  role: StaffRole | "customer" | "system" | null;
};

export type RecordOrderEventOptions = {
  actor?: OrderEventActor;
  payload?: Record<string, unknown>;
  tx?: TransactionLike;
};

type TransactionLike = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function recordOrderEvent(
  orderId: string,
  eventType: OrderEventType,
  opts: RecordOrderEventOptions = {},
): Promise<void> {
  const writer = opts.tx ?? db;
  await writer.insert(orderEvents).values({
    orderId,
    eventType,
    actorUserId: opts.actor?.userId ?? null,
    actorRole: opts.actor?.role ?? null,
    payloadJson: opts.payload ?? null,
  });
}
