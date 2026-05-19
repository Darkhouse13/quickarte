import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  "components/storefront/checkout-form.tsx",
  "utf8",
);

test("checkout redirects after the last cart item is removed", () => {
  assert.match(source, /const itemCount = hydrated \? getItemCount\(\) : 0;/);
  assert.match(source, /if \(hydrated && itemCount === 0 && !isPending\)/);
  assert.match(
    source,
    /\}, \[hydrated, itemCount, isPending, router, locale, businessSlug\]\);/,
  );
  assert.doesNotMatch(
    source,
    /\}, \[hydrated, getItemCount, isPending, router, locale, businessSlug\]\);/,
  );
});
