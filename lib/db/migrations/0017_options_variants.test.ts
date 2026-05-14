import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "lib/db/migrations/0017_options_variants.sql",
  "utf8",
);

test("0017 creates the partial unique index for one default variant per product", () => {
  assert.match(
    migration,
    /CREATE UNIQUE INDEX IF NOT EXISTS "product_variants_one_default_idx"/,
  );
  assert.match(migration, /WHERE "is_default" = true/);
});

test("0017 backfills max_select from the legacy max_selections column", () => {
  assert.match(migration, /column_name = 'max_selections'/);
  assert.match(
    migration,
    /UPDATE "product_options" SET "max_select" = "max_selections"/,
  );
});

test("0017 adds availability and ordered lookup indexes", () => {
  assert.match(
    migration,
    /ALTER TABLE "option_values" ADD COLUMN IF NOT EXISTS "available"/,
  );
  assert.match(
    migration,
    /CREATE INDEX IF NOT EXISTS "product_options_product_id_position_idx"/,
  );
  assert.match(
    migration,
    /CREATE INDEX IF NOT EXISTS "option_values_option_id_position_idx"/,
  );
  assert.match(
    migration,
    /CREATE INDEX IF NOT EXISTS "product_variants_product_id_position_idx"/,
  );
});
