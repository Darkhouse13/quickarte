import { isCustomerTerminalStatus } from "./customer-view";

export type CustomerStatusSnapshot = {
  status: string;
  latestEventAt: string;
  // null when loyalty is not surfaced on this order; otherwise the current
  // member balance so the tracker can detect jumps without a full re-fetch.
  balance?: number | null;
};

export type StatusFetchResult =
  | { kind: "ok"; snapshot: CustomerStatusSnapshot }
  | { kind: "revoked" }
  | { kind: "error" };

export type StatusPollerCallbacks = {
  fetchStatus: () => Promise<StatusFetchResult>;
  onSnapshot: (snapshot: CustomerStatusSnapshot) => void;
  onRevoked: () => void;
};

export type StatusPollerOptions = {
  initialStatus: string;
  intervalMs?: number;
};

export type StatusPoller = {
  start: () => void;
  // Pause for a hidden tab — resumable.
  stop: () => void;
  // Resume after the tab regains focus: one immediate fetch, then the interval.
  resume: () => void;
  // Permanent teardown (component unmount).
  dispose: () => void;
  isStopped: () => boolean;
};

const DEFAULT_INTERVAL_MS = 10_000;

// Framework-agnostic polling controller for the customer order page. Kept out
// of the React component so the loop's lifecycle — interval cadence, terminal
// stop, revoked stop, quiet error retry — is unit-testable with fake timers.
export function createStatusPoller(
  options: StatusPollerOptions,
  callbacks: StatusPollerCallbacks,
): StatusPoller {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  let timerId: ReturnType<typeof setInterval> | null = null;
  // Landing on an already-finished order means there is nothing to poll for.
  let stopped = isCustomerTerminalStatus(options.initialStatus);
  let inFlight = false;

  const clearTimer = () => {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  };

  const stopPermanently = () => {
    stopped = true;
    clearTimer();
  };

  const tick = async () => {
    if (stopped || inFlight) return;
    inFlight = true;
    let result: StatusFetchResult;
    try {
      result = await callbacks.fetchStatus();
    } catch {
      result = { kind: "error" };
    }
    inFlight = false;
    if (stopped) return;

    if (result.kind === "revoked") {
      callbacks.onRevoked();
      stopPermanently();
      return;
    }
    if (result.kind === "error") {
      // Keep the last known status on screen; retry quietly next interval.
      return;
    }

    callbacks.onSnapshot(result.snapshot);
    if (isCustomerTerminalStatus(result.snapshot.status)) {
      stopPermanently();
    }
  };

  const start = () => {
    if (stopped || timerId !== null) return;
    timerId = setInterval(() => {
      void tick();
    }, intervalMs);
  };

  const stop = () => {
    clearTimer();
  };

  const resume = () => {
    if (stopped) return;
    void tick();
    start();
  };

  return {
    start,
    stop,
    resume,
    dispose: stopPermanently,
    isStopped: () => stopped,
  };
}
