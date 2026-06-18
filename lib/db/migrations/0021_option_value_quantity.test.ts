import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "lib/db/migrations/0021_option_value_quantity.sql",
  "utf8",
);

test("0021 adds allow_quantity with false default and max_quantity nullable", () => {
  assert.match(
    migration,
    /ADD COLUMN IF NOT EXISTS "allow_quantity" boolean DEFAULT false NOT NULL/,
  );
  assert.match(
    migration,
    /ADD COLUMN IF NOT EXISTS "max_quantity" integer/,
  );
});
