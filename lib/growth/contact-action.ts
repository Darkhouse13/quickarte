"use server";

import { headers } from "next/headers";
import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { contactRequests } from "@/lib/db/schema";
import { normalizeLooseFrenchPhone } from "./phone";
import { sendContactAlert } from "./email";

const CONTACT_TO = "bonjour@quickarte.fr";
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

type FieldKey = "nom" | "commerce" | "ville" | "telephone" | "message";

export type ContactValues = Partial<Record<FieldKey, string>>;

export type ContactState = {
  status: "idle" | "success" | "error";
  formError?: string;
  fieldErrors?: Partial<Record<FieldKey, string>>;
  values?: ContactValues;
};

const contactSchema = z.object({
  nom: z.string().trim().min(2, "Merci d'indiquer votre nom.").max(120),
  commerce: z.string().trim().min(2, "Merci d'indiquer votre commerce.").max(160),
  ville: z.string().trim().min(2, "Merci d'indiquer votre ville.").max(120),
  telephone: z.string().trim().min(1, "Merci d'indiquer un téléphone."),
  message: z
    .string()
    .trim()
    .max(2000, "Message trop long.")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

function stringField(data: FormData, key: string): string {
  const v = data.get(key);
  return typeof v === "string" ? v : "";
}

function readClientIp(h: Headers): string | null {
  const fwd = h.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip") ?? h.get("cf-connecting-ip") ?? null;
}

export async function submitContactRequest(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const raw = {
    nom: stringField(formData, "nom"),
    commerce: stringField(formData, "commerce"),
    ville: stringField(formData, "ville"),
    telephone: stringField(formData, "telephone"),
    message: stringField(formData, "message"),
  };
  const values: ContactValues = raw;

  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const fieldErrors: Partial<Record<FieldKey, string>> = {};
    (Object.keys(flat) as FieldKey[]).forEach((k) => {
      const msg = flat[k]?.[0];
      if (msg) fieldErrors[k] = msg;
    });
    return { status: "error", fieldErrors, values };
  }

  const normalized = normalizeLooseFrenchPhone(parsed.data.telephone);
  if (!normalized) {
    return {
      status: "error",
      fieldErrors: {
        telephone:
          "Numéro invalide. Utilisez un numéro français (01, 06, 07…) ou +33.",
      },
      values,
    };
  }

  const hdrs = await headers();
  const ip = readClientIp(hdrs);
  const userAgent = hdrs.get("user-agent");

  if (ip) {
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contactRequests)
      .where(
        and(eq(contactRequests.ip, ip), gt(contactRequests.createdAt, windowStart)),
      );
    const count = rows[0]?.count ?? 0;
    if (count >= RATE_LIMIT_MAX) {
      return {
        status: "error",
        formError:
          "Trop de demandes depuis ce réseau. Réessayez dans une heure ou écrivez-nous à bonjour@quickarte.fr.",
        values,
      };
    }
  }

  let emailSent = false;
  try {
    emailSent = await sendContactAlert({
      to: CONTACT_TO,
      nom: parsed.data.nom,
      commerce: parsed.data.commerce,
      ville: parsed.data.ville,
      telephone: normalized,
      message: parsed.data.message,
    });
  } catch (err) {
    console.error("[contact] email send failed", err);
  }

  await db.insert(contactRequests).values({
    nom: parsed.data.nom,
    commerce: parsed.data.commerce,
    ville: parsed.data.ville,
    telephone: normalized,
    message: parsed.data.message,
    ip,
    userAgent,
    emailSent,
  });

  return { status: "success" };
}
