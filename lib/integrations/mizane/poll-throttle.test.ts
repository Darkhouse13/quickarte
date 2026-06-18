import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldPollMizane } from "./poll-throttle";

describe("shouldPollMizane", () => {
  it("allows the first poll for a business", () => {
    const clock = new Map<string, number>();
    assert.equal(shouldPollMizane("biz", 1_000, clock, 15_000), true);
  });

  it("throttles a second poll inside the window", () => {
    const clock = new Map<string, number>();
    assert.equal(shouldPollMizane("biz", 1_000, clock, 15_000), true);
    assert.equal(shouldPollMizane("biz", 5_000, clock, 15_000), false);
    assert.equal(shouldPollMizane("biz", 15_999, clock, 15_000), false);
  });

  it("allows again once the window has elapsed", () => {
    const clock = new Map<string, number>();
    assert.equal(shouldPollMizane("biz", 1_000, clock, 15_000), true);
    assert.equal(shouldPollMizane("biz", 16_000, clock, 15_000), true);
  });

  it("throttles each business independently", () => {
    const clock = new Map<string, number>();
    assert.equal(shouldPollMizane("a", 1_000, clock, 15_000), true);
    assert.equal(shouldPollMizane("b", 1_000, clock, 15_000), true);
    assert.equal(shouldPollMizane("a", 2_000, clock, 15_000), false);
    assert.equal(shouldPollMizane("b", 2_000, clock, 15_000), false);
  });

  it("records the attempt synchronously so a concurrent caller is gated out", () => {
    const clock = new Map<string, number>();
    // Two callers at the same instant: only the first should win.
    const first = shouldPollMizane("biz", 1_000, clock, 15_000);
    const second = shouldPollMizane("biz", 1_000, clock, 15_000);
    assert.equal(first, true);
    assert.equal(second, false);
  });
});
