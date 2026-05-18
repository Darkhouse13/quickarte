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
const homeSource = fs.readFileSync(
  "app/[locale]/(merchant)/home/page.tsx",
  "utf8",
);
const enableNotificationsSource = fs.readFileSync(
  "components/merchant/enable-notifications.tsx",
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

test("notification opt-in lives on merchant home instead of settings", () => {
  assert.match(homeSource, /EnableNotifications/);
  assert.match(homeSource, /components\/merchant\/enable-notifications/);
  assert.match(homeSource, /NEXT_PUBLIC_VAPID_PUBLIC_KEY/);
  assert.match(enableNotificationsSource, /Renders on \/home/);
  assert.match(enableNotificationsSource, /online_ordering/);
});
