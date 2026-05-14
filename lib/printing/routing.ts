import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categoryPrintRoutes } from "@/lib/db/schema";
import type { OrderItem } from "@/lib/db/schema";

export type Station = "counter" | "kitchen" | "bar";

export const ALL_PRINT_STATIONS: Station[] = ["counter", "kitchen", "bar"];

type TransactionLike = Pick<typeof db, "select">;

export type RoutableOrderItem = OrderItem & {
  product?: { categoryId: string | null } | null;
};

/**
 * Category routing is intentionally category-only. A category with no explicit
 * rows routes everywhere to preserve the original print pipeline. The counter
 * station is also the cashier-facing everything station by convention, so
 * splitOrderItemsByStation always includes every order item under `counter`
 * even when kitchen/bar rows exist for that category.
 */
export async function getRoutedStationsForCategory(
  businessId: string,
  categoryId: string | null,
  tx: TransactionLike = db,
): Promise<Station[]> {
  if (!categoryId) return [...ALL_PRINT_STATIONS];

  const rows = await tx
    .select({ station: categoryPrintRoutes.station })
    .from(categoryPrintRoutes)
    .where(
      and(
        eq(categoryPrintRoutes.businessId, businessId),
        eq(categoryPrintRoutes.categoryId, categoryId),
      ),
    );

  if (rows.length === 0) return [...ALL_PRINT_STATIONS];
  return rows.map((row) => row.station as Station);
}

export async function splitOrderItemsByStation<TItem extends RoutableOrderItem>(
  orderItems: TItem[],
  businessId: string,
  tx: TransactionLike = db,
): Promise<Map<Station, TItem[]>> {
  const result = new Map<Station, TItem[]>();
  const stationCache = new Map<string, Station[]>();

  for (const item of orderItems) {
    const categoryId = item.product?.categoryId ?? null;
    const cacheKey = categoryId ?? "__uncategorized__";
    let stations = stationCache.get(cacheKey);
    if (!stations) {
      stations = await getRoutedStationsForCategory(businessId, categoryId, tx);
      if (!stations.includes("counter")) stations = ["counter", ...stations];
      stationCache.set(cacheKey, stations);
    }

    for (const station of stations) {
      const list = result.get(station);
      if (list) {
        list.push(item);
      } else {
        result.set(station, [item]);
      }
    }
  }

  return result;
}
