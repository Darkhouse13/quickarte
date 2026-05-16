import test from "node:test";
import assert from "node:assert/strict";
import { getBusinessDayBoundsForDateString } from "@/lib/business/business-day";
import {
  getDailyClose,
  type CloseOrderType,
  type DailyCloseAggregateRow,
} from "./close-of-day";
import type { OrderStatus } from "./close-of-day-orders";

type FixtureOrder = {
  businessId: string;
  createdAt: Date;
  status: OrderStatus;
  type: CloseOrderType;
  total: number;
};

const businessId = "11111111-1111-4111-8111-111111111111";
const otherBusinessId = "22222222-2222-4222-8222-222222222222";

test("getDailyClose excludes cancelled orders from revenue and average ticket", async () => {
  const bounds = getBusinessDayBoundsForDateString("2026-05-14");
  assert.ok(bounds);

  const orders: FixtureOrder[] = [
    order("2026-05-14T08:00:00.000Z", "completed", "dine_in", 45),
    order("2026-05-14T09:00:00.000Z", "completed", "dine_in", 55),
    order("2026-05-14T10:00:00.000Z", "completed", "takeaway", 70),
    order("2026-05-14T11:00:00.000Z", "completed", "delivery", 80),
    order("2026-05-14T12:00:00.000Z", "completed", "takeaway", 30),
    order("2026-05-14T13:00:00.000Z", "preparing", "dine_in", 25),
    order("2026-05-14T14:00:00.000Z", "cancelled", "delivery", 99),
    order("2026-05-07T10:00:00.000Z", "completed", "dine_in", 50),
    order("2026-05-07T11:00:00.000Z", "preparing", "takeaway", 70),
    order("2026-05-07T12:00:00.000Z", "cancelled", "delivery", 40),
    {
      ...order("2026-05-14T10:00:00.000Z", "completed", "dine_in", 999),
      businessId: otherBusinessId,
    },
  ];

  const close = await getDailyClose(businessId, bounds, {
    query: async (queriedBusinessId, currentBounds, comparisonBounds) => {
      assert.equal(queriedBusinessId, businessId);
      return aggregateFixtureOrders(orders, currentBounds, comparisonBounds);
    },
  });

  assert.equal(close.totals.orderCount, 6);
  assert.equal(close.totals.revenueMad, 305);
  assert.equal(close.totals.cancelledCount, 1);
  assert.equal(close.totals.averageTicketMad, 305 / 6);

  assert.deepEqual(close.byType.dine_in, { count: 3, revenueMad: 125 });
  assert.deepEqual(close.byType.takeaway, { count: 2, revenueMad: 100 });
  assert.deepEqual(close.byType.delivery, { count: 1, revenueMad: 80 });

  assert.deepEqual(close.byStatus, {
    pending: 0,
    preparing: 1,
    ready: 0,
    completed: 5,
    cancelled: 1,
  });
  assert.deepEqual(close.comparison, {
    lastWeekRevenueMad: 120,
    lastWeekOrderCount: 2,
  });
});

function order(
  createdAt: string,
  status: OrderStatus,
  type: CloseOrderType,
  total: number,
): FixtureOrder {
  return {
    businessId,
    createdAt: new Date(createdAt),
    status,
    type,
    total,
  };
}

function aggregateFixtureOrders(
  orders: FixtureOrder[],
  bounds: { startUtc: Date; endUtc: Date },
  comparisonBounds: { startUtc: Date; endUtc: Date },
): DailyCloseAggregateRow {
  const current = orders.filter((fixture) => inBounds(fixture, bounds));
  const comparison = orders.filter((fixture) =>
    inBounds(fixture, comparisonBounds),
  );
  const nonCancelled = current.filter((fixture) => fixture.status !== "cancelled");
  const lastWeekNonCancelled = comparison.filter(
    (fixture) => fixture.status !== "cancelled",
  );

  return {
    order_count: nonCancelled.length,
    revenue_mad: sum(nonCancelled).toFixed(2),
    cancelled_count: current.filter((fixture) => fixture.status === "cancelled")
      .length,
    dine_in_count: countByType(nonCancelled, "dine_in"),
    dine_in_revenue_mad: sumByType(nonCancelled, "dine_in").toFixed(2),
    takeaway_count: countByType(nonCancelled, "takeaway"),
    takeaway_revenue_mad: sumByType(nonCancelled, "takeaway").toFixed(2),
    delivery_count: countByType(nonCancelled, "delivery"),
    delivery_revenue_mad: sumByType(nonCancelled, "delivery").toFixed(2),
    pending_count: current.filter(
      (fixture) => fixture.status === "pending" || fixture.status === "confirmed",
    ).length,
    preparing_count: countByStatus(current, "preparing"),
    ready_count: countByStatus(current, "ready"),
    completed_count: countByStatus(current, "completed"),
    cancelled_status_count: countByStatus(current, "cancelled"),
    last_week_revenue_mad: sum(lastWeekNonCancelled).toFixed(2),
    last_week_order_count: lastWeekNonCancelled.length,
  };
}

function inBounds(
  order: FixtureOrder,
  bounds: { startUtc: Date; endUtc: Date },
): boolean {
  return (
    order.businessId === businessId &&
    order.createdAt >= bounds.startUtc &&
    order.createdAt < bounds.endUtc
  );
}

function countByType(orders: FixtureOrder[], type: CloseOrderType): number {
  return orders.filter((order) => order.type === type).length;
}

function sumByType(orders: FixtureOrder[], type: CloseOrderType): number {
  return sum(orders.filter((order) => order.type === type));
}

function countByStatus(orders: FixtureOrder[], status: OrderStatus): number {
  return orders.filter((order) => order.status === status).length;
}

function sum(orders: FixtureOrder[]): number {
  return orders.reduce((total, order) => total + order.total, 0);
}
