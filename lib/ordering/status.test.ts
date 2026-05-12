import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransitionOrderStatus,
  PRIMARY_ORDER_ACTIONS,
} from "./status";

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
  assert.deepEqual(PRIMARY_ORDER_ACTIONS.ready, {
    next: "completed",
    label: "Terminer",
  });
});
