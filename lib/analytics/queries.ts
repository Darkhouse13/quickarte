import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { formatPhoneForDisplay } from "@/lib/utils/phone";
import { dayNameFromMondayIndex } from "./format";
import type {
  AnalyticsRange,
  AnalyticsSummary,
  HeatmapCell,
  ProductPerformance,
  ProductPerformanceEntry,
  RevenueByDayPoint,
  TopLoyalCustomer,
} from "./types";

function rangeDays(range: AnalyticsRange): number {
  return range === "7d" ? 7 : 30;
}

// Postgres DOW: 0=Sun..6=Sat. Convert to Monday-first: 0=Mon..6=Sun.
function pgDowToMondayFirst(dow: number): number {
  return (dow + 6) % 7;
}

function computeDelta(
  current: number,
  previous: number,
  hadPrior: boolean,
): number | null {
  if (!hadPrior) return null;
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export async function getSummary(
  businessId: string,
  range: AnalyticsRange,
): Promise<AnalyticsSummary> {
  const days = rangeDays(range);

  type Row = {
    revenue: string;
    order_count: number;
    prev_revenue: string;
    prev_order_count: number;
    new_loyalty_customers: number;
    best_days: Array<{ dow: number; rev: string }> | null;
  };

  const result = await db.execute<Row>(sql`
    WITH
      today_p AS (SELECT (now() AT TIME ZONE 'Europe/Paris')::date AS d),
      bounds AS (
        SELECT
          ((SELECT d FROM today_p) - (${days - 1} * interval '1 day'))::date AS range_start_d,
          ((SELECT d FROM today_p) + interval '1 day')::date AS range_end_d,
          ((SELECT d FROM today_p) - (${2 * days - 1} * interval '1 day'))::date AS prev_start_d,
          ((SELECT d FROM today_p) - (${days - 1} * interval '1 day'))::date AS prev_end_d
      ),
      bounds_ts AS (
        SELECT
          (range_start_d::timestamp AT TIME ZONE 'Europe/Paris') AS range_start_ts,
          (range_end_d::timestamp AT TIME ZONE 'Europe/Paris')   AS range_end_ts,
          (prev_start_d::timestamp  AT TIME ZONE 'Europe/Paris') AS prev_start_ts,
          (prev_end_d::timestamp    AT TIME ZONE 'Europe/Paris') AS prev_end_ts
        FROM bounds
      ),
      current_orders AS (
        SELECT o.total,
          EXTRACT(DOW FROM (o.created_at AT TIME ZONE 'Europe/Paris'))::int AS dow
        FROM orders o, bounds_ts b
        WHERE o.business_id = ${businessId}::uuid
          AND o.status IN ('confirmed', 'completed')
          AND o.created_at >= b.range_start_ts
          AND o.created_at <  b.range_end_ts
      ),
      prev_orders AS (
        SELECT o.total
        FROM orders o, bounds_ts b
        WHERE o.business_id = ${businessId}::uuid
          AND o.status IN ('confirmed', 'completed')
          AND o.created_at >= b.prev_start_ts
          AND o.created_at <  b.prev_end_ts
      ),
      new_loyalty AS (
        SELECT count(*)::int AS n
        FROM loyalty_customers lc, bounds_ts b
        WHERE lc.business_id = ${businessId}::uuid
          AND lc.created_at >= b.range_start_ts
          AND lc.created_at <  b.range_end_ts
      ),
      best AS (
        SELECT dow, sum(total)::numeric AS rev
        FROM current_orders
        GROUP BY dow
        ORDER BY rev DESC NULLS LAST
        LIMIT 2
      )
    SELECT
      (SELECT coalesce(sum(total), 0)::text FROM current_orders)   AS revenue,
      (SELECT count(*)::int FROM current_orders)                   AS order_count,
      (SELECT coalesce(sum(total), 0)::text FROM prev_orders)      AS prev_revenue,
      (SELECT count(*)::int FROM prev_orders)                      AS prev_order_count,
      (SELECT n FROM new_loyalty)                                  AS new_loyalty_customers,
      (SELECT json_agg(json_build_object('dow', dow, 'rev', rev::text)) FROM best)
                                                                   AS best_days
  `);

  const row = result.rows[0];
  if (!row) {
    return {
      revenue: 0,
      orderCount: 0,
      avgTicket: 0,
      newLoyaltyCustomers: 0,
      revenueDeltaPct: null,
      bestDayOfWeek: null,
    };
  }

  const revenue = Number(row.revenue);
  const orderCount = row.order_count;
  const prevRevenue = Number(row.prev_revenue);
  const prevOrderCount = row.prev_order_count;
  const hadPrior = prevOrderCount > 0;

  let bestDayOfWeek: string | null = null;
  const bestDays = row.best_days;
  if (bestDays && bestDays.length > 0) {
    const first = bestDays[0];
    if (first) {
      const firstRev = Number(first.rev);
      const secondRev =
        bestDays.length > 1 && bestDays[1]
          ? Number(bestDays[1]!.rev)
          : -Infinity;
      if (firstRev > 0 && firstRev > secondRev) {
        bestDayOfWeek = dayNameFromMondayIndex(pgDowToMondayFirst(first.dow));
      }
    }
  }

  return {
    revenue,
    orderCount,
    avgTicket: orderCount > 0 ? revenue / orderCount : 0,
    newLoyaltyCustomers: row.new_loyalty_customers ?? 0,
    revenueDeltaPct: computeDelta(revenue, prevRevenue, hadPrior),
    bestDayOfWeek,
  };
}

export async function getRevenueByDay(
  businessId: string,
  range: AnalyticsRange,
): Promise<RevenueByDayPoint[]> {
  const days = rangeDays(range);

  type Row = {
    day: string;
    revenue: string;
    order_count: number;
  };

  const result = await db.execute<Row>(sql`
    WITH
      today_p AS (SELECT (now() AT TIME ZONE 'Europe/Paris')::date AS d),
      bounds AS (
        SELECT
          ((SELECT d FROM today_p) - (${days - 1} * interval '1 day'))::date AS range_start_d,
          ((SELECT d FROM today_p))::date AS range_end_d
      ),
      day_series AS (
        SELECT gs::date AS day
        FROM bounds b, generate_series(b.range_start_d, b.range_end_d, interval '1 day') gs
      ),
      grouped AS (
        SELECT
          (o.created_at AT TIME ZONE 'Europe/Paris')::date AS day,
          sum(o.total)::text AS revenue,
          count(*)::int AS order_count
        FROM orders o, bounds b
        WHERE o.business_id = ${businessId}::uuid
          AND o.status IN ('confirmed', 'completed')
          AND o.created_at >= (b.range_start_d::timestamp AT TIME ZONE 'Europe/Paris')
          AND o.created_at <  ((b.range_end_d + interval '1 day')::timestamp AT TIME ZONE 'Europe/Paris')
        GROUP BY 1
      )
    SELECT
      to_char(ds.day, 'YYYY-MM-DD') AS day,
      coalesce(g.revenue, '0') AS revenue,
      coalesce(g.order_count, 0) AS order_count
    FROM day_series ds
    LEFT JOIN grouped g ON g.day = ds.day
    ORDER BY ds.day ASC
  `);

  return result.rows.map((r) => ({
    date: r.day,
    revenue: Number(r.revenue),
    orderCount: r.order_count,
  }));
}

export async function getProductPerformance(
  businessId: string,
  range: AnalyticsRange,
): Promise<ProductPerformance> {
  const days = rangeDays(range);

  type TopRow = {
    product_id: string;
    name: string;
    quantity: number;
    revenue: string;
  };

  const topResult = await db.execute<TopRow>(sql`
    WITH
      today_p AS (SELECT (now() AT TIME ZONE 'Europe/Paris')::date AS d),
      bounds AS (
        SELECT
          ((SELECT d FROM today_p) - (${days - 1} * interval '1 day'))::date AS range_start_d,
          ((SELECT d FROM today_p) + interval '1 day')::date AS range_end_d
      ),
      bounds_ts AS (
        SELECT
          (range_start_d::timestamp AT TIME ZONE 'Europe/Paris') AS range_start_ts,
          (range_end_d::timestamp AT TIME ZONE 'Europe/Paris')   AS range_end_ts
        FROM bounds
      ),
      item_rows AS (
        SELECT oi.product_id, oi.quantity, oi.subtotal
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id, bounds_ts b
        WHERE o.business_id = ${businessId}::uuid
          AND o.status IN ('confirmed', 'completed')
          AND o.created_at >= b.range_start_ts
          AND o.created_at <  b.range_end_ts
          AND oi.product_id IS NOT NULL
      )
    SELECT
      p.id::text AS product_id,
      p.name AS name,
      sum(ir.quantity)::int AS quantity,
      sum(ir.subtotal)::text AS revenue
    FROM products p
    JOIN item_rows ir ON ir.product_id = p.id
    WHERE p.business_id = ${businessId}::uuid
      AND p.available = true
    GROUP BY p.id, p.name
    ORDER BY quantity DESC, revenue DESC
    LIMIT 5
  `);

  const topIds = topResult.rows.map((r) => r.product_id);

  type BottomRow = TopRow;

  const bottomResult = await db.execute<BottomRow>(sql`
    WITH
      today_p AS (SELECT (now() AT TIME ZONE 'Europe/Paris')::date AS d),
      bounds AS (
        SELECT
          ((SELECT d FROM today_p) - (${days - 1} * interval '1 day'))::date AS range_start_d,
          ((SELECT d FROM today_p) + interval '1 day')::date AS range_end_d
      ),
      bounds_ts AS (
        SELECT
          (range_start_d::timestamp AT TIME ZONE 'Europe/Paris') AS range_start_ts,
          (range_end_d::timestamp AT TIME ZONE 'Europe/Paris')   AS range_end_ts
        FROM bounds
      ),
      item_rows AS (
        SELECT oi.product_id, oi.quantity, oi.subtotal
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id, bounds_ts b
        WHERE o.business_id = ${businessId}::uuid
          AND o.status IN ('confirmed', 'completed')
          AND o.created_at >= b.range_start_ts
          AND o.created_at <  b.range_end_ts
          AND oi.product_id IS NOT NULL
      ),
      per_product AS (
        SELECT
          p.id::text AS product_id,
          p.name AS name,
          coalesce(sum(ir.quantity), 0)::int AS quantity,
          coalesce(sum(ir.subtotal), 0)::text AS revenue
        FROM products p
        LEFT JOIN item_rows ir ON ir.product_id = p.id
        WHERE p.business_id = ${businessId}::uuid
          AND p.available = true
        GROUP BY p.id, p.name
      )
    SELECT product_id, name, quantity, revenue
    FROM per_product
    WHERE quantity > 0
      ${
        topIds.length > 0
          ? sql`AND product_id NOT IN (${sql.join(
              topIds.map((id) => sql`${id}`),
              sql`, `,
            )})`
          : sql``
      }
    ORDER BY quantity ASC, revenue ASC
    LIMIT 5
  `);

  const mapRow = (r: TopRow): ProductPerformanceEntry => ({
    productId: r.product_id,
    name: r.name,
    quantity: r.quantity,
    revenue: Number(r.revenue),
  });

  return {
    top: topResult.rows.map(mapRow),
    bottom: bottomResult.rows.map(mapRow),
  };
}

export async function getHourlyHeatmap(
  businessId: string,
  range: AnalyticsRange,
): Promise<HeatmapCell[]> {
  const days = rangeDays(range);

  type Row = {
    pg_dow: number;
    hour: number;
    order_count: number;
  };

  const result = await db.execute<Row>(sql`
    WITH
      today_p AS (SELECT (now() AT TIME ZONE 'Europe/Paris')::date AS d),
      bounds AS (
        SELECT
          ((SELECT d FROM today_p) - (${days - 1} * interval '1 day'))::date AS range_start_d,
          ((SELECT d FROM today_p) + interval '1 day')::date AS range_end_d
      ),
      bounds_ts AS (
        SELECT
          (range_start_d::timestamp AT TIME ZONE 'Europe/Paris') AS range_start_ts,
          (range_end_d::timestamp AT TIME ZONE 'Europe/Paris')   AS range_end_ts
        FROM bounds
      )
    SELECT
      EXTRACT(DOW  FROM (o.created_at AT TIME ZONE 'Europe/Paris'))::int AS pg_dow,
      EXTRACT(HOUR FROM (o.created_at AT TIME ZONE 'Europe/Paris'))::int AS hour,
      count(*)::int AS order_count
    FROM orders o, bounds_ts b
    WHERE o.business_id = ${businessId}::uuid
      AND o.status IN ('confirmed', 'completed')
      AND o.created_at >= b.range_start_ts
      AND o.created_at <  b.range_end_ts
    GROUP BY 1, 2
  `);

  const grid: HeatmapCell[] = [];
  const counts = new Map<string, number>();
  for (const r of result.rows) {
    const mondayFirst = pgDowToMondayFirst(r.pg_dow);
    counts.set(`${mondayFirst}:${r.hour}`, r.order_count);
  }
  for (let dow = 0; dow < 7; dow++) {
    for (let hour = 0; hour < 24; hour++) {
      grid.push({
        dayOfWeek: dow,
        hour,
        orderCount: counts.get(`${dow}:${hour}`) ?? 0,
      });
    }
  }
  return grid;
}

export async function getTopLoyalCustomers(
  businessId: string,
  limit = 10,
): Promise<TopLoyalCustomer[]> {
  type Row = {
    id: string;
    name: string | null;
    phone: string;
    lifetime_earned: string;
    balance: string;
    last_visit_at: Date | string | null;
  };

  const result = await db.execute<Row>(sql`
    SELECT
      id::text AS id,
      name,
      phone,
      lifetime_earned::text AS lifetime_earned,
      balance::text AS balance,
      last_visit_at
    FROM loyalty_customers
    WHERE business_id = ${businessId}::uuid
      AND lifetime_earned > 0
    ORDER BY lifetime_earned DESC, last_visit_at DESC NULLS LAST
    LIMIT ${limit}
  `);

  return result.rows.map((r) => ({
    customerId: r.id,
    name: r.name,
    phoneDisplay: formatPhoneForDisplay(r.phone),
    lifetimeEarned: Number(r.lifetime_earned),
    balance: Number(r.balance),
    lastVisitAt:
      r.last_visit_at === null
        ? null
        : r.last_visit_at instanceof Date
          ? r.last_visit_at
          : new Date(r.last_visit_at),
  }));
}
