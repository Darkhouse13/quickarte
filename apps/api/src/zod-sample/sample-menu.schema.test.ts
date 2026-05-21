import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decimalStringSchema,
  sampleEffectiveMenuResponseSchema,
} from "./sample-menu.schema";

test("sample menu schema accepts decimal-string money fields", () => {
  const parsed = sampleEffectiveMenuResponseSchema.parse({
    branchId: "11111111-1111-4111-8111-111111111111",
    generatedAt: "2026-05-21T00:00:00.000Z",
    categories: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: { fr: "Grillades" },
        products: [
          {
            id: "33333333-3333-4333-8333-333333333333",
            name: { fr: "Poulet rôti" },
            effectivePrice: "42.50",
            variants: [
              {
                id: "44444444-4444-4444-8444-444444444444",
                name: "1/2 poulet",
                effectivePrice: "42.50",
                pricingMode: "fixed",
              },
            ],
          },
        ],
      },
    ],
  });

  assert.equal(parsed.categories[0]?.products[0]?.effectivePrice, "42.50");
  assert.equal(
    parsed.categories[0]?.products[0]?.variants[0]?.effectivePrice,
    "42.50",
  );
});

test("money schemas reject JavaScript numbers", () => {
  const productPrice = decimalStringSchema.safeParse(42.5);
  const nestedResponse = sampleEffectiveMenuResponseSchema.safeParse({
    branchId: "11111111-1111-4111-8111-111111111111",
    generatedAt: "2026-05-21T00:00:00.000Z",
    categories: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: { fr: "Grillades" },
        products: [
          {
            id: "33333333-3333-4333-8333-333333333333",
            name: { fr: "Poulet rôti" },
            effectivePrice: 42.5,
            variants: [
              {
                id: "44444444-4444-4444-8444-444444444444",
                name: "1/2 poulet",
                effectivePrice: 42.5,
                pricingMode: "fixed",
              },
            ],
          },
        ],
      },
    ],
  });

  assert.equal(productPrice.success, false);
  assert.equal(nestedResponse.success, false);
});

