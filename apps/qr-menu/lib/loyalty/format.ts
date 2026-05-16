/**
 * Pure helpers shared between the merchant Mes habitués surfaces. Kept pure
 * (no React, no DB) so they're testable with node:test.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

/**
 * Coarse French relative-time for the customers/transactions tables.
 * "il y a 3 j", "il y a 2 sem", "il y a 1 mois", "il y a 1 an".
 * Anything under a day is treated as "aujourd'hui" — those rows are noise.
 */
export function formatRelativeFr(date: Date, now: Date = new Date()): string {
  const diff = now.getTime() - date.getTime();
  if (diff < DAY_MS) return "aujourd'hui";
  if (diff < WEEK_MS) {
    const days = Math.floor(diff / DAY_MS);
    return `il y a ${days} j`;
  }
  if (diff < MONTH_MS) {
    const weeks = Math.floor(diff / WEEK_MS);
    return `il y a ${weeks} sem`;
  }
  if (diff < YEAR_MS) {
    const months = Math.floor(diff / MONTH_MS);
    return `il y a ${months} mois`;
  }
  const years = Math.floor(diff / YEAR_MS);
  return `il y a ${years} an${years > 1 ? "s" : ""}`;
}

/**
 * "+50" / "−30" with the typographic minus (U+2212), keeping the sign visible
 * even at small font sizes. Zero is rendered as "0".
 */
export function formatSignedAmount(amount: number): string {
  if (amount === 0) return "0";
  if (amount > 0) return `+${amount}`;
  return `−${Math.abs(amount)}`;
}

/**
 * The search input on the Clients tab calls getCreditCustomers with the
 * trimmed value. This helper reproduces the server-side behaviour locally so
 * the table can render an empty state synchronously while a search is in
 * flight, and so tests can assert the matching contract.
 */
export function filterCustomersByPhone<T extends { customerPhoneNormalized: string }>(
  customers: readonly T[],
  rawSearch: string,
): T[] {
  const search = rawSearch.trim();
  if (search.length === 0) return [...customers];
  const needle = search.toLowerCase();
  return customers.filter((c) =>
    c.customerPhoneNormalized.toLowerCase().includes(needle),
  );
}
