/**
 * Quickarte's v1 business day is the calendar day in the merchant timezone,
 * from 00:00 inclusive to the next 00:00 exclusive. A service that continues
 * past midnight therefore creates orders for the next business day. A custom
 * service-day boundary such as 06:00-06:00 is intentionally deferred.
 */

export const DEFAULT_BUSINESS_TIMEZONE = "Africa/Casablanca";

export type BusinessDateParts = {
  year: number;
  month: number;
  day: number;
};

export type BusinessDayBounds = {
  startUtc: Date;
  endUtc: Date;
  label: string;
};

const DATE_PARAM_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function getBusinessDayBounds(
  date: Date,
  timezone = DEFAULT_BUSINESS_TIMEZONE,
): BusinessDayBounds {
  return getBusinessDayBoundsForDateParts(getBusinessDateParts(date, timezone), timezone);
}

export function getBusinessDayBoundsForToday(
  timezone = DEFAULT_BUSINESS_TIMEZONE,
): BusinessDayBounds {
  return getBusinessDayBounds(new Date(), timezone);
}

export function getBusinessDayBoundsForOffset(
  days: number,
  timezone = DEFAULT_BUSINESS_TIMEZONE,
): BusinessDayBounds {
  return getBusinessDayBoundsForOffsetFromDate(new Date(), days, timezone);
}

export function getBusinessDayBoundsForOffsetFromDate(
  date: Date,
  days: number,
  timezone = DEFAULT_BUSINESS_TIMEZONE,
): BusinessDayBounds {
  const parts = addDaysToBusinessDateParts(getBusinessDateParts(date, timezone), days);
  return getBusinessDayBoundsForDateParts(parts, timezone);
}

export function getBusinessDayBoundsForDateString(
  date: string,
  timezone = DEFAULT_BUSINESS_TIMEZONE,
): BusinessDayBounds | null {
  const parts = parseBusinessDateParam(date);
  if (!parts) return null;
  return getBusinessDayBoundsForDateParts(parts, timezone);
}

export function getBusinessDayBoundsForDateParts(
  parts: BusinessDateParts,
  timezone = DEFAULT_BUSINESS_TIMEZONE,
): BusinessDayBounds {
  const startUtc = zonedDateTimeToUtc(parts, timezone);
  const endUtc = zonedDateTimeToUtc(addDaysToBusinessDateParts(parts, 1), timezone);
  return {
    startUtc,
    endUtc,
    label: formatBusinessDayLabel(startUtc, timezone),
  };
}

export function getBusinessDateParam(
  date: Date,
  timezone = DEFAULT_BUSINESS_TIMEZONE,
): string {
  return formatBusinessDateParam(getBusinessDateParts(date, timezone));
}

export function addDaysToBusinessDateParam(
  date: string,
  days: number,
): string | null {
  const parts = parseBusinessDateParam(date);
  if (!parts) return null;
  return formatBusinessDateParam(addDaysToBusinessDateParts(parts, days));
}

export function parseBusinessDateParam(date: string): BusinessDateParts | null {
  const match = DATE_PARAM_RE.exec(date);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parts = { year, month, day };

  return isValidBusinessDateParts(parts) ? parts : null;
}

export function formatBusinessDateParam(parts: BusinessDateParts): string {
  return [
    parts.year.toString().padStart(4, "0"),
    parts.month.toString().padStart(2, "0"),
    parts.day.toString().padStart(2, "0"),
  ].join("-");
}

export function formatBusinessTime(
  date: Date,
  timezone = DEFAULT_BUSINESS_TIMEZONE,
): string {
  const parts = getZonedDateTimeParts(date, timezone);
  return `${parts.hour.toString().padStart(2, "0")}:${parts.minute
    .toString()
    .padStart(2, "0")}`;
}

export function getBusinessDateParts(
  date: Date,
  timezone = DEFAULT_BUSINESS_TIMEZONE,
): BusinessDateParts {
  const parts = getZonedDateTimeParts(date, timezone);
  return { year: parts.year, month: parts.month, day: parts.day };
}

export function addDaysToBusinessDateParts(
  parts: BusinessDateParts,
  days: number,
): BusinessDateParts {
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day + days);
  date.setUTCHours(0, 0, 0, 0);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function zonedDateTimeToUtc(
  parts: BusinessDateParts,
  timezone: string,
): Date {
  const localMs = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0);
  let candidateMs = localMs;

  for (let i = 0; i < 4; i += 1) {
    const offsetMs = getTimeZoneOffsetMs(new Date(candidateMs), timezone);
    const nextCandidateMs = localMs - offsetMs;
    if (nextCandidateMs === candidateMs) break;
    candidateMs = nextCandidateMs;
  }

  return new Date(candidateMs);
}

function getTimeZoneOffsetMs(date: Date, timezone: string): number {
  const parts = getZonedDateTimeParts(date, timezone);
  const zonedAsUtcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return zonedAsUtcMs - date.getTime();
}

function getZonedDateTimeParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return {
    year: requiredNumberPart(parts, "year"),
    month: requiredNumberPart(parts, "month"),
    day: requiredNumberPart(parts, "day"),
    hour: requiredNumberPart(parts, "hour"),
    minute: requiredNumberPart(parts, "minute"),
    second: requiredNumberPart(parts, "second"),
  };
}

function requiredNumberPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number {
  const part = parts.find((candidate) => candidate.type === type);
  if (!part) throw new Error(`Missing ${type} in formatted date parts`);
  const value = Number(part.value);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid ${type} in formatted date parts`);
  }
  return type === "hour" && value === 24 ? 0 : value;
}

function formatBusinessDayLabel(date: Date, timezone: string): string {
  const label = new Intl.DateTimeFormat("fr-MA", {
    timeZone: timezone,
    calendar: "gregory",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

  return `${label.slice(0, 1).toLocaleUpperCase("fr-MA")}${label.slice(1)}`;
}

function isValidBusinessDateParts(parts: BusinessDateParts): boolean {
  if (
    !Number.isInteger(parts.year) ||
    !Number.isInteger(parts.month) ||
    !Number.isInteger(parts.day)
  ) {
    return false;
  }

  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(0, 0, 0, 0);

  return (
    date.getUTCFullYear() === parts.year &&
    date.getUTCMonth() === parts.month - 1 &&
    date.getUTCDate() === parts.day
  );
}
