import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { OrderLifecycleStatus } from "@/lib/ordering/status";
import { mizaneTargetStatus, nextStepToward } from "./status-map";

describe("mizaneTargetStatus", () => {
  it("maps rejected → cancelled regardless of fulfillment", () => {
    assert.equal(mizaneTargetStatus("rejected"), "cancelled");
    assert.equal(mizaneTargetStatus("rejected", "in_progress"), "cancelled");
  });

  it("leaves a still-pending order alone", () => {
    assert.equal(mizaneTargetStatus("pending_confirmation"), null);
    assert.equal(mizaneTargetStatus("some_future_status"), null);
  });

  it("maps confirmed fulfillment to the matching lifecycle stage", () => {
    assert.equal(mizaneTargetStatus("confirmed", "in_progress"), "preparing");
    assert.equal(mizaneTargetStatus("confirmed", "served"), "ready");
    assert.equal(mizaneTargetStatus("confirmed", "paid"), "completed");
    assert.equal(mizaneTargetStatus("confirmed", "unpaid"), "completed");
    assert.equal(mizaneTargetStatus("confirmed", "voided"), "cancelled");
    assert.equal(mizaneTargetStatus("confirmed", "refunded"), "cancelled");
  });

  it("treats a confirmed order with no fulfillment as just 'received'", () => {
    assert.equal(mizaneTargetStatus("confirmed", undefined), "confirmed");
  });

  it("leaves a merged order where it is (folded into a survivor)", () => {
    assert.equal(mizaneTargetStatus("confirmed", "merged"), null);
  });

  it("tolerates an unknown fulfillment as 'in progress' (forward-compat)", () => {
    assert.equal(mizaneTargetStatus("confirmed", "plated"), "preparing");
  });
});

describe("nextStepToward", () => {
  it("takes the direct edge when one exists", () => {
    assert.equal(nextStepToward("pending", "preparing"), "preparing");
    assert.equal(nextStepToward("confirmed", "ready"), "ready");
    assert.equal(nextStepToward("ready", "completed"), "completed");
  });

  it("steps without overshooting on a multi-stage jump", () => {
    // pending → completed must not jump straight to completed.
    assert.equal(nextStepToward("pending", "completed"), "preparing");
    assert.equal(nextStepToward("preparing", "completed"), "ready");
  });

  it("returns null once at or beyond the target", () => {
    assert.equal(nextStepToward("ready", "ready"), null);
    assert.equal(nextStepToward("completed", "completed"), null);
    assert.equal(nextStepToward("ready", "preparing"), null); // never backward
  });

  it("walks a full pending → completed jump in valid steps", () => {
    const path: OrderLifecycleStatus[] = [];
    let current: OrderLifecycleStatus = "pending";
    for (let i = 0; i < 6; i += 1) {
      const next = nextStepToward(current, "completed");
      if (!next) break;
      path.push(next);
      current = next;
    }
    assert.deepEqual(path, ["preparing", "ready", "completed"]);
  });
});
