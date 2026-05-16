import assert from "node:assert/strict";
import test from "node:test";
import {
  filterCustomersByPhone,
  formatRelativeFr,
  formatSignedAmount,
} from "./format";

const DAY = 24 * 60 * 60 * 1000;

test("formatRelativeFr: under a day is 'aujourd'hui'", () => {
  const now = new Date("2026-05-15T12:00:00Z");
  assert.equal(
    formatRelativeFr(new Date(now.getTime() - 30 * 60 * 1000), now),
    "aujourd'hui",
  );
});

test("formatRelativeFr: 3 days", () => {
  const now = new Date("2026-05-15T12:00:00Z");
  assert.equal(
    formatRelativeFr(new Date(now.getTime() - 3 * DAY), now),
    "il y a 3 j",
  );
});

test("formatRelativeFr: 2 weeks", () => {
  const now = new Date("2026-05-15T12:00:00Z");
  assert.equal(
    formatRelativeFr(new Date(now.getTime() - 14 * DAY), now),
    "il y a 2 sem",
  );
});

test("formatRelativeFr: 1 month", () => {
  const now = new Date("2026-05-15T12:00:00Z");
  assert.equal(
    formatRelativeFr(new Date(now.getTime() - 35 * DAY), now),
    "il y a 1 mois",
  );
});

test("formatRelativeFr: 1 year is singular", () => {
  const now = new Date("2026-05-15T12:00:00Z");
  assert.equal(
    formatRelativeFr(new Date(now.getTime() - 366 * DAY), now),
    "il y a 1 an",
  );
});

test("formatRelativeFr: 3 years is plural", () => {
  const now = new Date("2026-05-15T12:00:00Z");
  assert.equal(
    formatRelativeFr(new Date(now.getTime() - 3 * 365 * DAY), now),
    "il y a 3 ans",
  );
});

test("formatSignedAmount: positive prefixed with +", () => {
  assert.equal(formatSignedAmount(50), "+50");
});

test("formatSignedAmount: negative uses typographic minus U+2212", () => {
  const out = formatSignedAmount(-30);
  assert.equal(out, "−30");
});

test("formatSignedAmount: zero", () => {
  assert.equal(formatSignedAmount(0), "0");
});

test("filterCustomersByPhone: empty search returns everyone", () => {
  const data = [
    { customerPhoneNormalized: "+212600000001" },
    { customerPhoneNormalized: "+212611111111" },
  ];
  assert.deepEqual(filterCustomersByPhone(data, ""), data);
  assert.deepEqual(filterCustomersByPhone(data, "   "), data);
});

test("filterCustomersByPhone: substring match", () => {
  const data = [
    { customerPhoneNormalized: "+212600000001" },
    { customerPhoneNormalized: "+212611111111" },
    { customerPhoneNormalized: "+212622222222" },
  ];
  assert.deepEqual(
    filterCustomersByPhone(data, "611").map((c) => c.customerPhoneNormalized),
    ["+212611111111"],
  );
});

test("filterCustomersByPhone: no match returns empty", () => {
  const data = [{ customerPhoneNormalized: "+212600000001" }];
  assert.deepEqual(filterCustomersByPhone(data, "99999"), []);
});
