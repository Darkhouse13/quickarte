import { z } from "zod";

const MOROCCAN_MOBILE_E164 = /^\+212[67]\d{8}$/;

const INVALID_PHONE_MESSAGE =
  "Numéro de téléphone invalide. Utilisez un mobile marocain (06… ou 07…).";

export class InvalidPhoneError extends Error {
  constructor(message = INVALID_PHONE_MESSAGE) {
    super(message);
    this.name = "InvalidPhoneError";
  }
}

export function normalizeMoroccanPhone(raw: string): string {
  if (typeof raw !== "string") throw new InvalidPhoneError();
  const stripped = raw.replace(/[\s.\-()_]/g, "");
  if (stripped.length === 0) throw new InvalidPhoneError();

  let e164: string;
  if (stripped.startsWith("+")) {
    e164 = stripped;
  } else if (stripped.startsWith("00")) {
    e164 = "+" + stripped.slice(2);
  } else if (stripped.startsWith("0")) {
    e164 = "+212" + stripped.slice(1);
  } else if (/^212[67]\d{8}$/.test(stripped)) {
    e164 = "+" + stripped;
  } else if (/^[67]\d{8}$/.test(stripped)) {
    e164 = "+212" + stripped;
  } else {
    throw new InvalidPhoneError();
  }

  if (!MOROCCAN_MOBILE_E164.test(e164)) throw new InvalidPhoneError();
  return e164;
}

export function formatPhoneForDisplay(e164: string): string {
  if (!MOROCCAN_MOBILE_E164.test(e164)) return e164;
  const local = "0" + e164.slice(4);
  return local.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

export const moroccanPhoneSchema = z
  .string()
  .trim()
  .transform((raw, ctx) => {
    try {
      return normalizeMoroccanPhone(raw);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          err instanceof InvalidPhoneError ? err.message : INVALID_PHONE_MESSAGE,
      });
      return z.NEVER;
    }
  });
