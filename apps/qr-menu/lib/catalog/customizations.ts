"use server";

import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  optionValues,
  orderItems,
  productOptions,
  products,
  productVariants,
} from "@quickarte/db-schema";
import { requireBusiness } from "@/lib/auth/get-business";
import { assertRole } from "@/lib/identity/permissions";
import {
  optionInputSchema,
  optionValueInputSchema,
  reorderIdsSchema,
  updateOptionInputSchema,
  updateOptionValueInputSchema,
  updateVariantInputSchema,
  variantInputSchema,
  type OptionInput,
  type OptionValueInput,
  type UpdateOptionInput,
  type UpdateOptionValueInput,
  type UpdateVariantInput,
  type VariantInput,
} from "./schemas";
import {
  validateVariantOptionMaxSelectionsOverrides,
  type OverrideValidationOption,
} from "./variant-option-overrides";
import { USED_OPTION_FALLBACK_MESSAGE } from "./customization-messages";

export type CustomizationActionResult =
  | { status: "success" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> };

type OwnedProduct = { id: string };
type OwnedVariant = { id: string; productId: string; isDefault: boolean };
type OwnedOption = {
  id: string;
  productId: string;
  type: "single_select" | "multi_select";
  required: boolean;
  minSelect: number;
  maxSelect: number | null;
};
type OwnedValue = { id: string; optionId: string };

function validationError(message: string): CustomizationActionResult {
  return { status: "error", message };
}

function flattenFieldErrors(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
}): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(error.flatten().fieldErrors)) {
    if (value?.length) out[key] = value;
  }
  return out;
}

function formatPrice(value: number | null | undefined): string | null {
  return value == null ? null : value.toFixed(2);
}

function hasOwn<T extends object>(obj: T, key: keyof T): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function readMaxSelect(input: {
  max_select?: number | null;
  max_selections?: number | null;
}): number | null {
  return input.max_select ?? input.max_selections ?? null;
}

async function requireAuthorizedBusiness() {
  const { session, business } = await requireBusiness();
  await assertRole(session.user.id, business.id, ["owner", "manager"]);
  return { business };
}

async function requireOwnedProduct(productId: string) {
  const { business } = await requireAuthorizedBusiness();
  const product = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.businessId, business.id)),
    columns: { id: true },
  });
  return { business, product: product ?? null };
}

async function requireOwnedProductFromVariant(variantId: string) {
  const { business } = await requireAuthorizedBusiness();
  const variant = await db.query.productVariants.findFirst({
    where: eq(productVariants.id, variantId),
    columns: { id: true, productId: true, isDefault: true },
  });
  if (!variant) return { business, product: null, variant: null };
  const product = await db.query.products.findFirst({
    where: and(
      eq(products.id, variant.productId),
      eq(products.businessId, business.id),
    ),
    columns: { id: true },
  });
  return {
    business,
    product: (product as OwnedProduct | undefined) ?? null,
    variant: variant as OwnedVariant,
  };
}

async function requireOwnedProductFromOption(optionId: string) {
  const { business } = await requireAuthorizedBusiness();
  const option = await db.query.productOptions.findFirst({
    where: eq(productOptions.id, optionId),
    columns: {
      id: true,
      productId: true,
      type: true,
      required: true,
      minSelect: true,
      maxSelect: true,
    },
  });
  if (!option) return { business, product: null, option: null };
  const product = await db.query.products.findFirst({
    where: and(
      eq(products.id, option.productId),
      eq(products.businessId, business.id),
    ),
    columns: { id: true },
  });
  return {
    business,
    product: (product as OwnedProduct | undefined) ?? null,
    option: option as OwnedOption,
  };
}

async function requireOwnedProductFromOptionValue(optionValueId: string) {
  const { business } = await requireAuthorizedBusiness();
  const value = await db.query.optionValues.findFirst({
    where: eq(optionValues.id, optionValueId),
    columns: { id: true, optionId: true },
  });
  if (!value) {
    return { business, product: null, option: null, value: null };
  }
  const option = await db.query.productOptions.findFirst({
    where: eq(productOptions.id, value.optionId),
    columns: { id: true, productId: true },
  });
  if (!option) {
    return { business, product: null, option: null, value: value as OwnedValue };
  }
  const product = await db.query.products.findFirst({
    where: and(
      eq(products.id, option.productId),
      eq(products.businessId, business.id),
    ),
    columns: { id: true },
  });
  return {
    business,
    product: (product as OwnedProduct | undefined) ?? null,
    option,
    value: value as OwnedValue,
  };
}

function revalidateCatalog(productId: string, businessSlug: string) {
  revalidatePath("/catalog");
  revalidatePath(`/catalog/${productId}/edit`);
  revalidatePath(`/${businessSlug}`);
}

function validateFullList(ids: string[]): CustomizationActionResult | null {
  const parsed = reorderIdsSchema.safeParse(ids);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Ordre invalide",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }
  if (new Set(ids).size !== ids.length) {
    return validationError("Ordre invalide");
  }
  return null;
}

async function getProductOptionsForOverrideValidation(
  productId: string,
): Promise<OverrideValidationOption[]> {
  return db.query.productOptions.findMany({
    where: eq(productOptions.productId, productId),
    columns: { id: true, productId: true, type: true },
  });
}

async function jsonReferenceExists(needles: unknown[]): Promise<boolean> {
  const conditions = needles.map(
    (needle) => sql`${orderItems.optionsJson} @> ${JSON.stringify(needle)}::jsonb`,
  );
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orderItems)
    .where(or(...conditions));
  return (row?.count ?? 0) > 0;
}

async function variantIsUsed(variantId: string): Promise<boolean> {
  return jsonReferenceExists([{ variantId }, { variant_id: variantId }]);
}

async function optionIsUsed(optionId: string): Promise<boolean> {
  return jsonReferenceExists([
    { selections: [{ optionId }] },
    { selected_options_summary: [{ option_id: optionId }] },
  ]);
}

async function optionValueIsUsed(valueId: string): Promise<boolean> {
  return jsonReferenceExists([
    { selections: [{ values: [{ valueId }] }] },
    { selected_options_summary: [{ values: [{ value_id: valueId }] }] },
  ]);
}

async function ensureDefaultVariant(productId: string): Promise<void> {
  const currentDefault = await db.query.productVariants.findFirst({
    where: and(
      eq(productVariants.productId, productId),
      eq(productVariants.isDefault, true),
      eq(productVariants.available, true),
    ),
    columns: { id: true },
  });
  if (currentDefault) return;

  const firstAvailable = await db.query.productVariants.findFirst({
    where: and(
      eq(productVariants.productId, productId),
      eq(productVariants.available, true),
    ),
    columns: { id: true },
    orderBy: [asc(productVariants.position), asc(productVariants.createdAt)],
  });
  if (!firstAvailable) return;
  await setDefaultVariant(productId, firstAvailable.id);
}

export async function createProductVariant(
  productId: string,
  input: VariantInput,
): Promise<CustomizationActionResult> {
  const parsed = variantInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Validation invalide",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const { business, product } = await requireOwnedProduct(productId);
  if (!product) return validationError("Article introuvable");

  const last = await db.query.productVariants.findFirst({
    where: eq(productVariants.productId, productId),
    columns: { position: true },
    orderBy: [desc(productVariants.position)],
  });
  const existingDefault = await db.query.productVariants.findFirst({
    where: and(
      eq(productVariants.productId, productId),
      eq(productVariants.isDefault, true),
    ),
    columns: { id: true },
  });
  const position = parsed.data.position ?? (last?.position ?? -1) + 1;
  const shouldBeDefault = parsed.data.is_default === true || !existingDefault;

  const overrides = parsed.data.option_max_selections_overrides ?? {};
  const overrideValidation = validateVariantOptionMaxSelectionsOverrides(
    overrides,
    await getProductOptionsForOverrideValidation(productId),
    productId,
  );
  if (overrideValidation.status === "error") return overrideValidation;

  await db.transaction(async (tx) => {
    if (shouldBeDefault) {
      await tx
        .update(productVariants)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(productVariants.productId, productId));
    }
    await tx.insert(productVariants).values({
      productId,
      name: parsed.data.name,
      priceOverride: formatPrice(parsed.data.price_override),
      position,
      isDefault: shouldBeDefault,
      available: parsed.data.available ?? true,
      optionMaxSelectionsOverrides: overrideValidation.overrides,
    });
  });

  revalidateCatalog(productId, business.slug);
  return { status: "success" };
}

export async function updateProductVariant(
  variantId: string,
  input: UpdateVariantInput,
): Promise<CustomizationActionResult> {
  const parsed = updateVariantInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Validation invalide",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const { business, product, variant } =
    await requireOwnedProductFromVariant(variantId);
  if (!product || !variant) return validationError("Variante introuvable");

  if (parsed.data.is_default === false && variant.isDefault) {
    const otherDefault = await db.query.productVariants.findFirst({
      where: and(
        eq(productVariants.productId, variant.productId),
        eq(productVariants.isDefault, true),
      ),
      columns: { id: true },
    });
    if (!otherDefault || otherDefault.id === variant.id) {
      return validationError("Une variante par defaut est requise");
    }
  }

  const overrideValidation = hasOwn(
    parsed.data,
    "option_max_selections_overrides",
  )
    ? validateVariantOptionMaxSelectionsOverrides(
        parsed.data.option_max_selections_overrides ?? {},
        await getProductOptionsForOverrideValidation(variant.productId),
        variant.productId,
      )
    : null;
  if (overrideValidation?.status === "error") return overrideValidation;

  await db.transaction(async (tx) => {
    if (parsed.data.is_default === true) {
      await tx
        .update(productVariants)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(productVariants.productId, variant.productId));
    }
    await tx
      .update(productVariants)
      .set({
        ...(hasOwn(parsed.data, "name") ? { name: parsed.data.name } : {}),
        ...(hasOwn(parsed.data, "price_override")
          ? { priceOverride: formatPrice(parsed.data.price_override) }
          : {}),
        ...(hasOwn(parsed.data, "position")
          ? { position: parsed.data.position }
          : {}),
        ...(hasOwn(parsed.data, "is_default")
          ? { isDefault: parsed.data.is_default }
          : {}),
        ...(hasOwn(parsed.data, "available")
          ? { available: parsed.data.available }
          : {}),
        ...(overrideValidation
          ? { optionMaxSelectionsOverrides: overrideValidation.overrides }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(productVariants.id, variantId));
  });

  await ensureDefaultVariant(variant.productId);
  revalidateCatalog(product.id, business.slug);
  return { status: "success" };
}

export async function deleteProductVariant(
  variantId: string,
): Promise<CustomizationActionResult> {
  const { business, product, variant } =
    await requireOwnedProductFromVariant(variantId);
  if (!product || !variant) return validationError("Variante introuvable");

  if (await variantIsUsed(variantId)) {
    await db
      .update(productVariants)
      .set({ available: false, updatedAt: new Date() })
      .where(eq(productVariants.id, variantId));
    await ensureDefaultVariant(variant.productId);
    revalidateCatalog(product.id, business.slug);
    return {
      status: "error",
      message:
        "Cette variante est utilisee dans des commandes passees. Elle a ete desactivee au lieu d'etre supprimee.",
    };
  }

  await db.delete(productVariants).where(eq(productVariants.id, variantId));
  await ensureDefaultVariant(variant.productId);
  revalidateCatalog(product.id, business.slug);
  return { status: "success" };
}

export async function reorderProductVariants(
  productId: string,
  orderedIds: string[],
): Promise<CustomizationActionResult> {
  const invalid = validateFullList(orderedIds);
  if (invalid) return invalid;

  const { business, product } = await requireOwnedProduct(productId);
  if (!product) return validationError("Article introuvable");

  const existing = await db.query.productVariants.findMany({
    where: eq(productVariants.productId, productId),
    columns: { id: true },
    orderBy: [asc(productVariants.position)],
  });
  if (
    existing.length !== orderedIds.length ||
    existing.some((row) => !orderedIds.includes(row.id))
  ) {
    return validationError("Ordre incomplet");
  }

  await db.transaction(async (tx) => {
    for (const [position, id] of orderedIds.entries()) {
      await tx
        .update(productVariants)
        .set({ position, updatedAt: new Date() })
        .where(eq(productVariants.id, id));
    }
  });

  revalidateCatalog(productId, business.slug);
  return { status: "success" };
}

export async function setDefaultVariant(
  productId: string,
  variantId: string,
): Promise<CustomizationActionResult> {
  const { business, product } = await requireOwnedProduct(productId);
  if (!product) return validationError("Article introuvable");

  const variant = await db.query.productVariants.findFirst({
    where: and(
      eq(productVariants.id, variantId),
      eq(productVariants.productId, productId),
      eq(productVariants.available, true),
    ),
    columns: { id: true },
  });
  if (!variant) return validationError("Variante introuvable");

  await db.transaction(async (tx) => {
    await tx
      .update(productVariants)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(productVariants.productId, productId));
    await tx
      .update(productVariants)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(productVariants.id, variantId));
  });

  revalidateCatalog(productId, business.slug);
  return { status: "success" };
}

export async function setVariantAvailability(
  variantId: string,
  available: boolean,
): Promise<CustomizationActionResult> {
  const { business, product, variant } =
    await requireOwnedProductFromVariant(variantId);
  if (!product || !variant) return validationError("Variante introuvable");
  await db
    .update(productVariants)
    .set({ available, updatedAt: new Date() })
    .where(eq(productVariants.id, variantId));
  await ensureDefaultVariant(variant.productId);
  revalidateCatalog(product.id, business.slug);
  return { status: "success" };
}

export async function createProductOption(
  productId: string,
  input: OptionInput,
): Promise<CustomizationActionResult> {
  const parsed = optionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Validation invalide",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const { business, product } = await requireOwnedProduct(productId);
  if (!product) return validationError("Article introuvable");

  const last = await db.query.productOptions.findFirst({
    where: eq(productOptions.productId, productId),
    columns: { position: true },
    orderBy: [desc(productOptions.position)],
  });
  const position = parsed.data.position ?? (last?.position ?? -1) + 1;

  await db.insert(productOptions).values({
    productId,
    name: parsed.data.name,
    type: parsed.data.type,
    required: parsed.data.required,
    minSelect: parsed.data.type === "single_select" ? 0 : parsed.data.min_select ?? 0,
    maxSelect: parsed.data.type === "single_select" ? null : readMaxSelect(parsed.data),
    position,
  });

  revalidateCatalog(productId, business.slug);
  return { status: "success" };
}

export async function updateProductOption(
  optionId: string,
  input: UpdateOptionInput,
): Promise<CustomizationActionResult> {
  const parsed = updateOptionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Validation invalide",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const { business, product, option } =
    await requireOwnedProductFromOption(optionId);
  if (!product || !option) return validationError("Option introuvable");

  const nextType = parsed.data.type ?? option.type;
  const nextRequired = parsed.data.required ?? option.required;
  const nextMinSelect =
    nextType === "single_select"
      ? 0
      : parsed.data.min_select ?? option.minSelect;
  const nextMaxSelect =
    nextType === "single_select"
      ? null
      : hasOwn(parsed.data, "max_select") || hasOwn(parsed.data, "max_selections")
        ? readMaxSelect(parsed.data)
        : option.maxSelect;

  if (nextType === "single_select") {
    if (hasOwn(parsed.data, "min_select") || readMaxSelect(parsed.data) != null) {
      return {
        status: "error",
        message: "Validation invalide",
        fieldErrors: {
          min_select: ["Minimum reserve aux choix multiples"],
          max_select: ["Maximum reserve aux choix multiples"],
        },
      };
    }
  } else {
    if (nextMaxSelect != null && nextMaxSelect < nextMinSelect) {
      return {
        status: "error",
        message: "Validation invalide",
        fieldErrors: { max_select: ["Maximum inferieur au minimum"] },
      };
    }
    if (nextMinSelect > 0 && nextRequired === false) {
      return {
        status: "error",
        message: "Validation invalide",
        fieldErrors: {
          required: ["Une option avec minimum doit etre obligatoire"],
        },
      };
    }
  }

  await db
    .update(productOptions)
    .set({
      ...(hasOwn(parsed.data, "name") ? { name: parsed.data.name } : {}),
      ...(hasOwn(parsed.data, "type") ? { type: parsed.data.type } : {}),
      ...(hasOwn(parsed.data, "required")
        ? { required: parsed.data.required }
        : {}),
      minSelect: nextMinSelect,
      maxSelect: nextMaxSelect,
      ...(hasOwn(parsed.data, "position")
        ? { position: parsed.data.position }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(productOptions.id, optionId));

  revalidateCatalog(product.id, business.slug);
  return { status: "success" };
}

export async function deleteProductOption(
  optionId: string,
): Promise<CustomizationActionResult> {
  const { business, product, option } =
    await requireOwnedProductFromOption(optionId);
  if (!product || !option) return validationError("Option introuvable");

  if (await optionIsUsed(optionId)) {
    await db
      .update(productOptions)
      .set({
        available: false,
        required: false,
        minSelect: 0,
        maxSelect: null,
        updatedAt: new Date(),
      })
      .where(eq(productOptions.id, optionId));
    revalidateCatalog(product.id, business.slug);
    return { status: "error", message: USED_OPTION_FALLBACK_MESSAGE };
  }

  await db.delete(productOptions).where(eq(productOptions.id, optionId));
  revalidateCatalog(product.id, business.slug);
  return { status: "success" };
}

export async function reorderProductOptions(
  productId: string,
  orderedIds: string[],
): Promise<CustomizationActionResult> {
  const invalid = validateFullList(orderedIds);
  if (invalid) return invalid;

  const { business, product } = await requireOwnedProduct(productId);
  if (!product) return validationError("Article introuvable");

  const existing = await db.query.productOptions.findMany({
    where: eq(productOptions.productId, productId),
    columns: { id: true },
    orderBy: [asc(productOptions.position)],
  });
  if (
    existing.length !== orderedIds.length ||
    existing.some((row) => !orderedIds.includes(row.id))
  ) {
    return validationError("Ordre incomplet");
  }

  await db.transaction(async (tx) => {
    for (const [position, id] of orderedIds.entries()) {
      await tx
        .update(productOptions)
        .set({ position, updatedAt: new Date() })
        .where(eq(productOptions.id, id));
    }
  });

  revalidateCatalog(productId, business.slug);
  return { status: "success" };
}

export async function createOptionValue(
  optionId: string,
  input: OptionValueInput,
): Promise<CustomizationActionResult> {
  const parsed = optionValueInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Validation invalide",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const { business, product, option } =
    await requireOwnedProductFromOption(optionId);
  if (!product || !option) return validationError("Option introuvable");

  const last = await db.query.optionValues.findFirst({
    where: eq(optionValues.optionId, optionId),
    columns: { position: true },
    orderBy: [desc(optionValues.position)],
  });
  const position = parsed.data.position ?? (last?.position ?? -1) + 1;

  await db.insert(optionValues).values({
    optionId,
    name: parsed.data.name,
    priceAddition: parsed.data.price_addition.toFixed(2),
    position,
    available: parsed.data.available ?? true,
  });

  revalidateCatalog(product.id, business.slug);
  return { status: "success" };
}

export async function updateOptionValue(
  optionValueId: string,
  input: UpdateOptionValueInput,
): Promise<CustomizationActionResult> {
  const parsed = updateOptionValueInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Validation invalide",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const { business, product, value } =
    await requireOwnedProductFromOptionValue(optionValueId);
  if (!product || !value) return validationError("Valeur introuvable");

  await db
    .update(optionValues)
    .set({
      ...(hasOwn(parsed.data, "name") ? { name: parsed.data.name } : {}),
      ...(hasOwn(parsed.data, "price_addition")
        ? { priceAddition: parsed.data.price_addition?.toFixed(2) }
        : {}),
      ...(hasOwn(parsed.data, "available")
        ? { available: parsed.data.available }
        : {}),
      ...(hasOwn(parsed.data, "position")
        ? { position: parsed.data.position }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(optionValues.id, optionValueId));

  revalidateCatalog(product.id, business.slug);
  return { status: "success" };
}

export async function deleteOptionValue(
  optionValueId: string,
): Promise<CustomizationActionResult> {
  const { business, product, value } =
    await requireOwnedProductFromOptionValue(optionValueId);
  if (!product || !value) return validationError("Valeur introuvable");

  if (await optionValueIsUsed(optionValueId)) {
    await db
      .update(optionValues)
      .set({ available: false, updatedAt: new Date() })
      .where(eq(optionValues.id, optionValueId));
    revalidateCatalog(product.id, business.slug);
    return {
      status: "error",
      message:
        "Cette valeur est utilisee dans des commandes passees. Elle a ete desactivee au lieu d'etre supprimee.",
    };
  }

  await db.delete(optionValues).where(eq(optionValues.id, optionValueId));
  revalidateCatalog(product.id, business.slug);
  return { status: "success" };
}

export async function reorderOptionValues(
  optionId: string,
  orderedIds: string[],
): Promise<CustomizationActionResult> {
  const invalid = validateFullList(orderedIds);
  if (invalid) return invalid;

  const { business, product, option } =
    await requireOwnedProductFromOption(optionId);
  if (!product || !option) return validationError("Option introuvable");

  const existing = await db.query.optionValues.findMany({
    where: eq(optionValues.optionId, optionId),
    columns: { id: true },
    orderBy: [asc(optionValues.position)],
  });
  if (
    existing.length !== orderedIds.length ||
    existing.some((row) => !orderedIds.includes(row.id))
  ) {
    return validationError("Ordre incomplet");
  }

  await db.transaction(async (tx) => {
    for (const [position, id] of orderedIds.entries()) {
      await tx
        .update(optionValues)
        .set({ position, updatedAt: new Date() })
        .where(eq(optionValues.id, id));
    }
  });

  revalidateCatalog(product.id, business.slug);
  return { status: "success" };
}

export async function setOptionValueAvailability(
  valueId: string,
  available: boolean,
): Promise<CustomizationActionResult> {
  const { business, product, value } =
    await requireOwnedProductFromOptionValue(valueId);
  if (!product || !value) return validationError("Valeur introuvable");
  await db
    .update(optionValues)
    .set({ available, updatedAt: new Date() })
    .where(eq(optionValues.id, valueId));
  revalidateCatalog(product.id, business.slug);
  return { status: "success" };
}

export const createVariant = createProductVariant;
export const updateVariant = updateProductVariant;
export const deleteVariant = deleteProductVariant;
export const reorderVariants = reorderProductVariants;
export const createOption = createProductOption;
export const updateOption = updateProductOption;
export const deleteOption = deleteProductOption;
export const reorderOptions = reorderProductOptions;
