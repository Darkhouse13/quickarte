import test from "node:test";
import assert from "node:assert/strict";
import { shouldShowRedemptionPill } from "./redemption-pill";

test("flags credit orders", () => {
  assert.equal(shouldShowRedemptionPill({ paymentMode: "credits" }), true);
});

test("does not flag MAD orders", () => {
  assert.equal(shouldShowRedemptionPill({ paymentMode: "mad" }), false);
});

test("does not flag orders with undefined paymentMode (legacy rows)", () => {
  assert.equal(shouldShowRedemptionPill({}), false);
});

test("does not flag orders with null paymentMode", () => {
  assert.equal(shouldShowRedemptionPill({ paymentMode: null }), false);
});

test("does not flag unknown payment modes", () => {
  assert.equal(
    shouldShowRedemptionPill({ paymentMode: "future_mode" }),
    false,
  );
});
