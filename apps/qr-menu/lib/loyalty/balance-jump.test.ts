import test from "node:test";
import assert from "node:assert/strict";
import { balanceJumpDelta } from "./balance-jump";

test("returns null on first load when prev balance is unknown", () => {
  assert.equal(balanceJumpDelta(null, 18), null);
});

test("returns null when the polled balance is null", () => {
  assert.equal(balanceJumpDelta(18, null), null);
});

test("returns null when the balance is unchanged", () => {
  assert.equal(balanceJumpDelta(18, 18), null);
});

test("returns null when the balance went down (spend)", () => {
  assert.equal(balanceJumpDelta(118, 68), null);
});

test("returns the positive delta when the balance jumped up", () => {
  assert.equal(balanceJumpDelta(18, 118), 100);
});

test("returns the positive delta when the balance climbed off zero", () => {
  assert.equal(balanceJumpDelta(0, 100), 100);
});
