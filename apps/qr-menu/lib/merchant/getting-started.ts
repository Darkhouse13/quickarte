type GettingStartedStats = {
  todayOrderCount: number;
  todayRevenue: number;
  pendingCount: number;
};

export function shouldShowGettingStarted(
  stats: GettingStartedStats,
  recentOrderCount: number,
  catalogItemCount: number,
): boolean {
  return (
    catalogItemCount === 0 &&
    stats.todayOrderCount === 0 &&
    stats.todayRevenue === 0 &&
    stats.pendingCount === 0 &&
    recentOrderCount === 0
  );
}
