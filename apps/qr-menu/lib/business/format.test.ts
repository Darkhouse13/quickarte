import test from "node:test";
import assert from "node:assert/strict";
import {
  formatCountDelta,
  formatMadAmount,
  formatPercentDelta,
} from "./format";

const MINUS = "−";
const NBSP = " ";

test("formatMadAmount: whole numbers drop decimals", () => {
  assert.equal(formatMadAmount(0), "0");
  assert.equal(formatMadAmount(7), "7");
  assert.equal(formatMadAmount(1240), "1 240");
});

test("formatMadAmount: single-decimal amounts pad to two decimals", () => {
  assert.equal(formatMadAmount(1240.5), "1 240,50");
  assert.equal(formatMadAmount(0.5), "0,50");
});

test("formatMadAmount: two-decimal amounts keep both", () => {
  assert.equal(formatMadAmount(1240.55), "1 240,55");
});

test("formatMadAmount: large amounts group thousands with spaces", () => {
  assert.equal(formatMadAmount(1234567), "1 234 567");
  assert.equal(formatMadAmount(1234567.89), "1 234 567,89");
});

test("formatMadAmount: negatives use the minus glyph", () => {
  assert.equal(formatMadAmount(-90.4), `${MINUS}90,40`);
  assert.equal(formatMadAmount(-1240), `${MINUS}1 240`);
});

test("formatMadAmount: non-finite values fall back to 0", () => {
  assert.equal(formatMadAmount(Number.NaN), "0");
  assert.equal(formatMadAmount(Number.POSITIVE_INFINITY), "0");
});

test("formatPercentDelta: positive and negative deltas", () => {
  assert.equal(formatPercentDelta(118, 100), `+18${NBSP}%`);
  assert.equal(formatPercentDelta(93, 100), `${MINUS}7${NBSP}%`);
});

test("formatPercentDelta: previous === 0 returns null", () => {
  assert.equal(formatPercentDelta(5, 0), null);
  assert.equal(formatPercentDelta(0, 0), null);
});

test("formatPercentDelta: exact zero diff renders as +0 %", () => {
  assert.equal(formatPercentDelta(100, 100), `+0${NBSP}%`);
});

test("formatCountDelta: plural for deltas other than ±1", () => {
  assert.equal(formatCountDelta(14, 2), `+12${NBSP}commandes`);
  assert.equal(formatCountDelta(2, 5), `${MINUS}3${NBSP}commandes`);
  assert.equal(formatCountDelta(5, 5), `+0${NBSP}commandes`);
});

test("formatCountDelta: singular at a delta of exactly ±1", () => {
  assert.equal(formatCountDelta(3, 2), `+1${NBSP}commande`);
  assert.equal(formatCountDelta(1, 2), `${MINUS}1${NBSP}commande`);
});

test("formatCountDelta: previous === 0 returns null", () => {
  assert.equal(formatCountDelta(7, 0), null);
  assert.equal(formatCountDelta(0, 0), null);
});
