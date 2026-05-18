import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ValueRow,
  type ProductCustomizationOptionValue,
} from "./product-customizations-value-row";

// The DOM order of the three zones in the value-row grid is what determines
// their on-screen left-to-right placement. Asserting on DOM order is the
// SSR-friendly proxy for the compact HTML-design row layout.

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

test("ValueRow uses compact 1fr/auto/auto grid columns", () => {
  const html = renderRow();
  assert.match(html, /grid-cols-\[minmax\(0,1fr\)_auto_auto\]/);
  assert.match(html, /class="[^"]*\bgrid\b[^"]*\bgap-2\b/);
});

test("ValueRow renders info, toggle, and controls zones in left-to-right DOM order", () => {
  const html = renderRow();
  const info = html.indexOf('data-testid="value-row-info"');
  const toggle = html.indexOf('data-testid="value-row-toggle"');
  const controls = html.indexOf('data-testid="value-row-arrows"');
  assert.ok(info > -1, "info zone missing");
  assert.ok(toggle > -1, "toggle zone missing");
  assert.ok(controls > -1, "controls zone missing");
  assert.ok(
    info < toggle && toggle < controls,
    `zones out of order: info=${info} toggle=${toggle} controls=${controls}`,
  );
});

test("delete control lives with the compact row controls", () => {
  const html = renderRow();
  const controls = html.indexOf('data-testid="value-row-arrows"');
  const del = html.indexOf('data-testid="value-row-delete"');
  assert.ok(
    del > controls,
    `delete button not in controls zone: del=${del} controls=${controls}`,
  );
  assert.match(html.slice(del, del + 300), /aria-label="Supprimer"/);
});

test("toggle uses the extracted small track treatment", () => {
  const html = renderRow();
  const toggle = html.indexOf('data-testid="value-row-toggle-button"');
  assert.ok(toggle > -1, "toggle button missing");
  const toggleSlice = html.slice(toggle, toggle + 500);
  assert.match(toggleSlice, /\bw-11\b/, "toggle tap target < 44px wide");
  assert.match(toggleSlice, /min-h-\[44px\]/, "toggle tap target < 44px tall");
  assert.match(toggleSlice, /\bw-9\b/, "visual toggle track should be compact");
  assert.match(toggleSlice, /\bbg-ink\b/, "enabled track should use ink fill");
});

test("arrow and delete controls keep ≥44px tap targets", () => {
  const html = renderRow();
  const controls = html.indexOf('data-testid="value-row-arrows"');
  const controlsSlice = html.slice(controls);
  const tall = controlsSlice.match(/min-h-\[44px\]/g) ?? [];
  assert.ok(tall.length >= 3, "up, down, and delete buttons must be ≥44px tall");
});
