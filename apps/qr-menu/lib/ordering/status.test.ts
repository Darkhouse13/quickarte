import assert from "node:assert/strict";
import test from "node:test";
import {
  canShowServirButton,
  canTransitionOrderStatus,
  PRIMARY_ORDER_ACTIONS,
  type OrderLifecycleStatus,
} from "./status";
import type { StaffRole } from "../identity/permissions";

test("order lifecycle rejects terminal-to-pending transitions", () => {
  assert.equal(canTransitionOrderStatus("completed", "pending"), false);
  assert.equal(canTransitionOrderStatus("cancelled", "pending"), false);
});

test("order lifecycle allows the v1 happy path and cancellation from active states", () => {
  assert.equal(canTransitionOrderStatus("pending", "confirmed"), true);
  assert.equal(canTransitionOrderStatus("confirmed", "preparing"), true);
  assert.equal(canTransitionOrderStatus("preparing", "ready"), true);
  assert.equal(canTransitionOrderStatus("ready", "completed"), true);
  assert.equal(canTransitionOrderStatus("preparing", "cancelled"), true);
});

test("primary order actions follow the service workflow", () => {
  assert.deepEqual(PRIMARY_ORDER_ACTIONS.pending, {
    next: "confirmed",
    label: "Confirmer",
  });
  // `ready` has no primary transition action: it is served via the SERVIR
  // button (markOrderServed), keeping a single path to the served state.
  assert.equal(PRIMARY_ORDER_ACTIONS.ready, undefined);
});

test("SERVIR button shows only for ready orders and floor roles", () => {
  const floorRoles: StaffRole[] = ["owner", "manager", "waiter", "cashier"];
  for (const role of floorRoles) {
    assert.equal(canShowServirButton("ready", role), true);
  }
  assert.equal(canShowServirButton("ready", "kitchen"), false);

  const nonReady: OrderLifecycleStatus[] = [
    "pending",
    "confirmed",
    "preparing",
    "completed",
    "cancelled",
  ];
  for (const status of nonReady) {
    assert.equal(canShowServirButton(status, "owner"), false);
  }
});
