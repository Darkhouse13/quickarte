import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "migrations/0020_loyalty_credits.sql",
  "utf8",
);

test("0020 adds the credits ledger and Google review grant uniqueness", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "credit_transactions"/);
  assert.match(
    migration,
    /CREATE UNIQUE INDEX IF NOT EXISTS "credit_transactions_system_source_unique"/,
  );
  assert.match(
    migration,
    /WHERE "source" IN \('order_spend', 'google_review', 'redemption'\)/,
  );
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "google_review_grants"/);
  assert.match(
    migration,
    /CONSTRAINT "google_review_grants_business_review_unique" UNIQUE\("business_id", "google_review_name"\)/,
  );
});

test("0020 creates redemption listings and snapshots credit prices on order items", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "redemption_listings"/);
  assert.match(
    migration,
    /CONSTRAINT "redemption_listings_business_product_unique" UNIQUE\("business_id", "product_id"\)/,
  );
  assert.match(
    migration,
    /ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "credit_unit_price" integer/,
  );
});
