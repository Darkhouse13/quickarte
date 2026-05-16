import test from "node:test";
import assert from "node:assert/strict";
import { bucketOrderByStatus } from "./buckets";

test("pending orders go to 'À préparer'", () => {
  assert.equal(bucketOrderByStatus("pending"), "to_prepare");
});

test("confirmed (accepted) orders go to 'À préparer'", () => {
  assert.equal(bucketOrderByStatus("confirmed"), "to_prepare");
});

test("preparing orders go to 'En préparation'", () => {
  assert.equal(bucketOrderByStatus("preparing"), "in_progress");
});

test("ready orders go to 'Prêt'", () => {
  assert.equal(bucketOrderByStatus("ready"), "ready");
});

test("completed and cancelled orders are excluded from the board", () => {
  assert.equal(bucketOrderByStatus("completed"), null);
  assert.equal(bucketOrderByStatus("cancelled"), null);
});
