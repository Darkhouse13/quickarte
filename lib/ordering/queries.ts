import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, type Order, type OrderItem } from "@/lib/db/schema";

export type OrderItemWithProduct = OrderItem & {
  product: { id: string; name: string } | null;
};

export type OrderWithItems = Order & {
  items: OrderItemWithProduct[];
};

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
  return (row as OrderWithItems) ?? null;
}

export type { OrderItem, Order };
