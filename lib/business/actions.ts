"use server";

import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { businesses, businessSettings } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/get-business";
import { seedDefaultCatalog } from "@/lib/catalog/default-menus";
import { provisionDefaultEntitlements } from "@/lib/entitlements/defaults";
import { isValidSlug } from "@/lib/utils/slug";

const BUSINESS_TYPES = [
  "boulangerie",
  "restaurant",
  "cafe",
  "hotel",
  "other",
] as const;

const createBusinessSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(80),
  type: z.enum(BUSINESS_TYPES),
  city: z.string().trim().min(2, "Ville requise").max(80),
  address: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  slug: z
    .string()
    .trim()
    .refine(isValidSlug, "Slug invalide (lettres, chiffres, tirets)"),
});

export type CreateBusinessState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

export type CreateBusinessInput = z.input<typeof createBusinessSchema>;

export async function createBusinessAction(
  input: CreateBusinessInput,
): Promise<CreateBusinessState> {
  const session = await requireSession();

  const parsed = createBusinessSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Validation invalide",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }
  const data = parsed.data;

  const existingOwner = await db.query.businesses.findFirst({
    where: eq(businesses.ownerId, session.user.id),
    columns: { id: true },
  });
  if (existingOwner) {
    redirect("/home");
  }

  const slugTaken = await db.query.businesses.findFirst({
    where: eq(businesses.slug, data.slug),
    columns: { id: true },
  });
  if (slugTaken) {
    return {
      status: "error",
      message: "Ce slug est déjà utilisé",
      fieldErrors: { slug: ["Déjà utilisé"] },
    };
  }

  const [inserted] = await db
    .insert(businesses)
    .values({
      ownerId: session.user.id,
      name: data.name,
      slug: data.slug,
      type: data.type,
      city: data.city,
      address: data.address ?? null,
    })
    .returning({ id: businesses.id });

  if (!inserted) {
    return { status: "error", message: "Création impossible" };
  }

  await db.insert(businessSettings).values({
    businessId: inserted.id,
    orderingEnabled: true,
    reservationsEnabled: false,
    dineInEnabled: true,
    takeawayEnabled: true,
    deliveryEnabled: false,
  });

  try {
    await seedDefaultCatalog(inserted.id, data.type);
  } catch (err) {
    console.error("seedDefaultCatalog failed", err);
    Sentry.captureException(err, {
      tags: { area: "onboarding-seed" },
      extra: { businessId: inserted.id, type: data.type },
    });
  }

  await provisionDefaultEntitlements(inserted.id);

  redirect("/home");
}
