// Loose Moroccan phone normalizer for marketing contact form.
// Accepts +212, 00212, 0 prefix, with spaces/dots/dashes/parens.
// Returns E.164 (+212XXXXXXXXX, 9 digits after country code) or null.
// Distinct from lib/utils/phone.ts which is mobile-only (06/07) for loyalty.
export function normalizeLooseMoroccanPhone(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const stripped = raw.replace(/[\s.\-()_]/g, "");
  if (!stripped) return null;

  let e164: string | null = null;
  if (stripped.startsWith("+212")) e164 = stripped;
  else if (stripped.startsWith("00212")) e164 = "+" + stripped.slice(2);
  else if (/^212[567]\d{8}$/.test(stripped)) e164 = "+" + stripped;
  else if (stripped.startsWith("0") && /^0[567]\d{8}$/.test(stripped))
    e164 = "+212" + stripped.slice(1);
  else if (/^[567]\d{8}$/.test(stripped)) e164 = "+212" + stripped;
  else return null;

  return /^\+212[567]\d{8}$/.test(e164) ? e164 : null;
}
