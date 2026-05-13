import assert from "node:assert/strict";
import test from "node:test";
import {
  optionInputSchema,
  optionValueInputSchema,
  updateOptionInputSchema,
  variantInputSchema,
} from "./schemas";
import {
  areRequiredOptionsSatisfied,
  getDisplayableOptions,
  optionHasValues,
} from "./option-guards";

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

test("storefront display options filter out empty option value lists", () => {
  const displayable = getDisplayableOptions([
    {
      id: "empty-required",
      name: "Sauces",
      type: "multi_select" as const,
      required: true,
      maxSelections: 2,
      values: [],
    },
    {
      id: "filled-required",
      name: "Pain",
      type: "single_select" as const,
      required: true,
      maxSelections: null,
      values: [{ id: "white", name: "Blanc", priceAddition: 0 }],
    },
  ]);

  assert.deepEqual(
    displayable.map((option) => option.id),
    ["filled-required"],
  );
});

test("required option gating only passes when displayed required options have a valid selection", () => {
  const options = [
    {
      id: "sauce",
      required: true,
      type: "multi_select" as const,
      values: [{ id: "harissa" }, { id: "mayo" }],
    },
    {
      id: "legacy-empty",
      required: false,
      type: "single_select" as const,
      values: [],
    },
  ];

  assert.equal(areRequiredOptionsSatisfied(options, {}), false);
  assert.equal(
    areRequiredOptionsSatisfied(options, { sauce: ["unknown"] }),
    false,
  );
  assert.equal(
    areRequiredOptionsSatisfied(options, { sauce: ["harissa"] }),
    true,
  );
});

test("required option gating rejects exposed empty required options defensively", () => {
  assert.equal(
    areRequiredOptionsSatisfied(
      [
        {
          id: "legacy-empty",
          required: true,
          type: "single_select",
          values: [],
        },
      ],
      { "legacy-empty": ["missing"] },
    ),
    false,
  );
});

test("per-option save validation requires at least one value", () => {
  assert.equal(optionHasValues({ values: [] }), false);
  assert.equal(optionHasValues({ values: [{ id: "small" }] }), true);
});

test.skip("variant CRUD round-trip requires live Postgres on DATABASE_URL");
test.skip("option CRUD round-trip requires live Postgres on DATABASE_URL");
test.skip("option value CRUD round-trip requires live Postgres on DATABASE_URL");
test.skip("cross-business authorization requires live Postgres on DATABASE_URL");
