import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OrderTrackerLink } from "../../app/[locale]/(storefront)/[slug]/order/confirmation/order-tracker-link";

test("OrderTrackerLink points to the customer order tracker", () => {
  const locale = "fr";
  const customerAccessToken = "cust_tok_123";
  const html = renderToStaticMarkup(
    <OrderTrackerLink
      locale={locale}
      customerAccessToken={customerAccessToken}
    />,
  );

  assert.match(html, new RegExp(`href="/${locale}/o/${customerAccessToken}"`));
  assert.match(html, />SUIVRE MA COMMANDE →<\/span>/);
});
