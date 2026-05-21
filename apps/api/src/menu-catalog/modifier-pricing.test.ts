import assert from "node:assert/strict";
import { test } from "node:test";
import { computeModifierGroupDelta } from "./modifier-pricing";

test("modifier tier pricing charges only per-value additions below the free quota", () => {
  assert.equal(
    computeModifierGroupDelta({
      freeQuantity: 2,
      extraPrice: "10.00",
      selections: [
        { valueId: "olives", priceAddition: "2.50" },
        { valueId: "sauce", priceAddition: "0.00" },
      ],
    }),
    "2.50",
  );
});

test("modifier tier pricing adds uniform extra price after the free quota", () => {
  assert.equal(
    computeModifierGroupDelta({
      freeQuantity: 2,
      extraPrice: "10.00",
      selections: [
        { valueId: "olives", priceAddition: "2.50" },
        { valueId: "sauce", priceAddition: "0.00" },
        { valueId: "fromage", priceAddition: "4.00" },
        { valueId: "champignons", priceAddition: "1.50" },
      ],
    }),
    "28.00",
  );
});

test("modifier tier pricing handles zero free quota and missing extra price", () => {
  assert.equal(
    computeModifierGroupDelta({
      freeQuantity: 0,
      extraPrice: null,
      selections: [
        { valueId: "harissa", priceAddition: "1.00" },
        { valueId: "mayo", priceAddition: "1.25" },
      ],
    }),
    "2.25",
  );
});

test("modifier tier pricing is decimal safe", () => {
  assert.equal(
    computeModifierGroupDelta({
      freeQuantity: 1,
      extraPrice: "0.10",
      selections: [
        { valueId: "a", priceAddition: "0.10" },
        { valueId: "b", priceAddition: "0.20" },
      ],
    }),
    "0.40",
  );
});
