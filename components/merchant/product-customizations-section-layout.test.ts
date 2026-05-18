import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  "components/merchant/product-customizations-section.tsx",
  "utf8",
);
const settingsSource = fs.readFileSync(
  "app/[locale]/(merchant)/settings/page.tsx",
  "utf8",
);

test("option choice cards use the extracted HTML card structure", () => {
  assert.match(source, /data-testid="option-choice-card"/);
  assert.match(source, /border border-ink bg-base/);
  assert.match(source, /Valeurs/);
  assert.match(source, /padStart\(2, "0"\)/);
  assert.match(source, /border border-outline/);
});

test("settings page no longer imports or renders notification settings", () => {
  assert.doesNotMatch(settingsSource, /NotificationsSettings/);
  assert.doesNotMatch(settingsSource, /notifications-settings/);
  assert.doesNotMatch(settingsSource, /NEXT_PUBLIC_VAPID_PUBLIC_KEY/);
});
