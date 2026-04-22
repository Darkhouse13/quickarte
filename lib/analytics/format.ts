const DAY_FULL_FR = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
] as const;

// Our 0..6 convention for analytics is Monday=0..Sunday=6.
const DAY_FULL_FR_MON_FIRST = [
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
] as const;

const DAY_SHORT_FR_MON_FIRST = ["L", "M", "M", "J", "V", "S", "D"] as const;

export function formatDeltaFR(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return "—";
  const rounded = Math.round(pct);
  if (rounded === 0) return "0%";
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}%`;
}

export function formatDayFR(date: Date): string {
  const dow = date.getDay();
  return DAY_FULL_FR[dow] ?? "";
}

export function dayNameFromMondayIndex(index: number): string {
  return DAY_FULL_FR_MON_FIRST[index] ?? "";
}

export function dayOfWeekShortFR(n: number): string {
  return DAY_SHORT_FR_MON_FIRST[n] ?? "";
}

export function hourLabel(h: number): string {
  return `${h}h`;
}

const shortDayFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "2-digit",
});

export function formatShortDayLabelFR(date: Date): string {
  return shortDayFormatter.format(date).replace(".", ".").trim();
}

const monthDayFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
});

export function formatMonthDayFR(date: Date): string {
  return monthDayFormatter.format(date);
}
