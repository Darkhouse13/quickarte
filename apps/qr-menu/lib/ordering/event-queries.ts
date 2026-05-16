import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderEvents, orders, staffMembers, users } from "@quickarte/db-schema";
import type { StaffRole } from "@/lib/identity/permissions";
import type { OrderEventType } from "@/lib/ordering/events";

export type JournalEvent = {
  id: string;
  orderId: string;
  eventType: OrderEventType | string;
  actorDisplayName: string | null;
  actorRole: StaffRole | "customer" | "system" | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

export async function getEventsForOrders(
  businessId: string,
  orderIds: string[],
): Promise<Map<string, JournalEvent[]>> {
  const result = new Map<string, JournalEvent[]>();
  if (orderIds.length === 0) return result;

  const rows = await db
    .select({
      id: orderEvents.id,
      orderId: orderEvents.orderId,
      eventType: orderEvents.eventType,
      actorUserId: orderEvents.actorUserId,
      actorRole: orderEvents.actorRole,
      payloadJson: orderEvents.payloadJson,
      createdAt: orderEvents.createdAt,
      orderBusinessId: orders.businessId,
      staffDisplayName: staffMembers.displayName,
      userName: users.name,
    })
    .from(orderEvents)
    .innerJoin(orders, eq(orderEvents.orderId, orders.id))
    .leftJoin(users, eq(orderEvents.actorUserId, users.id))
    .leftJoin(
      staffMembers,
      and(
        eq(staffMembers.userId, orderEvents.actorUserId),
        eq(staffMembers.businessId, orders.businessId),
      ),
    )
    .where(
      and(
        eq(orders.businessId, businessId),
        inArray(orderEvents.orderId, orderIds),
      ),
    )
    .orderBy(asc(orderEvents.createdAt));

  for (const row of rows) {
    const list = result.get(row.orderId) ?? [];
    const actorDisplayName = row.staffDisplayName ?? row.userName ?? null;
    list.push({
      id: row.id,
      orderId: row.orderId,
      eventType: row.eventType,
      actorDisplayName,
      actorRole: (row.actorRole as JournalEvent["actorRole"]) ?? null,
      payload:
        (row.payloadJson as Record<string, unknown> | null | undefined) ?? null,
      createdAt: row.createdAt.toISOString(),
    });
    result.set(row.orderId, list);
  }

  return result;
}
