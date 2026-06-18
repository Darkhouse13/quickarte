// Per-business "last polled" clock for Mizane order status polling.
//
// The garcon board refreshes every 3s, but we must not contact Mizane that
// often (the 120 req/min budget is shared across menu syncs, order POSTs and
// status polls). This gate collapses any number of refreshes — across every
// open garcon screen for a business — down to one Mizane fan-out per window.
//
// In-memory and therefore per-process: good enough for the single-container
// deployment. A multi-instance deploy would poll up to N× more often, still
// bounded per instance by the caller's batch cap.

export const POLL_THROTTLE_MS = 15_000;

const lastPolledAt = new Map<string, number>();

/**
 * Returns whether a Mizane poll should run for this business right now. When it
 * returns true it records the attempt synchronously, so a concurrent caller in
 * the same process is throttled out — closing the in-process race that would
 * otherwise let two simultaneous refreshes both poll.
 */
export function shouldPollMizane(
  businessId: string,
  nowMs: number,
  clock: Map<string, number> = lastPolledAt,
  throttleMs: number = POLL_THROTTLE_MS,
): boolean {
  const last = clock.get(businessId);
  if (last !== undefined && nowMs - last < throttleMs) return false;
  clock.set(businessId, nowMs);
  return true;
}
