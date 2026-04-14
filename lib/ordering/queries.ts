import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, type Order, type OrderItem } from "@/lib/db/schema";

export type OrderItemWithProduct = OrderItem & {
  product: { id: string; name: string } | null;
};

export type OrderWithItems = Order & {
  items: OrderItemWithProduct[];
};

export async function getOrdersByBusinessId(
  businessId: string,
  status?: "pending" | "confirmed" | "completed" | "cancelled",
): Promise<OrderWithItems[]> {
  const rows = await db.query.orders.findMany({
    where: status
      ? and(eq(orders.businessId, businessId), eq(orders.status, status))
      : eq(orders.businessId, businessId),
    orderBy: [desc(orders.createdAt)],
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
  return rows as OrderWithItems[];
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
  return (row as OrderWithItems | undefined) ?? null;
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
  return rows as OrderWithItems[];
}

export type { OrderItem, Order };
