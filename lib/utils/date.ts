export function formatDashboardDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(date)
    .replace(/\./g, "")
    .toUpperCase();
}

export function formatOrderTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
