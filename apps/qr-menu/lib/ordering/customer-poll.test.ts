import test from "node:test";
import assert from "node:assert/strict";
import { createStatusPoller, type StatusFetchResult } from "./customer-poll";

// The async tick body resolves over a few microtask hops (fetch -> json ->
// callbacks). Flushing a handful of resolved promises lets it settle between
// fake-timer ticks.
const flush = async () => {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
};

test("poller surfaces status changes each interval, then stops on served", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });

  const queue: StatusFetchResult[] = [
    {
      kind: "ok",
      snapshot: { status: "preparing", latestEventAt: "2026-05-14T10:00:00.000Z" },
    },
    {
      kind: "ok",
      snapshot: { status: "ready", latestEventAt: "2026-05-14T10:05:00.000Z" },
    },
    {
      kind: "ok",
      snapshot: { status: "completed", latestEventAt: "2026-05-14T10:09:00.000Z" },
    },
  ];
  let fetchCalls = 0;
  const seenStatuses: string[] = [];

  const poller = createStatusPoller(
    { initialStatus: "preparing", intervalMs: 10_000 },
    {
      fetchStatus: async () => {
        fetchCalls += 1;
        return queue.shift() ?? { kind: "error" };
      },
      onSnapshot: (snapshot) => seenStatuses.push(snapshot.status),
      onRevoked: () => {},
    },
  );

  poller.start();

  t.mock.timers.tick(10_000);
  await flush();
  assert.deepEqual(seenStatuses, ["preparing"]);

  // preparing -> ready: the displayed status word updates.
  t.mock.timers.tick(10_000);
  await flush();
  assert.deepEqual(seenStatuses, ["preparing", "ready"]);

  // ready -> served (completed): one final update, then the loop stops.
  t.mock.timers.tick(10_000);
  await flush();
  assert.deepEqual(seenStatuses, ["preparing", "ready", "completed"]);
  assert.equal(poller.isStopped(), true);

  // No further fetches once terminal — even as time keeps advancing.
  const callsAtStop = fetchCalls;
  t.mock.timers.tick(10_000);
  t.mock.timers.tick(10_000);
  await flush();
  assert.equal(fetchCalls, callsAtStop);
});

test("poller stops permanently and reports revoked on a 404", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });

  let revoked = false;
  let fetchCalls = 0;
  const poller = createStatusPoller(
    { initialStatus: "preparing", intervalMs: 10_000 },
    {
      fetchStatus: async () => {
        fetchCalls += 1;
        return { kind: "revoked" };
      },
      onSnapshot: () => {},
      onRevoked: () => {
        revoked = true;
      },
    },
  );

  poller.start();
  t.mock.timers.tick(10_000);
  await flush();

  assert.equal(revoked, true);
  assert.equal(poller.isStopped(), true);

  const callsAtStop = fetchCalls;
  t.mock.timers.tick(10_000);
  await flush();
  assert.equal(fetchCalls, callsAtStop);
});

test("poller keeps the last status on a network error and retries quietly", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });

  const queue: StatusFetchResult[] = [
    { kind: "error" },
    {
      kind: "ok",
      snapshot: { status: "ready", latestEventAt: "2026-05-14T10:05:00.000Z" },
    },
  ];
  const seenStatuses: string[] = [];
  let revoked = false;

  const poller = createStatusPoller(
    { initialStatus: "preparing", intervalMs: 10_000 },
    {
      fetchStatus: async () => queue.shift() ?? { kind: "error" },
      onSnapshot: (snapshot) => seenStatuses.push(snapshot.status),
      onRevoked: () => {
        revoked = true;
      },
    },
  );

  poller.start();

  // Errored poll: no snapshot, no revoked signal, loop still alive.
  t.mock.timers.tick(10_000);
  await flush();
  assert.deepEqual(seenStatuses, []);
  assert.equal(revoked, false);
  assert.equal(poller.isStopped(), false);

  // Next interval recovers.
  t.mock.timers.tick(10_000);
  await flush();
  assert.deepEqual(seenStatuses, ["ready"]);
});

test("poller never starts when the order is already terminal", (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });

  let fetchCalls = 0;
  const poller = createStatusPoller(
    { initialStatus: "completed", intervalMs: 10_000 },
    {
      fetchStatus: async () => {
        fetchCalls += 1;
        return { kind: "error" };
      },
      onSnapshot: () => {},
      onRevoked: () => {},
    },
  );

  poller.start();
  assert.equal(poller.isStopped(), true);

  t.mock.timers.tick(10_000);
  assert.equal(fetchCalls, 0);
});
