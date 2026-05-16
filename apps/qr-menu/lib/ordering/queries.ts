import "server-only";
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, staffMembers, type Order, type OrderItem } from "@/lib/db/schema";
import type { OrderLifecycleStatus } from "./status";
import type { PosStatus } from "./pos-reconciliation";

export type OrderItemWithProduct = OrderItem & {
  product: { id: string; name: string } | null;
};

export type OrderWithItems = Order & {
  items: OrderItemWithProduct[];
  posStatus: PosStatus;
  posEnteredByDisplayName: string | null;
};

export async function getOrdersByBusinessId(
  businessId: string,
  status?: OrderLifecycleStatus,
  limit = 50,
): Promise<OrderWithItems[]> {
  const rows = await db.query.orders.findMany({
    where: status
      ? and(eq(orders.businessId, businessId), eq(orders.status, status))
      : eq(orders.businessId, businessId),
    orderBy: [desc(orders.createdAt)],
    limit,
    with: {
      items: {
        with: {
          product: {
            columns: { id: true, name: true },
          },
        },
      },
    },
  });
  return attachPosDisplayNames(businessId, rows as OrderWithItems[]);
}

export async function getOrderById(
  orderId: string,
): Promise<OrderWithItems | null> {
  const row = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: {
      items: {
        with: {
          product: { columns: { id: true, name: true } },
        },
      },
    },
  });
  if (!row) return null;
  const [withName] = await attachPosDisplayNames(row.businessId, [
    row as OrderWithItems,
  ]);
  return withName ?? null;
}

export type OrderStats = {
  todayOrderCount: number;
  todayRevenue: number;
  pendingCount: number;
};

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export async function getOrderStats(businessId: string): Promise<OrderStats> {
  const startOfToday = startOfTodayUtc();

  const [todayAgg] = await db
    .select({
      count: sql<number>`count(*)::int`,
      revenue: sql<string>`coalesce(sum(${orders.total}), 0)`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.businessId, businessId),
        gte(orders.createdAt, startOfToday),
      ),
    );

  const [pendingAgg] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(
      and(eq(orders.businessId, businessId), eq(orders.status, "pending")),
    );

  return {
    todayOrderCount: todayAgg?.count ?? 0,
    todayRevenue: Number(todayAgg?.revenue ?? 0),
    pendingCount: pendingAgg?.count ?? 0,
  };
}

export async function getRecentOrders(
  businessId: string,
  limit = 5,
): Promise<OrderWithItems[]> {
  const rows = await db.query.orders.findMany({
    where: eq(orders.businessId, businessId),
    orderBy: [desc(orders.createdAt)],
    limit,
    with: {
      items: {
        with: {
          product: { columns: { id: true, name: true } },
        },
      },
    },
  });
  return attachPosDisplayNames(businessId, rows as OrderWithItems[]);
}

async function attachPosDisplayNames(
  businessId: string,
  rows: OrderWithItems[],
): Promise<OrderWithItems[]> {
  const userIds = Array.from(
    new Set(
      rows
        .map((order) => order.posEnteredByUserId)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  if (userIds.length === 0) {
    return rows.map((order) => ({ ...order, posEnteredByDisplayName: null }));
  }

  const staffRows = await db
    .select({
      userId: staffMembers.userId,
      displayName: staffMembers.displayName,
    })
    .from(staffMembers)
    .where(
      and(
        eq(staffMembers.businessId, businessId),
        inArray(staffMembers.userId, userIds),
        isNull(staffMembers.revokedAt),
      ),
    );
  const byUserId = new Map(
    staffRows
      .filter((row): row is { userId: string; displayName: string } =>
        Boolean(row.userId),
      )
      .map((row) => [row.userId, row.displayName]),
  );

  return rows.map((order) => ({
    ...order,
    posEnteredByDisplayName: order.posEnteredByUserId
      ? byUserId.get(order.posEnteredByUserId) ?? null
      : null,
  }));
}

export type { OrderItem, Order };
