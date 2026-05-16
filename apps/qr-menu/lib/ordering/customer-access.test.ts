import test from "node:test";
import assert from "node:assert/strict";
import {
  customerOptionLinesFromJson,
  isCustomerEventType,
} from "./customer-access";

test("customer event filter excludes internal print events", () => {
  assert.equal(isCustomerEventType("order.created"), true);
  assert.equal(isCustomerEventType("order.accepted"), true);
  assert.equal(isCustomerEventType("order.printed"), false);
  assert.equal(isCustomerEventType("order.reprinted"), false);
});

test("customer item options use the shared option summary lines", () => {
  assert.deepEqual(
    customerOptionLinesFromJson({
      variantId: "variant-1",
      variantName: "Double",
      variantPriceOverride: 52,
      selections: [
        {
          optionId: "option-1",
          optionName: "Sauce",
          optionType: "multi_select",
          values: [
            {
              valueId: "value-1",
              valueName: "Andalouse",
              priceAddition: 0,
            },
          ],
        },
      ],
    }),
    ["  Variante : Double", "  Sauce : Andalouse"],
  );
});
