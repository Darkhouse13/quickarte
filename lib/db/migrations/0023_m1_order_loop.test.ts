import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(__dirname, "0023_m1_order_loop.sql"),
  "utf8",
);

describe("0023_m1_order_loop migration", () => {
  it("adds served status to order_status enum", () => {
    assert.ok(sql.includes("'served'"), "missing served status");
  });

  it("adds paid status to order_status enum", () => {
    assert.ok(sql.includes("'paid'"), "missing paid status");
  });

  it("adds glovo to order_type enum", () => {
    assert.ok(sql.includes("'glovo'"), "missing glovo order type");
  });

  it("creates order_payment_method enum", () => {
    assert.ok(sql.includes('CREATE TYPE "order_payment_method"'), "missing order_payment_method enum");
    assert.ok(sql.includes("'cash'"), "missing cash payment method");
    assert.ok(sql.includes("'card'"), "missing card payment method");
  });

  it("creates item_prep_status enum", () => {
    assert.ok(sql.includes('CREATE TYPE "item_prep_status"'), "missing item_prep_status enum");
    assert.ok(sql.includes("'queued'"), "missing queued prep status");
    assert.ok(sql.includes("'ready'"), "missing ready prep status");
  });

  it("adds payment_method to orders", () => {
    assert.ok(
      sql.includes('ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_method"'),
      "missing payment_method column on orders",
    );
  });

  it("adds confirmed_by_user_id to orders", () => {
    assert.ok(
      sql.includes('ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "confirmed_by_user_id"'),
      "missing confirmed_by_user_id column on orders",
    );
  });

  it("adds prep_status to order_items", () => {
    assert.ok(
      sql.includes('ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "prep_status"'),
      "missing prep_status column on order_items",
    );
  });

  it("adds prep_priority to products", () => {
    assert.ok(
      sql.includes('ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "prep_priority"'),
      "missing prep_priority column on products",
    );
  });

  it("creates composite index for garcon/POS polling", () => {
    assert.ok(
      sql.includes("orders_business_status_created_idx"),
      "missing composite polling index",
    );
  });
});
