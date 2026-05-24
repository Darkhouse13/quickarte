import assert from "node:assert/strict";
import { test } from "node:test";
import type { components, paths } from "./api";
import openapi from "../openapi.json";

test("M4.1 ingredient SDK contract keeps numeric values as decimal strings", () => {
  type Ingredient = components["schemas"]["Ingredient_Output"];
  type CreateIngredientBody =
    paths["/v1/ingredients"]["post"]["requestBody"]["content"]["application/json"];

  const ingredient = {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Farine",
    localizedNames: { fr: "Farine" },
    category: "dry_good",
    stockUom: "kg",
    currentCostPerUom: "12.50",
    trackedInStock: true,
    supplierId: null,
    storageLocation: null,
    position: 0,
    conversions: [],
    tags: [],
  } satisfies Ingredient;

  const body = {
    name: "Farine",
    category: "dry_good",
    stockUom: "kg",
    currentCostPerUom: "12.50",
  } satisfies CreateIngredientBody;

  assert.equal(typeof ingredient.currentCostPerUom, "string");
  assert.equal(typeof body.currentCostPerUom, "string");

  const schema = openapi.components.schemas.Ingredient_Output as {
    properties: Record<string, { type?: string; anyOf?: Array<{ type?: string }> }>;
  };
  const currentCostSchema = schema.properties.currentCostPerUom;
  assert.ok(currentCostSchema);
  assert.ok(currentCostSchema.anyOf?.some((entry) => entry.type === "string"));
});
