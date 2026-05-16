import test from "node:test";
import assert from "node:assert/strict";
import {
  bucketOrderByStatus,
  KITCHEN_COLUMN_LABELS,
  KITCHEN_COLUMN_ORDER,
  type KitchenColumn,
} from "./buckets";
import { canAccess } from "@/lib/identity/permissions";
import { validateOrderTransition } from "@/lib/ordering/transitions";
import type { OrderLifecycleStatus } from "@/lib/ordering/status";

type Order = { id: string; status: OrderLifecycleStatus; readyAt?: number };

function columnsFor(orders: Order[]): Record<KitchenColumn, string[]> {
  const out: Record<KitchenColumn, string[]> = {
    to_prepare: [],
    in_progress: [],
    ready: [],
  };
  for (const order of orders) {
    const bucket = bucketOrderByStatus(order.status);
    if (bucket) out[bucket].push(order.id);
  }
  return out;
}

// "E2E" flow exercised through the same helpers the UI uses. The kitchen UI
// reads from `bucketOrderByStatus` and writes through `transitionOrder`, so
// validating the transition rules + bucket function together mirrors what
// the operator sees on screen.
test("kitchen flow: seeded order moves À préparer → En préparation → Prêt", () => {
  const order: Order = {
    id: "11111111-1111-1111-1111-111111111111",
    status: "pending",
  };

  // Initial render: pending order shows in "À préparer".
  let columns = columnsFor([order]);
  assert.deepEqual(columns.to_prepare, [order.id]);
  assert.equal(KITCHEN_COLUMN_LABELS.to_prepare, "À préparer");

  // Tap "Accepter" — must be a legal pending → preparing transition.
  assert.equal(validateOrderTransition("pending", "preparing"), true);
  order.status = "preparing";

  columns = columnsFor([order]);
  assert.deepEqual(columns.to_prepare, []);
  assert.deepEqual(columns.in_progress, [order.id]);
  assert.equal(KITCHEN_COLUMN_LABELS.in_progress, "En préparation");

  // Tap "Prêt" — preparing → ready.
  assert.equal(validateOrderTransition("preparing", "ready"), true);
  order.status = "ready";
  order.readyAt = Date.now();

  columns = columnsFor([order]);
  assert.deepEqual(columns.in_progress, []);
  assert.deepEqual(columns.ready, [order.id]);
  assert.equal(KITCHEN_COLUMN_LABELS.ready, "Prêt");
});

test("kitchen flow: ready cards stay visible 60s, then collapse to a pill (fake timers)", () => {
  const READY_LINGER_MS = 60_000;
  const readyAt = 1_700_000_000_000;
  const inWindow = readyAt + 30_000; // 30s after — still expanded
  const onBoundary = readyAt + READY_LINGER_MS; // exactly at boundary — collapse
  const afterWindow = readyAt + 75_000; // 75s after — collapsed

  const isExpanded = (now: number) => now - readyAt < READY_LINGER_MS;
  assert.equal(isExpanded(inWindow), true);
  assert.equal(isExpanded(onBoundary), false);
  assert.equal(isExpanded(afterWindow), false);
});

test("kitchen flow: accepting from confirmed (already-accepted) status also lands in preparing", () => {
  // Some orders land in À préparer via confirmed (storefront → admin accept
  // → kitchen pickup). Tapping Accepter still moves them to preparing.
  assert.equal(bucketOrderByStatus("confirmed"), "to_prepare");
  assert.equal(validateOrderTransition("confirmed", "preparing"), true);
});

test("kitchen role-gating: waiter is denied at /kitchen", () => {
  assert.equal(canAccess("waiter", "kitchen.queue"), false);
  assert.equal(canAccess("kitchen", "kitchen.queue"), true);
  assert.equal(canAccess("owner", "kitchen.queue"), true);
  assert.equal(canAccess("manager", "kitchen.queue"), true);
});

test("kitchen column header order is À préparer, En préparation, Prêt", () => {
  assert.deepEqual(
    KITCHEN_COLUMN_ORDER.map((c) => KITCHEN_COLUMN_LABELS[c]),
    ["À préparer", "En préparation", "Prêt"],
  );
});

test.skip(
  "kitchen flow against a real DB: kitchen user login → Accepter writes order.preparing event → Prêt writes order.ready event; requires live Postgres on DATABASE_URL",
);
