import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import type { paths } from "./api";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2)
    ? true
    : false;
type Expect<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;

type SampleMenuResponse =
  paths["/v1/_samples/effective-menu"]["post"]["responses"][200]["content"]["application/json"];
type SampleMenuRequest =
  paths["/v1/_samples/effective-menu"]["post"]["requestBody"]["content"]["application/json"];
type SampleProduct = SampleMenuResponse["categories"][number]["products"][number];
type SampleVariant = SampleProduct["variants"][number];

type _RequestBranchIdIsString = Expect<Equal<SampleMenuRequest["branchId"], string>>;
type _ProductEffectivePriceIsString = Expect<
  Equal<SampleProduct["effectivePrice"], string>
>;
type _VariantEffectivePriceIsString = Expect<
  Equal<SampleVariant["effectivePrice"], string>
>;
type _NestedVariantArrayIsPrecise = Expect<
  Equal<SampleProduct["variants"], SampleVariant[]>
>;
type _ProductIsNotAny = Expect<Equal<IsAny<SampleProduct>, false>>;
type _VariantIsNotAny = Expect<Equal<IsAny<SampleVariant>, false>>;

test("zod sample menu OpenAPI schema keeps money fields as decimal strings", () => {
  const openApiPath = resolve(process.cwd(), "openapi.json");
  const document = JSON.parse(readFileSync(openApiPath, "utf8")) as {
    paths?: Record<string, unknown>;
  };

  const documentWithComponents = document as {
    components?: {
      schemas?: Record<string, unknown>;
    };
    paths?: Record<string, unknown>;
  };
  const path = documentWithComponents.paths?.["/v1/_samples/effective-menu"] as
    | { post?: unknown }
    | undefined;

  assert.ok(path, "sample effective-menu path must be present in OpenAPI");

  const productSchema = documentWithComponents.components?.schemas
    ?.SampleMenuProduct_Output as
    | {
        properties?: Record<string, unknown>;
      }
    | undefined;

  const variantSchema = documentWithComponents.components?.schemas
    ?.SampleMenuVariant_Output as
    | {
        properties?: Record<string, unknown>;
      }
    | undefined;

  const effectivePrice = productSchema?.properties?.effectivePrice as
    | { type?: string }
    | undefined;
  const variantPrice = variantSchema?.properties?.effectivePrice as
    | { type?: string }
    | undefined;

  assert.equal(effectivePrice?.type, "string");
  assert.equal(variantPrice?.type, "string");
});

test("sample SDK consumer reads nested money fields without casts", () => {
  const product: SampleProduct = {
    id: "33333333-3333-4333-8333-333333333333",
    name: { fr: "Poulet rôti" },
    effectivePrice: "42.50",
    variants: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        name: "1/2 poulet",
        effectivePrice: "42.50",
        pricingMode: "fixed",
      },
    ],
  };

  const productPrice: string = product.effectivePrice;
  const variantPrice: string = product.variants[0]?.effectivePrice ?? "0.00";

  assert.equal(`${productPrice}:${variantPrice}`, "42.50:42.50");
});
