import test from "node:test";
import assert from "node:assert/strict";
import { formatElapsedFr } from "./elapsed";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

test("under one minute reads '< 1 min'", () => {
  assert.equal(formatElapsedFr(0), "< 1 min");
  assert.equal(formatElapsedFr(45 * SECOND), "< 1 min");
});

test("minutes without hours read '<n> min'", () => {
  assert.equal(formatElapsedFr(3 * MINUTE), "3 min");
  assert.equal(formatElapsedFr(12 * MINUTE + 30 * SECOND), "12 min");
  assert.equal(formatElapsedFr(59 * MINUTE), "59 min");
});

test("hour-plus durations read '<h> h <mm>' with zero-padded minutes", () => {
  assert.equal(formatElapsedFr(1 * HOUR + 4 * MINUTE), "1 h 04");
  assert.equal(formatElapsedFr(2 * HOUR), "2 h 00");
  assert.equal(formatElapsedFr(3 * HOUR + 17 * MINUTE), "3 h 17");
});

test("negative and non-finite inputs fall back to '< 1 min'", () => {
  assert.equal(formatElapsedFr(-1), "< 1 min");
  assert.equal(formatElapsedFr(Number.NaN), "< 1 min");
});
