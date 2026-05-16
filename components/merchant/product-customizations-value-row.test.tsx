import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ValueRow,
  type ProductCustomizationOptionValue,
} from "./product-customizations-value-row";

// The DOM order of the three zones in the value-row grid is what determines
// their on-screen left-to-right placement (grid-template-columns:
// minmax(0,1fr) auto auto). Asserting on DOM order is the SSR-friendly proxy
// for the visual non-overlap a playwright snapshot would otherwise check.

const sampleValue: ProductCustomizationOptionValue = {
  id: "v_1",
  name: "Biggy",
  priceAddition: "0.00",
  available: true,
  position: 0,
};

function renderRow(overrides: Partial<typeof sampleValue> = {}) {
  return renderToStaticMarkup(
    <ValueRow
      value={{ ...sampleValue, ...overrides }}
      first
      last={false}
      pending={false}
      saved={false}
      savedKey={0}
      registerName={() => {}}
      onCommitName={() => true}
      onCommitPrice={() => true}
      onAvailability={() => {}}
      onMove={() => {}}
      onDelete={() => {}}
    />,
  );
}

test("ValueRow uses a 1fr/auto/auto three-column grid", () => {
  const html = renderRow();
  assert.match(
    html,
    /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+auto/,
  );
  assert.match(html, /class="[^"]*\bgrid\b[^"]*\bgap-3\b/);
});

test("ValueRow renders info, toggle, and arrows zones in left-to-right DOM order", () => {
  const html = renderRow();
  const info = html.indexOf('data-testid="value-row-info"');
  const toggle = html.indexOf('data-testid="value-row-toggle"');
  const arrows = html.indexOf('data-testid="value-row-arrows"');
  assert.ok(info > -1, "info zone missing");
  assert.ok(toggle > -1, "toggle zone missing");
  assert.ok(arrows > -1, "arrows zone missing");
  assert.ok(
    info < toggle && toggle < arrows,
    `zones out of order: info=${info} toggle=${toggle} arrows=${arrows}`,
  );
});

test("SUPPRIMER lives inside the info zone, not under the controls", () => {
  const html = renderRow();
  const info = html.indexOf('data-testid="value-row-info"');
  const toggle = html.indexOf('data-testid="value-row-toggle"');
  const del = html.indexOf('data-testid="value-row-delete"');
  assert.ok(
    del > info && del < toggle,
    `SUPPRIMER not in info zone: del=${del} info=${info} toggle=${toggle}`,
  );
});

test("toggle zone has its own left-border separator from the info zone", () => {
  const html = renderRow();
  const toggle = html.indexOf('data-testid="value-row-toggle"');
  const arrows = html.indexOf('data-testid="value-row-arrows"');
  const toggleMarkup = html.slice(toggle, arrows);
  assert.match(
    toggleMarkup,
    /border-l/,
    "toggle zone is missing its left-border separator",
  );
});

test("toggle and arrow buttons each have ≥44px tap targets", () => {
  const html = renderRow();
  const toggleBtn = html.indexOf('data-testid="value-row-toggle-button"');
  assert.ok(toggleBtn > -1, "toggle button missing");
  const toggleSlice = html.slice(toggleBtn, toggleBtn + 400);
  assert.match(toggleSlice, /min-h-\[44px\]/, "toggle tap target < 44px");
  assert.match(toggleSlice, /\bw-12\b/, "toggle tap target < 44px wide");

  const arrows = html.indexOf('data-testid="value-row-arrows"');
  const arrowsSlice = html.slice(arrows);
  const tall = arrowsSlice.match(/min-h-\[44px\]/g) ?? [];
  const wide = arrowsSlice.match(/\bw-11\b/g) ?? [];
  assert.ok(tall.length >= 2, "both arrow buttons must be ≥44px tall");
  assert.ok(wide.length >= 2, "both arrow buttons must be ≥44px wide");
});
