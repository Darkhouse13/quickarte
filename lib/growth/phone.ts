// Loose French phone normalizer for marketing contact form.
// Accepts +33, 0033, 0 prefix, with spaces/dots/dashes/parens.
// Returns E.164 (+33XXXXXXXXX, 9 digits after country code) or null.
// Distinct from lib/utils/phone.ts which is mobile-only (06/07) for loyalty.
export function normalizeLooseFrenchPhone(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const stripped = raw.replace(/[\s.\-()_]/g, "");
  if (!stripped) return null;

  let e164: string | null = null;
  if (stripped.startsWith("+33")) e164 = stripped;
  else if (stripped.startsWith("0033")) e164 = "+" + stripped.slice(2);
  else if (/^33\d{9}$/.test(stripped)) e164 = "+" + stripped;
  else if (stripped.startsWith("0") && /^0\d{9}$/.test(stripped))
    e164 = "+33" + stripped.slice(1);
  else return null;

  return /^\+33\d{9}$/.test(e164) ? e164 : null;
}
