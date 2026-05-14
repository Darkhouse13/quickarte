import test from "node:test";
import assert from "node:assert/strict";
import { validateOrderTransition } from "./transitions";

test("transitionOrder allows accepted order to move directly to ready", () => {
  assert.equal(validateOrderTransition("confirmed", "ready"), true);
});

test("transitionOrder allows accepted order to move to preparing", () => {
  assert.equal(validateOrderTransition("confirmed", "preparing"), true);
});

test("transitionOrder allows ready order to be served", () => {
  assert.equal(validateOrderTransition("ready", "completed"), true);
});

test("transitionOrder rejects served order moving back to preparing", () => {
  assert.equal(validateOrderTransition("completed", "preparing"), false);
});

test("transitionOrder rejects cancelled order moving back to accepted", () => {
  assert.equal(validateOrderTransition("cancelled", "confirmed"), false);
});
