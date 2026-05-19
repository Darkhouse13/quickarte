import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("catalogue product image upload", () => {
  it("renders a real file input on the photo tile and submits the image value", () => {
    const form = read("components/merchant/new-item-form.tsx");

    assert.match(form, /type="file"/);
    assert.match(form, /accept="image\/\*"/);
    assert.match(form, /name="imageFile"/);
    assert.match(form, /name="image"/);
    assert.match(form, /readAsDataURL\(file\)/);
    assert.match(form, /URL\.createObjectURL\(file\)/);
    assert.match(form, /className="absolute inset-0 h-full w-full cursor-pointer opacity-0"/);
    assert.match(form, /aria-label="Ajouter une photo"/);
  });

  it("persists product.image on create and update", () => {
    const actions = read("lib/catalog/actions.ts");
    const schemas = read("lib/catalog/schemas.ts");
    const editPage = read("app/[locale]/(merchant)/catalog/[productId]/edit/page.tsx");

    assert.match(schemas, /imageDataUrlSchema/);
    assert.match(actions, /image: formData\.get\("image"\)/);
    assert.match(actions, /image: parsed\.data\.image \?\? null/);
    assert.match(actions, /image: parsed\.data\.image \?\? existing\.image \?\? null/);
    assert.match(editPage, /image: true/);
  });
});
