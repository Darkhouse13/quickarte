import test from "node:test";
import assert from "node:assert/strict";
import {
  markEnteredInPos,
  markSkippedInPos,
  POS_COEXISTENCE_DISABLED_MESSAGE,
  revertPosStatus,
  type PosReconciliationDeps,
  type PosStatus,
} from "./pos-reconciliation";

const orderId = "order-1";
const businessId = "business-1";
const actor = { userId: "cashier-1", role: "cashier" as const };

test("markEnteredInPos is idempotent and records only one event", async () => {
  const harness = fakeHarness("pending");

  assert.deepEqual(
    await markEnteredInPos(orderId, businessId, actor, { posReference: "BC-1408" }, harness.deps),
    { status: "success" },
  );
  assert.deepEqual(
    await markEnteredInPos(orderId, businessId, actor, { posReference: "BC-1408" }, harness.deps),
    { status: "success" },
  );

  assert.equal(harness.order.posStatus, "entered");
  assert.equal(harness.order.posReference, "BC-1408");
  assert.equal(harness.events.length, 1);
  assert.equal(harness.events[0]?.eventType, "order.pos_entered");
});

test("revertPosStatus resets timestamp and user but keeps pos_reference", async () => {
  const harness = fakeHarness("entered");
  harness.order.posReference = "BC-1408";
  harness.order.posEnteredAt = new Date("2026-05-14T10:00:00.000Z");
  harness.order.posEnteredByUserId = "cashier-1";

  const result = await revertPosStatus(orderId, businessId, {
    userId: "manager-1",
    role: "manager",
  }, harness.deps);

  assert.deepEqual(result, { status: "success" });
  assert.equal(harness.order.posStatus, "pending");
  assert.equal(harness.order.posReference, "BC-1408");
  assert.equal(harness.order.posEnteredAt, null);
  assert.equal(harness.order.posEnteredByUserId, null);
  assert.equal(harness.events.at(-1)?.eventType, "order.pos_reverted");
});

test("POS actions return the typed disabled-setting error for not_required orders", async () => {
  for (const action of [
    (deps: PosReconciliationDeps) =>
      markEnteredInPos(orderId, businessId, actor, {}, deps),
    (deps: PosReconciliationDeps) =>
      markSkippedInPos(orderId, businessId, actor, {}, deps),
    (deps: PosReconciliationDeps) => revertPosStatus(orderId, businessId, actor, deps),
  ]) {
    const result = await action(fakeHarness("not_required").deps);
    assert.equal(result.status, "error");
    assert.equal(result.code, "POS_COEXISTENCE_DISABLED");
    assert.equal(result.message, POS_COEXISTENCE_DISABLED_MESSAGE);
  }
});

function fakeHarness(initialStatus: PosStatus) {
  const order = {
    id: orderId,
    businessId,
    posStatus: initialStatus,
    posReference: null as string | null,
    posEnteredAt: null as Date | null,
    posEnteredByUserId: null as string | null,
    updatedAt: null as Date | null,
  };
  const events: Array<{
    orderId: string;
    eventType: string;
    actorUserId: string | null;
    actorRole: string | null;
    payloadJson: Record<string, unknown> | null;
  }> = [];
  const tx = {
    query: {
      orders: {
        findFirst: async () => order,
      },
    },
    update: () => ({
      set: (values: Partial<typeof order>) => ({
        where: () => Object.assign(order, values),
      }),
    }),
    insert: () => ({
      values: (value: (typeof events)[number]) => {
        events.push(value);
      },
    }),
  };
  const deps = {
    transaction: async (fn: (writer: typeof tx) => unknown) => fn(tx),
    now: () => new Date("2026-05-14T12:00:00.000Z"),
  } as unknown as PosReconciliationDeps;
  return { order, events, deps };
}
