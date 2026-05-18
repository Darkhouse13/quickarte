import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CategoryPills } from "./category-pills";

const categories = [
  { id: "starters", label: "Entrées" },
  { id: "burgers", label: "Burgers" },
  { id: "desserts", label: "Desserts" },
];

function renderPills(activeId = "burgers") {
  return renderToStaticMarkup(
    <CategoryPills
      categories={categories}
      activeId={activeId}
      onSelect={() => {}}
    />,
  );
}

test("CategoryPills keeps the filters horizontally scrollable with a designed scrollbar", () => {
  const html = renderPills();
  assert.match(html, /category-scrollbar/);
  assert.match(html, /overflow-x-auto/);
  assert.doesNotMatch(html, /no-scrollbar/);
  assert.match(html, /aria-label="Filtres de catégories"/);
});

test("CategoryPills uses non-wrapping pills and exposes the active category", () => {
  const html = renderPills();
  assert.match(html, /shrink-0/);
  assert.match(html, /whitespace-nowrap/);
  assert.match(html, /snap-start/);
  assert.match(html, /data-category-id="burgers"/);
  assert.match(html, /aria-current="true"/);
});
