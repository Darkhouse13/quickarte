import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "migrations/0016_customer_order_access.sql",
  "utf8",
);

test("0016 backfills customer access tokens before enforcing not null", () => {
  const backfill = migration.indexOf('UPDATE "orders"');
  const notNull = migration.indexOf(
    'ALTER TABLE "orders" ALTER COLUMN "customer_access_token" SET NOT NULL',
  );
  assert.ok(backfill > -1);
  assert.ok(notNull > backfill);
});

test("0016 creates a unique index for customer access tokens", () => {
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "orders_customer_access_token_idx"/,
  );
});
