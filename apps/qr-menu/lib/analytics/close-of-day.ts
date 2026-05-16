import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  DEFAULT_BUSINESS_TIMEZONE,
  getBusinessDayBoundsForOffsetFromDate,
  type BusinessDayBounds,
} from "@/lib/business/business-day";

export type CloseOrderType = "dine_in" | "takeaway" | "delivery";
export type CloseStatusBucket =
  | "pending"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

export type CountAndRevenue = {
  count: number;
  revenueMad: number;
};

/**
 * Close-of-day money values use the same unit as orders.total. In the current
 * schema that is a decimal MAD numeric value, not cents. Cancelled orders are
 * excluded from revenueMad, averageTicketMad, byType counts/revenue, and CSV
 * totals, but remain visible in cancelledCount, byStatus.cancelled, and the CSV
 * body.
 */
export type DailyClose = {
  date: BusinessDayBounds;
  totals: {
    orderCount: number;
    revenueMad: number;
    averageTicketMad: number;
    cancelledCount: number;
  };
  byType: Record<CloseOrderType, CountAndRevenue>;
  byStatus: Record<CloseStatusBucket, number>;
  comparison: {
    lastWeekRevenueMad: number;
    lastWeekOrderCount: number;
  };
};

export type DailyCloseAggregateRow = {
  order_count: number;
  revenue_mad: string;
  cancelled_count: number;
  dine_in_count: number;
  dine_in_revenue_mad: string;
  takeaway_count: number;
  takeaway_revenue_mad: string;
  delivery_count: number;
  delivery_revenue_mad: string;
  pending_count: number;
  preparing_count: number;
  ready_count: number;
  completed_count: number;
  cancelled_status_count: number;
  last_week_revenue_mad: string;
  last_week_order_count: number;
};

export type DailyCloseQuery = (
  businessId: string,
  bounds: BusinessDayBounds,
  comparisonBounds: BusinessDayBounds,
) => Promise<DailyCloseAggregateRow>;

export type DailyCloseOptions = {
  query?: DailyCloseQuery;
  timezone?: string;
};

export async function getDailyClose(
  businessId: string,
  dateUtcBounds: BusinessDayBounds,
  options: DailyCloseOptions = {},
): Promise<DailyClose> {
  const timezone = options.timezone ?? DEFAULT_BUSINESS_TIMEZONE;
  const comparisonBounds = getBusinessDayBoundsForOffsetFromDate(
    dateUtcBounds.startUtc,
    -7,
    timezone,
  );
  const row = await (options.query ?? queryDailyCloseAggregate)(
    businessId,
    dateUtcBounds,
    comparisonBounds,
  );

  return dailyCloseFromAggregateRow(dateUtcBounds, row);
}

export function dailyCloseFromAggregateRow(
  dateUtcBounds: BusinessDayBounds,
  row: DailyCloseAggregateRow,
): DailyClose {
  const revenueMad = toNumber(row.revenue_mad);
  const orderCount = row.order_count;

  return {
    date: dateUtcBounds,
    totals: {
      orderCount,
      revenueMad,
      averageTicketMad: orderCount > 0 ? revenueMad / orderCount : 0,
      cancelledCount: row.cancelled_count,
    },
    byType: {
      dine_in: {
        count: row.dine_in_count,
        revenueMad: toNumber(row.dine_in_revenue_mad),
      },
      takeaway: {
        count: row.takeaway_count,
        revenueMad: toNumber(row.takeaway_revenue_mad),
      },
      delivery: {
        count: row.delivery_count,
        revenueMad: toNumber(row.delivery_revenue_mad),
      },
    },
    byStatus: {
      pending: row.pending_count,
      preparing: row.preparing_count,
      ready: row.ready_count,
      completed: row.completed_count,
      cancelled: row.cancelled_status_count,
    },
    comparison: {
      lastWeekRevenueMad: toNumber(row.last_week_revenue_mad),
      lastWeekOrderCount: row.last_week_order_count,
    },
  };
}

async function queryDailyCloseAggregate(
  businessId: string,
  bounds: BusinessDayBounds,
  comparisonBounds: BusinessDayBounds,
): Promise<DailyCloseAggregateRow> {
  const result = await db.execute<DailyCloseAggregateRow>(sql`
    WITH
      current_orders AS (
        SELECT status, type, total
        FROM orders
        WHERE business_id = ${businessId}::uuid
          AND created_at >= ${bounds.startUtc}
          AND created_at < ${bounds.endUtc}
      ),
      last_week_orders AS (
        SELECT status, total
        FROM orders
        WHERE business_id = ${businessId}::uuid
          AND created_at >= ${comparisonBounds.startUtc}
          AND created_at < ${comparisonBounds.endUtc}
      )
    SELECT
      (SELECT count(*)::int FROM current_orders WHERE status <> 'cancelled') AS order_count,
      (SELECT coalesce(sum(total), 0)::text FROM current_orders WHERE status <> 'cancelled') AS revenue_mad,
      (SELECT count(*)::int FROM current_orders WHERE status = 'cancelled') AS cancelled_count,

      (SELECT count(*)::int FROM current_orders WHERE type = 'dine_in' AND status <> 'cancelled') AS dine_in_count,
      (SELECT coalesce(sum(total), 0)::text FROM current_orders WHERE type = 'dine_in' AND status <> 'cancelled') AS dine_in_revenue_mad,
      (SELECT count(*)::int FROM current_orders WHERE type = 'takeaway' AND status <> 'cancelled') AS takeaway_count,
      (SELECT coalesce(sum(total), 0)::text FROM current_orders WHERE type = 'takeaway' AND status <> 'cancelled') AS takeaway_revenue_mad,
      (SELECT count(*)::int FROM current_orders WHERE type = 'delivery' AND status <> 'cancelled') AS delivery_count,
      (SELECT coalesce(sum(total), 0)::text FROM current_orders WHERE type = 'delivery' AND status <> 'cancelled') AS delivery_revenue_mad,

      (SELECT count(*)::int FROM current_orders WHERE status IN ('pending', 'confirmed')) AS pending_count,
      (SELECT count(*)::int FROM current_orders WHERE status = 'preparing') AS preparing_count,
      (SELECT count(*)::int FROM current_orders WHERE status = 'ready') AS ready_count,
      (SELECT count(*)::int FROM current_orders WHERE status = 'completed') AS completed_count,
      (SELECT count(*)::int FROM current_orders WHERE status = 'cancelled') AS cancelled_status_count,

      (SELECT coalesce(sum(total), 0)::text FROM last_week_orders WHERE status <> 'cancelled') AS last_week_revenue_mad,
      (SELECT count(*)::int FROM last_week_orders WHERE status <> 'cancelled') AS last_week_order_count
  `);

  return result.rows[0] ?? emptyAggregateRow();
}

function emptyAggregateRow(): DailyCloseAggregateRow {
  return {
    order_count: 0,
    revenue_mad: "0",
    cancelled_count: 0,
    dine_in_count: 0,
    dine_in_revenue_mad: "0",
    takeaway_count: 0,
    takeaway_revenue_mad: "0",
    delivery_count: 0,
    delivery_revenue_mad: "0",
    pending_count: 0,
    preparing_count: 0,
    ready_count: 0,
    completed_count: 0,
    cancelled_status_count: 0,
    last_week_revenue_mad: "0",
    last_week_order_count: 0,
  };
}

function toNumber(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
