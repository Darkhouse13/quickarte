// The order tracker fades in a "+N" badge whenever the polled balance is
// strictly higher than the previously displayed one. Anything else — first
// load (prev === null), spend (next < prev), no change — returns null so the
// tracker hides the badge instead of showing a misleading delta.
export function balanceJumpDelta(
  prevBalance: number | null,
  nextBalance: number | null,
): number | null {
  if (nextBalance === null) return null;
  if (prevBalance === null) return null;
  if (nextBalance <= prevBalance) return null;
  return nextBalance - prevBalance;
}
