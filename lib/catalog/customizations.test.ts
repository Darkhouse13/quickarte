import assert from "node:assert/strict";
import test from "node:test";
import {
  optionInputSchema,
  optionValueInputSchema,
  updateOptionInputSchema,
  variantInputSchema,
} from "./schemas";

test("variant input accepts a named price override", () => {
  const parsed = variantInputSchema.safeParse({
    name: "Tacos XL",
    price_override: "55",
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.name, "Tacos XL");
    assert.equal(parsed.data.price_override, 55);
  }
});

test("option input accepts required multi-select with max selections", () => {
  const parsed = optionInputSchema.safeParse({
    name: "Sauces",
    type: "multi_select",
    required: true,
    max_selections: "2",
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.max_selections, 2);
  }
});

test("max selections on single-select is rejected by the validator", () => {
  const parsed = optionInputSchema.safeParse({
    name: "Viande",
    type: "single_select",
    required: true,
    max_selections: 2,
  });
  assert.equal(parsed.success, false);
});

test("single-select update with max selections is rejected by the validator", () => {
  const parsed = updateOptionInputSchema.safeParse({
    type: "single_select",
    max_selections: 2,
  });
  assert.equal(parsed.success, false);
});

test("option value input rejects negative price additions", () => {
  const parsed = optionValueInputSchema.safeParse({
    name: "Cordon bleu",
    price_addition: -5,
  });
  assert.equal(parsed.success, false);
});

test.skip("variant CRUD round-trip requires live Postgres on DATABASE_URL");
test.skip("option CRUD round-trip requires live Postgres on DATABASE_URL");
test.skip("option value CRUD round-trip requires live Postgres on DATABASE_URL");
test.skip("cross-business authorization requires live Postgres on DATABASE_URL");
