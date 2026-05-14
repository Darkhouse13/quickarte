import test from "node:test";
import assert from "node:assert/strict";
import {
  getBusinessDayBoundsForDateString,
  getBusinessDayBoundsForOffsetFromDate,
} from "./business-day";

function hoursBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / 3_600_000;
}

test("getBusinessDayBounds uses Africa/Casablanca calendar days with a 24h standard day", () => {
  const bounds = getBusinessDayBoundsForDateString("2026-05-14");

  assert.ok(bounds);
  assert.equal(bounds.label, "Jeudi 14 mai 2026");
  assert.equal(hoursBetween(bounds.startUtc, bounds.endUtc), 24);
  assert.equal(bounds.startUtc.toISOString(), "2026-05-13T23:00:00.000Z");
  assert.equal(bounds.endUtc.toISOString(), "2026-05-14T23:00:00.000Z");
});

test("getBusinessDayBounds covers Morocco's 2026 fall-back day as a 25h UTC range", () => {
  const bounds = getBusinessDayBoundsForDateString("2026-02-15");

  assert.ok(bounds);
  assert.equal(hoursBetween(bounds.startUtc, bounds.endUtc), 25);
  assert.equal(bounds.startUtc.toISOString(), "2026-02-14T23:00:00.000Z");
  assert.equal(bounds.endUtc.toISOString(), "2026-02-16T00:00:00.000Z");
});

test("getBusinessDayBounds covers Morocco's 2026 spring-forward day as a 23h UTC range", () => {
  const bounds = getBusinessDayBoundsForDateString("2026-03-22");

  assert.ok(bounds);
  assert.equal(hoursBetween(bounds.startUtc, bounds.endUtc), 23);
  assert.equal(bounds.startUtc.toISOString(), "2026-03-22T00:00:00.000Z");
  assert.equal(bounds.endUtc.toISOString(), "2026-03-22T23:00:00.000Z");
});

test("getBusinessDayBoundsForOffsetFromDate offsets by local calendar day", () => {
  const bounds = getBusinessDayBoundsForOffsetFromDate(
    new Date("2026-03-23T12:00:00.000Z"),
    -1,
  );

  assert.equal(bounds.label, "Dimanche 22 mars 2026");
  assert.equal(hoursBetween(bounds.startUtc, bounds.endUtc), 23);
});
