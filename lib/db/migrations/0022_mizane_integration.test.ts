import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(__dirname, "0022_mizane_integration.sql"),
  "utf8",
);

describe("0022_mizane_integration migration", () => {
  it("creates the mizane_integrations table", () => {
    assert.ok(
      sql.includes('CREATE TABLE "mizane_integrations"'),
      "missing CREATE TABLE mizane_integrations",
    );
  });

  it("references businesses with CASCADE delete", () => {
    assert.ok(
      sql.includes('REFERENCES "businesses"("id") ON DELETE CASCADE'),
      "missing FK to businesses",
    );
  });

  it("adds mizane_id to all 5 catalog tables", () => {
    const tables = [
      "categories",
      "products",
      "product_variants",
      "product_options",
      "option_values",
    ];
    for (const t of tables) {
      assert.ok(
        sql.includes(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "mizane_id"`),
        `missing mizane_id on ${t}`,
      );
    }
  });

  it("adds localized_names to all 5 catalog tables", () => {
    const tables = [
      "categories",
      "products",
      "product_variants",
      "product_options",
      "option_values",
    ];
    for (const t of tables) {
      assert.ok(
        sql.includes(
          `ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "localized_names"`,
        ),
        `missing localized_names on ${t}`,
      );
    }
  });

  it("adds deleted_at to all 5 catalog tables", () => {
    const tables = [
      "categories",
      "products",
      "product_variants",
      "product_options",
      "option_values",
    ];
    for (const t of tables) {
      assert.ok(
        sql.includes(
          `ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "deleted_at"`,
        ),
        `missing deleted_at on ${t}`,
      );
    }
  });

  it("creates partial unique indexes on mizane_id", () => {
    const indexes = [
      "categories_mizane_id_unique_idx",
      "products_mizane_id_unique_idx",
      "product_variants_mizane_id_unique_idx",
      "product_options_mizane_id_unique_idx",
      "option_values_mizane_id_unique_idx",
    ];
    for (const idx of indexes) {
      assert.ok(
        sql.includes(`CREATE UNIQUE INDEX IF NOT EXISTS "${idx}"`),
        `missing unique index ${idx}`,
      );
    }
  });

  it("all unique indexes are partial (WHERE NOT NULL)", () => {
    assert.ok(
      sql.includes('WHERE "mizane_id" IS NOT NULL'),
      "missing partial index condition",
    );
  });
});
