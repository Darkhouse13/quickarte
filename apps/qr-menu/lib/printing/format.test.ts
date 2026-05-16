import test from "node:test";
import assert from "node:assert/strict";
import {
  formatTestPrintPayload,
  generateWebprintToken,
  nextFailureState,
} from "./format";
import { assertTicketWidth } from "./ticket";

test("generateWebprintToken creates a 32-byte url-safe token", () => {
  const token = generateWebprintToken();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
});

test("nextFailureState keeps attempts below 3 pending", () => {
  assert.deepEqual(nextFailureState(0), { attempts: 1, status: "pending" });
  assert.deepEqual(nextFailureState(2), { attempts: 3, status: "failed" });
});

test("formatTestPrintPayload uses the canned French payload at 32 columns", () => {
  const payload = formatTestPrintPayload(new Date("2026-05-14T12:34:00"));
  assertTicketWidth(payload);
  assert.equal(
    payload,
    [
      "=== TEST D'IMPRESSION ===",
      "Quickarte",
      "14/05/2026 12:34",
      "Si vous lisez ceci, votre",
      "imprimante fonctionne.",
    ].join("\n"),
  );
});
