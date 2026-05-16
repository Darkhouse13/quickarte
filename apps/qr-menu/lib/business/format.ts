/**
 * French-locale formatting for money and deltas on the close-of-day surface.
 *
 * - Thousands are grouped with a plain space, decimals use a comma.
 * - Whole amounts drop the decimals; fractional amounts always show two.
 * - Deltas use the typographic minus glyph "−" (U+2212), never a hyphen.
 */

const MINUS = "−";

/**
 * Format a MAD amount. The "MAD" suffix is added by the consumer, not here.
 *
 *   1240    -> "1 240"
 *   1240.5  -> "1 240,50"
 *   1240.55 -> "1 240,55"
 *   -90.4   -> "−90,40"
 */
export function formatMadAmount(value: number): string {
  if (!Number.isFinite(value)) return "0";

  const negative = value < 0;
  const abs = Math.abs(value);
  const whole = Number.isInteger(abs);
  const fixed = whole ? abs.toFixed(0) : abs.toFixed(2);
  const [intPartRaw, decPart] = fixed.split(".");
  const grouped = (intPartRaw ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const body = decPart ? `${grouped},${decPart}` : grouped;

  return negative ? `${MINUS}${body}` : body;
}

/**
 * Percentage delta of `current` against `previous`. Returns null when there is
 * no baseline (`previous === 0`). An exact zero diff renders as "+0 %".
 *
 *   formatPercentDelta(118, 100) -> "+18 %"
 *   formatPercentDelta(93, 100)  -> "−7 %"
 *   formatPercentDelta(5, 0)     -> null
 */
export function formatPercentDelta(
  current: number,
  previous: number,
): string | null {
  if (previous === 0) return null;

  const rounded = Math.round(((current - previous) / previous) * 100);
  const sign = rounded < 0 ? MINUS : "+";
  return `${sign}${Math.abs(rounded)} %`;
}

/**
 * Count delta of `current` against `previous`. Returns null when there is no
 * baseline (`previous === 0`), mirroring formatPercentDelta. The noun is
 * singular only at a delta of exactly +/-1.
 *
 *   formatCountDelta(14, 2)  -> "+12 commandes"
 *   formatCountDelta(1, 2)   -> "−1 commande"
 *   formatCountDelta(7, 0)   -> null
 */
export function formatCountDelta(
  current: number,
  previous: number,
): string | null {
  if (previous === 0) return null;

  const diff = current - previous;
  const sign = diff < 0 ? MINUS : "+";
  const magnitude = Math.abs(diff);
  const noun = magnitude === 1 ? "commande" : "commandes";
  return `${sign}${magnitude} ${noun}`;
}
