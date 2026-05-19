import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  "components/storefront/checkout-form.tsx",
  "utf8",
);

test("checkout redirects after the last cart item is removed", () => {
  assert.match(source, /const itemCount = hydrated \? getItemCount\(\) : 0;/);
  assert.match(source, /if \(hydrated && itemCount === 0 && !isPending && !orderSubmitted\)/);
  assert.match(
    source,
    /\}, \[hydrated, itemCount, isPending, orderSubmitted, router, locale, businessSlug\]\);/,
  );
  assert.doesNotMatch(
    source,
    /\}, \[hydrated, getItemCount, isPending, router, locale, businessSlug\]\);/,
  );
});


test("checkout suppresses empty-cart redirect after a successful submit", () => {
  assert.match(source, /const \[orderSubmitted, setOrderSubmitted\] = useState\(false\);/);
  assert.match(
    source,
    /if \(hydrated && itemCount === 0 && !isPending && !orderSubmitted\)/,
  );
  assert.match(
    source,
    /\}, \[hydrated, itemCount, isPending, orderSubmitted, router, locale, businessSlug\]\);/,
  );
  assert.match(source, /setOrderSubmitted\(true\);\n\s+clearCart\(\);\n\n\s+window\.location\.assign/);
});


test("checkout success uses a document navigation for confirmation", () => {
  assert.match(source, /window\.location\.assign/);
  assert.doesNotMatch(
    source,
    /router\.replace\(\n\s+`\/\$\{locale\}\/\$\{businessSlug\}\/order\/confirmation/, 
  );
});
