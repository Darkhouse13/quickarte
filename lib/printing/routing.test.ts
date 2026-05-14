import test from "node:test";
import assert from "node:assert/strict";
import {
  getRoutedStationsForCategory,
  splitOrderItemsByStation,
  type Station,
} from "./routing";

let currentCategoryId = "";

function txFor(routes: Record<string, Station[]>) {
  return {
    select: () => ({
      from: () => ({
        where: async () =>
          (routes[currentCategoryId] ?? []).map((station) => ({
            station,
          })),
      }),
    }),
  } as never;
}

test("getRoutedStationsForCategory returns every station when no rows exist", async () => {
  currentCategoryId = "cat-empty";
  const stations = await getRoutedStationsForCategory(
    "business-1",
    "cat-empty",
    txFor({}),
  );

  assert.deepEqual(stations, ["counter", "kitchen", "bar"]);
});

test("splitOrderItemsByStation partitions items and copies multi-station items", async () => {
  const routes: Record<string, Station[]> = {
    "cat-food": ["kitchen"],
    "cat-shared": ["kitchen", "bar"],
    "cat-drinks": ["bar"],
  };
  const items = [
    item("tacos", "cat-food"),
    item("wings", "cat-shared"),
    item("coffee", "cat-drinks"),
  ];

  let nextCategory = 0;
  const categories = ["cat-food", "cat-shared", "cat-drinks"];
  const routedTx = {
    select: () => ({
      from: () => ({
        where: async () => {
          const categoryId = categories[nextCategory++] ?? "";
          return (routes[categoryId] ?? []).map((station) => ({ station }));
        },
      }),
    }),
  } as never;

  const split = await splitOrderItemsByStation(items, "business-1", routedTx);

  assert.deepEqual(
    split.get("counter")?.map((line) => line.id),
    ["tacos", "wings", "coffee"],
  );
  assert.deepEqual(
    split.get("kitchen")?.map((line) => line.id),
    ["tacos", "wings"],
  );
  assert.deepEqual(
    split.get("bar")?.map((line) => line.id),
    ["wings", "coffee"],
  );
});

function item(id: string, categoryId: string) {
  return {
    id,
    orderId: "order-1",
    productId: `product-${id}`,
    quantity: 1,
    unitPrice: "10.00",
    subtotal: "10.00",
    optionsJson: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    product: { categoryId },
  };
}
