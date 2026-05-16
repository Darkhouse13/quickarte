"use server";

import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { businesses, businessSettings, staffMembers } from "@/lib/db/schema";
import { requireBusiness, requireSession } from "@/lib/auth/get-business";
import { assertRole } from "@/lib/identity/permissions";
import { seedDefaultCatalog } from "@/lib/catalog/default-menus";
import { provisionDefaultEntitlements } from "@/lib/entitlements/defaults";
import { isValidSlug } from "@/lib/utils/slug";
import { normalizeMoroccanPhone } from "@/lib/business/phone";

const BUSINESS_TYPES = [
  "restaurant",
  "cafe",
  "autre",
] as const;

const createBusinessSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(80),
  type: z.enum(BUSINESS_TYPES),
  googlePlaceId: z.string().trim().optional().nullable(),
  formattedAddress: z.string().trim().min(1, "Adresse requise").max(300),
  city: z.string().trim().max(80).optional().nullable(),
  address: z.string().trim().max(220).optional().nullable(),
  lat: z.number().finite().min(-90).max(90).optional().nullable(),
  lng: z.number().finite().min(-180).max(180).optional().nullable(),
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
      city: data.city || null,
      address: data.address || data.formattedAddress,
      googlePlaceId: data.googlePlaceId || null,
      formattedAddress: data.formattedAddress,
      lat: data.lat == null ? null : data.lat.toString(),
      lng: data.lng == null ? null : data.lng.toString(),
    })
    .returning({ id: businesses.id });

  if (!inserted) {
    return { status: "error", message: "Création impossible" };
  }

  await db.insert(businessSettings).values({
    businessId: inserted.id,
    menuQrEnabled: true,
    orderingEnabled: true,
    loyaltyEnabled: true,
    analyticsEnabled: true,
    reservationsEnabled: false,
    dineInEnabled: true,
    takeawayEnabled: true,
    deliveryEnabled: false,
    tableQrCount: 0,
    posCoexistenceEnabled: false,
  });

  await db.insert(staffMembers).values({
    businessId: inserted.id,
    userId: session.user.id,
    email: session.user.email,
    displayName: session.user.name || session.user.email,
    role: "owner",
    acceptedAt: new Date(),
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
  "restaurant",
  "cafe",
  "autre",
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
  const { session, business } = await requireBusiness();
  await assertRole(session.user.id, business.id, ["owner", "manager"]);

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

  await db
    .update(businesses)
    .set({ name: data.name, type: data.type, updatedAt: new Date() })
    .where(eq(businesses.id, business.id));

  revalidatePath("/fr/settings");
  revalidatePath("/fr/home");

  return { ok: true };
}

const updateBusinessAddressSchema = z.object({
  formattedAddress: z.string().trim().min(1, "Adresse requise").max(300),
  city: z.string().trim().max(80).optional().nullable(),
  address: z.string().trim().max(220).optional().nullable(),
  googlePlaceId: z.string().trim().optional().nullable(),
  lat: z.number().finite().min(-90).max(90).optional().nullable(),
  lng: z.number().finite().min(-180).max(180).optional().nullable(),
});

export type UpdateBusinessAddressInput = z.input<
  typeof updateBusinessAddressSchema
>;

export async function updateBusinessAddress(
  input: UpdateBusinessAddressInput,
): Promise<UpdateBusinessProfileResult> {
  const { session, business } = await requireBusiness();
  await assertRole(session.user.id, business.id, ["owner", "manager"]);
  const parsed = updateBusinessAddressSchema.safeParse(input);
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

  await db
    .update(businesses)
    .set({
      formattedAddress: data.formattedAddress,
      city: data.city || null,
      address: data.address || data.formattedAddress,
      googlePlaceId: data.googlePlaceId || null,
      lat: data.lat == null ? null : data.lat.toString(),
      lng: data.lng == null ? null : data.lng.toString(),
      updatedAt: new Date(),
    })
    .where(eq(businesses.id, business.id));

  revalidatePath("/fr/settings");
  revalidatePath("/fr/home");
  revalidatePath(`/fr/${business.slug}`);
  return { ok: true };
}

const updateOperationalSettingsSchema = z
  .object({
    menuQrEnabled: z.boolean(),
    orderingEnabled: z.boolean(),
    loyaltyEnabled: z.boolean(),
    analyticsEnabled: z.boolean(),
    dineInEnabled: z.boolean(),
    takeawayEnabled: z.boolean(),
  })
  .refine((data) => !data.orderingEnabled || data.dineInEnabled || data.takeawayEnabled, {
    message: "Activez au moins un mode de commande",
    path: ["orderingEnabled"],
  });

export type UpdateOperationalSettingsInput = z.input<
  typeof updateOperationalSettingsSchema
>;

export async function updateOperationalSettings(
  input: UpdateOperationalSettingsInput,
): Promise<UpdateBusinessProfileResult> {
  const { session, business } = await requireBusiness();
  await assertRole(session.user.id, business.id, ["owner", "manager"]);
  const parsed = updateOperationalSettingsSchema.safeParse(input);
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

  await db
    .update(businessSettings)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(businessSettings.businessId, business.id));

  revalidatePath("/fr/settings");
  revalidatePath("/fr/home");
  revalidatePath(`/fr/${business.slug}`);
  return { ok: true };
}

const updateTableQrCountSchema = z.object({
  tableQrCount: z.coerce
    .number({ invalid_type_error: "Nombre de tables invalide" })
    .int("Nombre de tables invalide")
    .min(0, "Nombre de tables invalide")
    .max(80, "Maximum 80 tables"),
});

export async function updateTableQrCount(input: {
  tableQrCount: number;
}): Promise<UpdateBusinessProfileResult> {
  const { session, business } = await requireBusiness();
  await assertRole(session.user.id, business.id, ["owner", "manager"]);
  const parsed = updateTableQrCountSchema.safeParse(input);
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

  await db
    .update(businessSettings)
    .set({
      tableQrCount: parsed.data.tableQrCount,
      updatedAt: new Date(),
    })
    .where(eq(businessSettings.businessId, business.id));

  revalidatePath("/fr/settings");
  return { ok: true };
}

const updateCustomerFacingSettingsSchema = z.object({
  whatsappNumber: z.string().trim().max(80).optional().nullable(),
  customerPostOrderMessage: z
    .string()
    .trim()
    .max(280, "Maximum 280 caracteres")
    .optional()
    .nullable(),
});

export type UpdateCustomerFacingSettingsInput = z.input<
  typeof updateCustomerFacingSettingsSchema
>;

export async function updateCustomerFacingSettings(
  input: UpdateCustomerFacingSettingsInput,
): Promise<UpdateBusinessProfileResult> {
  const { session, business } = await requireBusiness();
  await assertRole(session.user.id, business.id, ["owner", "manager"]);
  const parsed = updateCustomerFacingSettingsSchema.safeParse(input);
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

  const phone = normalizeMoroccanPhone(parsed.data.whatsappNumber ?? "");
  const postOrderMessage = parsed.data.customerPostOrderMessage?.trim() ?? "";

  await db
    .update(businessSettings)
    .set({
      whatsappNumber: phone.value.length > 0 ? phone.value : null,
      customerPostOrderMessage:
        postOrderMessage.length > 0 ? postOrderMessage : null,
      updatedAt: new Date(),
    })
    .where(eq(businessSettings.businessId, business.id));

  revalidatePath("/fr/settings");
  revalidatePath(`/fr/${business.slug}`);
  return { ok: true };
}

const updatePosCoexistenceSettingSchema = z.object({
  enabled: z.boolean(),
});

export async function updatePosCoexistenceSetting(input: {
  enabled: boolean;
}): Promise<UpdateBusinessProfileResult> {
  const { session, business } = await requireBusiness();
  await assertRole(session.user.id, business.id, ["owner", "manager"]);
  const parsed = updatePosCoexistenceSettingSchema.safeParse(input);
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

  await db
    .update(businessSettings)
    .set({
      posCoexistenceEnabled: parsed.data.enabled,
      updatedAt: new Date(),
    })
    .where(eq(businessSettings.businessId, business.id));

  revalidatePath("/fr/settings");
  revalidatePath("/fr/orders");
  revalidatePath("/fr/cloture");
  return { ok: true };
}
