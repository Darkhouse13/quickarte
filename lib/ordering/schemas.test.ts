import { test } from "node:test";
import { strict as assert } from "node:assert";
import { placeOrderSchema } from "./schemas";

const basePayload = {
  businessId: "11111111-1111-4111-8111-111111111111",
  customerName: "Salma",
  orderType: "dine_in" as const,
  tableNumber: 7,
  items: [
    {
      product_id: "22222222-2222-4222-8222-222222222222",
      quantity: 1,
      variant_id: null,
      selected_option_values: [],
      unit_price: 42,
    },
  ],
};

test("placeOrderSchema allows an order without a phone number", () => {
  const parsed = placeOrderSchema.safeParse({
    ...basePayload,
    customerPhone: "",
  });

  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.customerPhone, null);
});

test("placeOrderSchema still requires customer name", () => {
  const parsed = placeOrderSchema.safeParse({
    ...basePayload,
    customerName: "",
    customerPhone: "0611223344",
  });

  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.ok(parsed.error.flatten().fieldErrors.customerName?.length);
  }
});

test("placeOrderSchema still requires a table number for dine-in orders", () => {
  const parsed = placeOrderSchema.safeParse({
    ...basePayload,
    customerPhone: "0611223344",
    tableNumber: undefined,
  });

  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.ok(parsed.error.flatten().fieldErrors.tableNumber?.length);
  }
});

test("placeOrderSchema still rejects invalid phone numbers when a phone is provided", () => {
  const parsed = placeOrderSchema.safeParse({
    ...basePayload,
    customerPhone: "123",
  });

  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.ok(parsed.error.flatten().fieldErrors.customerPhone?.length);
  }
});
