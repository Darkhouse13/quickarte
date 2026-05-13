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
  getEffectiveMaxSelections,
  getDisplayableOptions,
  optionHasValues,
} from "./option-guards";
import { buildStorefrontFixture } from "./storefront-dto";
import { validateVariantOptionMaxSelectionsOverrides } from "./variant-option-overrides";

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

test("option gating rejects displayed multi-select selections above effective max", () => {
  const option = {
    id: "11111111-1111-4111-8111-111111111111",
    required: false,
    type: "multi_select" as const,
    maxSelections: 2,
    values: [{ id: "a" }, { id: "b" }, { id: "c" }],
  };

  assert.equal(
    areRequiredOptionsSatisfied([option], { [option.id]: ["a", "b", "c"] }),
    false,
  );
});


test("per-option save validation requires at least one value", () => {
  assert.equal(optionHasValues({ values: [] }), false);
  assert.equal(optionHasValues({ values: [{ id: "small" }] }), true);
});

test("effective max selections prefers variant override, then base, then unlimited", () => {
  const option = {
    id: "11111111-1111-4111-8111-111111111111",
    maxSelections: 3,
  };

  assert.equal(
    getEffectiveMaxSelections(option, {
      optionMaxSelectionsOverrides: { [option.id]: 1 },
    }),
    1,
  );
  assert.equal(getEffectiveMaxSelections(option, null), 3);
  assert.equal(
    getEffectiveMaxSelections(option, {
      optionMaxSelectionsOverrides: {
        "33333333-3333-4333-8333-333333333333": 1,
      },
    }),
    3,
  );
  assert.equal(
    getEffectiveMaxSelections(option, {
      option_max_selections_overrides: { [option.id]: 2 },
    }),
    2,
  );
  assert.equal(
    getEffectiveMaxSelections({ ...option, maxSelections: null }, {
      optionMaxSelectionsOverrides: {},
    }),
    Infinity,
  );
});

test("variant max override validation rejects unknown options", () => {
  const result = validateVariantOptionMaxSelectionsOverrides(
    { "11111111-1111-4111-8111-111111111111": 1 },
    [],
    "22222222-2222-4222-8222-222222222222",
  );

  assert.equal(result.status, "error");
});

test("variant max override validation rejects single-select options", () => {
  const productId = "22222222-2222-4222-8222-222222222222";
  const optionId = "11111111-1111-4111-8111-111111111111";
  const result = validateVariantOptionMaxSelectionsOverrides(
    { [optionId]: 1 },
    [{ id: optionId, productId, type: "single_select" }],
    productId,
  );

  assert.equal(result.status, "error");
});

test("variant max override validation rejects options from another product", () => {
  const optionId = "11111111-1111-4111-8111-111111111111";
  const result = validateVariantOptionMaxSelectionsOverrides(
    { [optionId]: 1 },
    [
      {
        id: optionId,
        productId: "33333333-3333-4333-8333-333333333333",
        type: "multi_select",
      },
    ],
    "22222222-2222-4222-8222-222222222222",
  );

  assert.equal(result.status, "error");
});

test("variant max override validation rejects non-positive values", () => {
  const productId = "22222222-2222-4222-8222-222222222222";
  const optionId = "11111111-1111-4111-8111-111111111111";
  const result = validateVariantOptionMaxSelectionsOverrides(
    { [optionId]: 0 },
    [{ id: optionId, productId, type: "multi_select" }],
    productId,
  );

  assert.equal(result.status, "error");
});

test("variant max override validation accepts multi-select options from the same product", () => {
  const productId = "22222222-2222-4222-8222-222222222222";
  const optionId = "11111111-1111-4111-8111-111111111111";
  const result = validateVariantOptionMaxSelectionsOverrides(
    { [optionId]: 2 },
    [{ id: optionId, productId, type: "multi_select" }],
    productId,
  );

  assert.deepEqual(result, {
    status: "success",
    overrides: { [optionId]: 2 },
  });
});

test("storefront DTO preserves variant option max selection overrides", () => {
  const optionId = "11111111-1111-4111-8111-111111111111";
  const fixture = buildStorefrontFixture(
    {
      slug: "tacos-test",
      name: "Tacos Test",
      city: "Casablanca",
      address: "Maarif",
    } as Parameters<typeof buildStorefrontFixture>[0],
    [
      {
        id: "category-1",
        name: "Tacos",
        products: [
          {
            id: "product-1",
            name: "Tacos",
            description: null,
            price: "40.00",
            image: null,
            variants: [
              {
                id: "variant-1",
                name: "1 Viande",
                priceOverride: "45.00",
                position: 0,
                optionMaxSelectionsOverrides: { [optionId]: 1 },
              },
            ],
            options: [
              {
                id: optionId,
                name: "Sauce",
                type: "multi_select",
                required: true,
                maxSelections: 2,
                position: 0,
                values: [],
              },
            ],
          },
        ],
      },
    ] as unknown as Parameters<typeof buildStorefrontFixture>[1],
  );

  const variant = fixture.sections[0]!.items[0]!.variants![0]!;
  assert.deepEqual(variant.optionMaxSelectionsOverrides, { [optionId]: 1 });
  assert.deepEqual(variant.option_max_selections_overrides, { [optionId]: 1 });
});

test.skip("variant CRUD round-trip requires live Postgres on DATABASE_URL");
test.skip("option CRUD round-trip requires live Postgres on DATABASE_URL");
test.skip("option value CRUD round-trip requires live Postgres on DATABASE_URL");
test.skip("cross-business authorization requires live Postgres on DATABASE_URL");
