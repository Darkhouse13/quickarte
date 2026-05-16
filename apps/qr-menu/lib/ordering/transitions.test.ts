import test from "node:test";
import assert from "node:assert/strict";
import {
  transitionOrder,
  validateOrderTransition,
  type TransitionOrderDeps,
} from "./transitions";
import type { OrderLifecycleStatus } from "./status";
import type { OrderEventActor } from "./events";

test("transitionOrder allows accepted order to move directly to ready", () => {
  assert.equal(validateOrderTransition("confirmed", "ready"), true);
});

test("transitionOrder allows accepted order to move to preparing", () => {
  assert.equal(validateOrderTransition("confirmed", "preparing"), true);
});

test("transitionOrder allows ready order to be served", () => {
  assert.equal(validateOrderTransition("ready", "completed"), true);
});

test("transitionOrder rejects served order moving back to preparing", () => {
  assert.equal(validateOrderTransition("completed", "preparing"), false);
});

test("transitionOrder rejects cancelled order moving back to accepted", () => {
  assert.equal(validateOrderTransition("cancelled", "confirmed"), false);
});

test("transitionOrder records order.served for ready -> completed", async () => {
  const harness = fakeTransitionHarness("ready");

  const result = await transitionOrder(
    "order-1",
    "completed",
    actor,
    { businessId: "business-1", deps: harness.deps },
  );

  assert.deepEqual(result, {
    status: "success",
    fromStatus: "ready",
    toStatus: "completed",
  });
  assert.equal(harness.order.status, "completed");
  assert.equal(harness.events.length, 1);
  assert.equal(harness.events[0]?.eventType, "order.served");
  assert.deepEqual(harness.events[0]?.actor, actor);
});

test("transitionOrder rejects pending -> completed without changing state or writing events", async () => {
  const harness = fakeTransitionHarness("pending");

  const result = await transitionOrder(
    "order-1",
    "completed",
    actor,
    { businessId: "business-1", deps: harness.deps },
  );

  assert.deepEqual(result, {
    status: "invalid_transition",
    fromStatus: "pending",
    toStatus: "completed",
  });
  assert.equal(harness.order.status, "pending");
  assert.equal(harness.events.length, 0);
});

test("transitionOrder rejects cancelled -> completed without writing events", async () => {
  const harness = fakeTransitionHarness("cancelled");

  const result = await transitionOrder(
    "order-1",
    "completed",
    actor,
    { businessId: "business-1", deps: harness.deps },
  );

  assert.deepEqual(result, {
    status: "invalid_transition",
    fromStatus: "cancelled",
    toStatus: "completed",
  });
  assert.equal(harness.order.status, "cancelled");
  assert.equal(harness.events.length, 0);
});

test("transitionOrder is idempotent for completed -> completed and does not double-record served", async () => {
  const harness = fakeTransitionHarness("ready");

  assert.equal(
    (await transitionOrder("order-1", "completed", actor, {
      businessId: "business-1",
      deps: harness.deps,
    })).status,
    "success",
  );
  assert.equal(
    (await transitionOrder("order-1", "completed", actor, {
      businessId: "business-1",
      deps: harness.deps,
    })).status,
    "success",
  );

  assert.equal(harness.order.status, "completed");
  assert.equal(harness.events.length, 1);
  assert.equal(harness.events[0]?.eventType, "order.served");
});

const actor: OrderEventActor = { userId: "user-1", role: "waiter" };

function fakeTransitionHarness(initialStatus: OrderLifecycleStatus) {
  const order = {
    id: "order-1",
    businessId: "business-1",
    status: initialStatus,
    notes: null as string | null,
    updatedAt: null as Date | null,
  };
  const events: Array<{
    orderId: string;
    eventType: string;
    actor?: OrderEventActor;
    payload?: Record<string, unknown>;
  }> = [];
  const tx = {
    query: {
      orders: {
        findFirst: async () => order,
      },
    },
    update: () => ({
      set: (values: Partial<typeof order>) => ({
        where: () => {
          Object.assign(order, values);
        },
      }),
    }),
  };
  const deps = {
    transaction: async (fn: (writer: typeof tx) => unknown) => fn(tx),
    recordEvent: async (
      orderId: string,
      eventType: string,
      opts: { actor?: OrderEventActor; payload?: Record<string, unknown> },
    ) => {
      events.push({ orderId, eventType, actor: opts.actor, payload: opts.payload });
    },
  } as unknown as TransitionOrderDeps;
  return { order, events, deps };
}
