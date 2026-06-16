import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(__dirname, "0024_mizane_order_id.sql"),
  "utf8",
);

describe("0024_mizane_order_id migration", () => {
  it("adds mizane_order_id to orders (idempotent)", () => {
    assert.ok(
      sql.includes('ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "mizane_order_id"'),
      "missing mizane_order_id column on orders",
    );
  });

  it("stores mizane_order_id as text", () => {
    assert.ok(
      /"mizane_order_id"\s+text/.test(sql),
      "mizane_order_id should be text",
    );
  });

  it("creates an index on mizane_order_id for polling lookups", () => {
    assert.ok(
      sql.includes("orders_mizane_order_id_idx"),
      "missing mizane_order_id index",
    );
  });

  it("uses IF NOT EXISTS guards so the migration can re-run safely", () => {
    assert.ok(sql.includes("ADD COLUMN IF NOT EXISTS"), "column add not guarded");
    assert.ok(sql.includes("CREATE INDEX IF NOT EXISTS"), "index create not guarded");
  });
});
