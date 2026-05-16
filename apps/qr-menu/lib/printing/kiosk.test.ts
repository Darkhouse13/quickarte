import test from "node:test";
import assert from "node:assert/strict";
import {
  appendLog,
  computeHealth,
  extractTableNumber,
  formatPollAgeFr,
  processBatch,
  trailingFailureStreak,
  type KioskLogEntry,
  type PrintJob,
  type PrintJobDeps,
} from "./kiosk";

const SECOND = 1000;
const MINUTE = 60 * SECOND;

// --- connection health state machine ---------------------------------------

test("health is green within 15s of the last successful poll", () => {
  const base = { lastSuccessfulPollAt: 0, printFailureStreak: 0 };
  assert.equal(computeHealth({ now: 0, ...base }), "green");
  assert.equal(computeHealth({ now: 14_999, ...base }), "green");
});

test("health is amber between 15s and 2min since the last poll", () => {
  const base = { lastSuccessfulPollAt: 0, printFailureStreak: 0 };
  assert.equal(computeHealth({ now: 15 * SECOND, ...base }), "amber");
  assert.equal(computeHealth({ now: 90 * SECOND, ...base }), "amber");
  assert.equal(computeHealth({ now: 2 * MINUTE, ...base }), "amber");
});

test("health is red past 2min without a successful poll", () => {
  assert.equal(
    computeHealth({
      now: 2 * MINUTE + 1,
      lastSuccessfulPollAt: 0,
      printFailureStreak: 0,
    }),
    "red",
  );
});

test("health is red after 3 consecutive print failures even with fresh polls", () => {
  assert.equal(
    computeHealth({
      now: SECOND,
      lastSuccessfulPollAt: 0,
      printFailureStreak: 3,
    }),
    "red",
  );
});

test("health is red when no poll has ever succeeded", () => {
  assert.equal(
    computeHealth({
      now: SECOND,
      lastSuccessfulPollAt: null,
      printFailureStreak: 0,
    }),
    "red",
  );
});

// --- in-session log buffer --------------------------------------------------

test("log buffer caps at 20, evicting the oldest entry first", () => {
  let log: KioskLogEntry[] = [];
  for (let i = 0; i < 25; i += 1) {
    log = appendLog(log, {
      jobId: `job-${i}`,
      table: `${i}`,
      payloadText: "",
      at: i,
      outcome: "printed",
    });
  }
  assert.equal(log.length, 20);
  assert.equal(log[0]?.jobId, "job-24"); // newest first
  assert.equal(log[19]?.jobId, "job-5"); // oldest survivor
});

// --- ticket parsing ---------------------------------------------------------

test("extractTableNumber reads the table token from a rendered ticket", () => {
  const ticket = [
    "           QUICKARTE",
    "================================",
    "            TABLE 7",
    "================================",
  ].join("\n");
  assert.equal(extractTableNumber(ticket), "7");
});

test("extractTableNumber falls back to an em dash when no table line exists", () => {
  assert.equal(extractTableNumber("no table on this ticket"), "—");
});

// --- sequential print pipeline ("e2e" against the same helpers the UI uses) -

const makeJob = (id: string): PrintJob => ({
  id,
  payload_text: `         TABLE ${id}`,
  created_at: "2026-05-14T10:00:00.000Z",
  order_id: `order-${id}`,
  attempts: 0,
});

test("processBatch prints a job then POSTs printed with the job id", async () => {
  const events: string[] = [];
  const deps: PrintJobDeps = {
    renderPayload: () => events.push("render"),
    triggerPrint: () => events.push("print"),
    awaitPrintComplete: async () => {
      events.push("afterprint");
    },
    reportPrinted: async (id) => {
      events.push(`printed:${id}`);
    },
    reportFailed: async (id) => {
      events.push(`failed:${id}`);
    },
  };

  const outcomes = await processBatch([makeJob("3")], deps);

  assert.deepEqual(outcomes, [{ jobId: "3", status: "printed" }]);
  assert.deepEqual(events, ["render", "print", "afterprint", "printed:3"]);
});

test("processBatch fully resolves each job before starting the next", async () => {
  const events: string[] = [];
  const deps: PrintJobDeps = {
    renderPayload: () => {},
    triggerPrint: () => events.push("print-start"),
    awaitPrintComplete: async () => {
      // A real afterprint resolves on a later tick; assert nothing from the
      // next job sneaks in before this resolves.
      await new Promise((resolve) => setTimeout(resolve, 1));
      events.push("print-done");
    },
    reportPrinted: async (id) => {
      events.push(`printed-${id}`);
    },
    reportFailed: async () => {},
  };

  await processBatch([makeJob("a"), makeJob("b")], deps);

  assert.deepEqual(events, [
    "print-start",
    "print-done",
    "printed-a",
    "print-start",
    "print-done",
    "printed-b",
  ]);
});

test("processBatch POSTs failed with 'print api threw' when window.print throws", async () => {
  const calls: string[] = [];
  const deps: PrintJobDeps = {
    renderPayload: () => {},
    triggerPrint: () => {
      throw new Error("kiosk printing disabled");
    },
    awaitPrintComplete: async () => {
      calls.push("awaited");
    },
    reportPrinted: async () => {
      calls.push("printed");
    },
    reportFailed: async (id, error) => {
      calls.push(`failed:${id}:${error}`);
    },
  };

  const outcomes = await processBatch([makeJob("9")], deps);

  assert.equal(outcomes[0]?.status, "failed");
  assert.deepEqual(calls, ["failed:9:print api threw"]);
});

test("processBatch POSTs failed with the timeout reason when afterprint never fires", async () => {
  const calls: string[] = [];
  const deps: PrintJobDeps = {
    renderPayload: () => {},
    triggerPrint: () => {},
    awaitPrintComplete: async () => {
      throw new Error("afterprint timeout");
    },
    reportPrinted: async () => {},
    reportFailed: async (id, error) => {
      calls.push(`${id}:${error}`);
    },
  };

  const outcomes = await processBatch([makeJob("t")], deps);

  assert.equal(outcomes[0]?.status, "failed");
  assert.deepEqual(calls, ["t:afterprint timeout"]);
});

test("trailingFailureStreak counts only the trailing run of failures", () => {
  assert.equal(trailingFailureStreak([]), 0);
  assert.equal(
    trailingFailureStreak([
      { jobId: "a", status: "failed", error: "x" },
      { jobId: "b", status: "printed" },
      { jobId: "c", status: "failed", error: "x" },
      { jobId: "d", status: "failed", error: "x" },
    ]),
    2,
  );
  assert.equal(
    trailingFailureStreak([
      { jobId: "a", status: "failed", error: "x" },
      { jobId: "b", status: "printed" },
    ]),
    0,
  );
});

// --- elapsed-time copy ------------------------------------------------------

test("formatPollAgeFr renders calm, second-granular French copy", () => {
  assert.equal(formatPollAgeFr(0), "à l'instant");
  assert.equal(formatPollAgeFr(2_999), "à l'instant");
  assert.equal(formatPollAgeFr(5 * SECOND), "il y a 5 s");
  assert.equal(formatPollAgeFr(59 * SECOND), "il y a 59 s");
  assert.equal(formatPollAgeFr(90 * SECOND), "il y a 1 min");
  assert.equal(formatPollAgeFr(2 * 60 * MINUTE), "il y a 2 h");
});
