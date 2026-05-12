import assert from "node:assert/strict";
import test from "node:test";
import { formatAmount, formatAmountCompact } from "./currency";

test("formatAmount formats MAD with two decimals", () => {
  assert.equal(formatAmount(1.3), "1,30 MAD");
  assert.equal(formatAmount(5), "5,00 MAD");
});

test("formatAmountCompact preserves cents and omits decimals for round amounts", () => {
  assert.equal(formatAmountCompact(1.3), "1,30 MAD");
  assert.equal(formatAmountCompact(5), "5 MAD");
});
