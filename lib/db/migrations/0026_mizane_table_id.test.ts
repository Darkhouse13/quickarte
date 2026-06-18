import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(__dirname, "0026_mizane_table_id.sql"), "utf8");

describe("0026_mizane_table_id migration", () => {
  it("adds mizane_table_id to orders (idempotent)", () => {
    assert.ok(
      sql.includes(
        'ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "mizane_table_id"',
      ),
      "missing mizane_table_id column on orders",
    );
  });

  it("stores mizane_table_id as uuid", () => {
    assert.ok(
      /"mizane_table_id"\s+uuid/.test(sql),
      "mizane_table_id should be uuid",
    );
  });

  it("uses IF NOT EXISTS so the migration can re-run safely", () => {
    assert.ok(sql.includes("ADD COLUMN IF NOT EXISTS"), "column add not guarded");
  });
});
