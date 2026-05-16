import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import type { OrderLifecycleStatus } from "@/lib/ordering/status";
import { summarizeOrderItemOptions } from "@/lib/ordering/order-item-options";

export type KitchenOrderItem = {
  id: string;
  productName: string;
  quantity: number;
  optionLines: string[];
};

export type KitchenOrder = {
  id: string;
  status: OrderLifecycleStatus;
  type: "dine_in" | "takeaway" | "delivery";
  tableNumber: string | null;
  customerName: string;
  notes: string | null;
  createdAt: string;
  statusEnteredAt: string;
  // 'credits' surfaces the RÉCOMPENSE pill so the kitchen knows this order
  // was paid in loyalty credits, not MAD. Optional for compatibility with
  // historical rows where paymentMode might be null.
  paymentMode: "mad" | "credits" | null;
  items: KitchenOrderItem[];
};

const OPEN_KITCHEN_STATUSES: OrderLifecycleStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
];

export async function getOpenKitchenOrders(
  businessId: string,
): Promise<KitchenOrder[]> {
  const rows = await db.query.orders.findMany({
    where: and(
      eq(orders.businessId, businessId),
      inArray(orders.status, OPEN_KITCHEN_STATUSES),
    ),
    orderBy: [desc(orders.createdAt)],
    with: {
      items: {
        with: { product: { columns: { name: true } } },
      },
    },
  });

  return rows.map((row) => {
    const items: KitchenOrderItem[] = row.items.map((item) => {
      return {
        id: item.id,
        productName: item.product?.name ?? "Article supprimé",
        quantity: item.quantity,
        optionLines: summarizeOrderItemOptions(item.optionsJson),
      };
    });

    return {
      id: row.id,
      status: row.status as OrderLifecycleStatus,
      type: row.type,
      tableNumber: row.tableNumber,
      customerName: row.customerName,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      // updatedAt is bumped by transitionOrder, so it tracks when the order
      // entered its current status — used for the 60s ready-linger window.
      statusEnteredAt: row.updatedAt.toISOString(),
      paymentMode: row.paymentMode ?? null,
      items,
    };
  });
}
