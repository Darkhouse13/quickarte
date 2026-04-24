"use server";

import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { businesses, businessSettings } from "@/lib/db/schema";
import { requireBusiness, requireSession } from "@/lib/auth/get-business";
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
  googlePlaceId: z.string().trim().min(1, "Adresse requise"),
  formattedAddress: z.string().trim().min(1, "Adresse requise").max(300),
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
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
      googlePlaceId: data.googlePlaceId,
      formattedAddress: data.formattedAddress,
      lat: data.lat.toString(),
      lng: data.lng.toString(),
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

const ALL_BUSINESS_TYPES = [
  "boulangerie",
  "cafe",
  "restaurant",
  "hotel",
  "retail",
  "other",
] as const;

const SELECTABLE_BUSINESS_TYPES = [
  "boulangerie",
  "cafe",
  "restaurant",
  "other",
] as const;

const updateBusinessProfileSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(80),
  type: z.enum(ALL_BUSINESS_TYPES),
});

export type UpdateBusinessProfileInput = z.input<
  typeof updateBusinessProfileSchema
>;

export type UpdateBusinessProfileResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function updateBusinessProfile(
  input: UpdateBusinessProfileInput,
): Promise<UpdateBusinessProfileResult> {
  const { business } = await requireBusiness();

  const parsed = updateBusinessProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation invalide",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }
  const data = parsed.data;

  const isSelectable = (
    SELECTABLE_BUSINESS_TYPES as readonly string[]
  ).includes(data.type);
  if (!isSelectable && data.type !== business.type) {
    return {
      ok: false,
      error: "Type non autorisé",
      fieldErrors: { type: ["Type non autorisé"] },
    };
  }

  await db
    .update(businesses)
    .set({ name: data.name, type: data.type, updatedAt: new Date() })
    .where(eq(businesses.id, business.id));

  revalidatePath("/fr/settings");
  revalidatePath("/fr/home");

  return { ok: true };
}
