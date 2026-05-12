import assert from "node:assert/strict";
import test from "node:test";
import { getCartLineKey, useCartStore } from "./cart-store";

test("cart merges identical configured items by quantity", () => {
  useCartStore.setState({ items: [] });

  const line = {
    product_id: "product-1",
    product_name: "Tacos",
    variant_id: "variant-xl",
    variant_name: "XL",
    selected_option_value_ids: ["sauce-2", "meat-1"],
    selected_options_summary: [
      {
        option_id: "meat",
        option_name: "Viande",
        option_type: "single_select" as const,
        values: [
          {
            value_id: "meat-1",
            value_name: "Poulet",
            price_addition: 0,
          },
        ],
      },
      {
        option_id: "sauce",
        option_name: "Sauces",
        option_type: "multi_select" as const,
        values: [
          {
            value_id: "sauce-2",
            value_name: "Algérienne",
            price_addition: 0,
          },
        ],
      },
    ],
    unit_price: 55,
  };

  useCartStore.getState().addItem({ ...line, quantity: 1 });
  useCartStore.getState().addItem({
    ...line,
    selected_option_value_ids: ["meat-1", "sauce-2"],
    quantity: 2,
  });

  const items = useCartStore.getState().items;
  assert.equal(items.length, 1);
  assert.equal(items[0]?.quantity, 3);
  assert.equal(getCartLineKey(items[0]!), "product-1|variant-xl|meat-1,sauce-2");
});

test("cart keeps same product with different configuration as distinct lines", () => {
  useCartStore.setState({ items: [] });

  const base = {
    product_id: "product-1",
    product_name: "Tacos",
    variant_id: "variant-xl",
    variant_name: "XL",
    selected_options_summary: [],
    unit_price: 55,
  };

  useCartStore.getState().addItem({
    ...base,
    selected_option_value_ids: ["sauce-1"],
  });
  useCartStore.getState().addItem({
    ...base,
    selected_option_value_ids: ["sauce-2"],
  });

  const items = useCartStore.getState().items;
  assert.equal(items.length, 2);
  assert.equal(useCartStore.getState().getItemCount(), 2);
});

test("legacy quick-add constructs an unconfigured cart line", () => {
  useCartStore.setState({ items: [] });

  useCartStore.getState().addItem({
    productId: "product-plain",
    name: "Café",
    price: 12,
  });

  const item = useCartStore.getState().items[0];
  assert.equal(item?.product_id, "product-plain");
  assert.equal(item?.variant_id, null);
  assert.deepEqual(item?.selected_option_value_ids, []);
  assert.equal(item?.unit_price, 12);
});
