import assert from "node:assert/strict";
import test from "node:test";
import { shouldShowGettingStarted } from "./getting-started";

const zeroStats = {
  todayOrderCount: 0,
  todayRevenue: 0,
  pendingCount: 0,
};

test("getting-started hides when catalog has items even without orders", () => {
  assert.equal(shouldShowGettingStarted(zeroStats, 0, 1), false);
});

test("getting-started shows only when catalog and order activity are empty", () => {
  assert.equal(shouldShowGettingStarted(zeroStats, 0, 0), true);
  assert.equal(
    shouldShowGettingStarted({ ...zeroStats, todayOrderCount: 1 }, 1, 0),
    false,
  );
});
