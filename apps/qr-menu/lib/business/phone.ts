const MOROCCAN_MOBILE_E164 = /^\+212[67]\d{8}$/;

export type MoroccanPhoneNormalization = {
  value: string;
  normalized: boolean;
};

export function normalizeMoroccanPhone(raw: string): MoroccanPhoneNormalization {
  const original = raw.trim();
  if (!original) return { value: "", normalized: true };

  const stripped = original.replace(/[\s.\-()_]/g, "");
  let e164: string | null = null;

  if (stripped.startsWith("+")) {
    e164 = stripped;
  } else if (stripped.startsWith("00")) {
    e164 = `+${stripped.slice(2)}`;
  } else if (stripped.startsWith("0")) {
    e164 = `+212${stripped.slice(1)}`;
  } else if (/^212[67]\d{8}$/.test(stripped)) {
    e164 = `+${stripped}`;
  } else if (/^[67]\d{8}$/.test(stripped)) {
    e164 = `+212${stripped}`;
  }

  if (e164 && MOROCCAN_MOBILE_E164.test(e164)) {
    return { value: e164, normalized: true };
  }
  return { value: original, normalized: false };
}

export function isNormalizedMoroccanPhone(value: string | null): boolean {
  if (!value || value.trim().length === 0) return true;
  return MOROCCAN_MOBILE_E164.test(value.trim());
}
