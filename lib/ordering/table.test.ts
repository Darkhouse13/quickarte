import assert from "node:assert/strict";
import test from "node:test";
import { parseTableNumber } from "./table";

test("parseTableNumber accepts positive integer query values", () => {
  assert.equal(parseTableNumber("7"), 7);
  assert.equal(parseTableNumber(["12"]), 12);
});

test("parseTableNumber rejects missing, invalid, and unsafe values", () => {
  assert.equal(parseTableNumber(undefined), null);
  assert.equal(parseTableNumber("0"), null);
  assert.equal(parseTableNumber("-1"), null);
  assert.equal(parseTableNumber("2.5"), null);
  assert.equal(parseTableNumber("abc"), null);
  assert.equal(parseTableNumber("1000"), null);
});
