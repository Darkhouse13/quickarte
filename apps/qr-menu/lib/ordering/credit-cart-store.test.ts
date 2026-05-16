import test from "node:test";
import assert from "node:assert/strict";
import {
  canAddListing,
  creditCartItemCount,
  creditCartTotal,
  resolveCustomerPhone,
  type CreditCartItem,
} from "./credit-cart-store";

const items: CreditCartItem[] = [
  {
    listingId: "listing-pastry",
    productId: "product-pastry",
    productName: "Pastel",
    creditPrice: 50,
    quantity: 1,
  },
  {
    listingId: "listing-juice",
    productId: "product-juice",
    productName: "Jus d'orange",
    creditPrice: 30,
    quantity: 2,
  },
];

test("credit cart total sums each line by quantity", () => {
  assert.equal(creditCartTotal(items), 50 + 30 * 2);
});

test("credit cart item count is total quantity not line count", () => {
  assert.equal(creditCartItemCount(items), 3);
});

test("canAddListing returns true when the next add fits the balance exactly", () => {
  assert.equal(
    canAddListing({
      listing: { creditPrice: 10 },
      cart: items,
      balance: 50 + 30 * 2 + 10,
    }),
    true,
  );
});

test("canAddListing returns false when the next add would overflow the balance", () => {
  assert.equal(
    canAddListing({
      listing: { creditPrice: 50 },
      cart: items,
      balance: 100,
    }),
    false,
  );
});

test("canAddListing returns true on an empty cart when the listing fits the balance", () => {
  assert.equal(
    canAddListing({
      listing: { creditPrice: 50 },
      cart: [],
      balance: 100,
    }),
    true,
  );
});

test("phone resolver prefers the URL param over localStorage", () => {
  assert.equal(
    resolveCustomerPhone({ fromUrl: "+212600000001", fromStorage: "+212600000002" }),
    "+212600000001",
  );
});

test("phone resolver falls back to localStorage when no URL param", () => {
  assert.equal(
    resolveCustomerPhone({ fromUrl: null, fromStorage: "+212600000003" }),
    "+212600000003",
  );
});

test("phone resolver returns null when neither source is set", () => {
  assert.equal(resolveCustomerPhone({ fromUrl: null, fromStorage: null }), null);
});

test("phone resolver treats whitespace-only values as missing", () => {
  assert.equal(
    resolveCustomerPhone({ fromUrl: "  ", fromStorage: "   " }),
    null,
  );
});
