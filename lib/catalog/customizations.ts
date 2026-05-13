"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  optionValues,
  productOptions,
  products,
  productVariants,
} from "@/lib/db/schema";
import { requireBusiness } from "@/lib/auth/get-business";
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

export type CustomizationActionResult =
  | { status: "success" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> };

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

async function requireOwnedProduct(productId: string) {
  const { business } = await requireBusiness();
  const product = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.businessId, business.id)),
    columns: { id: true },
  });
  if (!product) return { business, product: null };
  return { business, product };
}

async function requireOwnedProductFromVariant(variantId: string) {
  const { business } = await requireBusiness();
  const variant = await db.query.productVariants.findFirst({
    where: eq(productVariants.id, variantId),
    columns: { id: true, productId: true },
  });
  if (!variant) return { business, product: null, variant: null };
  const product = await db.query.products.findFirst({
    where: and(
      eq(products.id, variant.productId),
      eq(products.businessId, business.id),
    ),
    columns: { id: true },
  });
  return { business, product: product ?? null, variant };
}

async function requireOwnedProductFromOption(optionId: string) {
  const { business } = await requireBusiness();
  const option = await db.query.productOptions.findFirst({
    where: eq(productOptions.id, optionId),
    columns: { id: true, productId: true, type: true },
  });
  if (!option) return { business, product: null, option: null };
  const product = await db.query.products.findFirst({
    where: and(
      eq(products.id, option.productId),
      eq(products.businessId, business.id),
    ),
    columns: { id: true },
  });
  return { business, product: product ?? null, option };
}

async function requireOwnedProductFromOptionValue(optionValueId: string) {
  const { business } = await requireBusiness();
  const value = await db.query.optionValues.findFirst({
    where: eq(optionValues.id, optionValueId),
    columns: { id: true, optionId: true },
  });
  if (!value) return { business, product: null, option: null, value: null };
  const option = await db.query.productOptions.findFirst({
    where: eq(productOptions.id, value.optionId),
    columns: { id: true, productId: true },
  });
  if (!option) return { business, product: null, option: null, value };
  const product = await db.query.products.findFirst({
    where: and(
      eq(products.id, option.productId),
      eq(products.businessId, business.id),
    ),
    columns: { id: true },
  });
  return { business, product: product ?? null, option, value };
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

export async function createVariant(
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

  const position =
    parsed.data.position ??
    ((await db.query.productVariants.findFirst({
      where: eq(productVariants.productId, productId),
      columns: { position: true },
      orderBy: [desc(productVariants.position)],
    }))?.position ?? -1) + 1;

  await db.insert(productVariants).values({
    productId,
    name: parsed.data.name,
    priceOverride: formatPrice(parsed.data.price_override),
    position,
  });

  revalidateCatalog(productId, business.slug);
  return { status: "success" };
}

export async function updateVariant(
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

  await db
    .update(productVariants)
    .set({
      ...(hasOwn(parsed.data, "name") ? { name: parsed.data.name } : {}),
      ...(hasOwn(parsed.data, "price_override")
        ? { priceOverride: formatPrice(parsed.data.price_override) }
        : {}),
      ...(hasOwn(parsed.data, "position")
        ? { position: parsed.data.position }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(productVariants.id, variantId));

  revalidateCatalog(product.id, business.slug);
  return { status: "success" };
}

export async function deleteVariant(
  variantId: string,
): Promise<CustomizationActionResult> {
  const { business, product, variant } =
    await requireOwnedProductFromVariant(variantId);
  if (!product || !variant) return validationError("Variante introuvable");

  await db.delete(productVariants).where(eq(productVariants.id, variantId));

  revalidateCatalog(product.id, business.slug);
  return { status: "success" };
}

export async function reorderVariants(
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

export async function createOption(
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

  const position =
    parsed.data.position ??
    ((await db.query.productOptions.findFirst({
      where: eq(productOptions.productId, productId),
      columns: { position: true },
      orderBy: [desc(productOptions.position)],
    }))?.position ?? -1) + 1;

  await db.insert(productOptions).values({
    productId,
    name: parsed.data.name,
    type: parsed.data.type,
    required: parsed.data.required,
    maxSelections: parsed.data.max_selections ?? null,
    position,
  });

  revalidateCatalog(productId, business.slug);
  return { status: "success" };
}

export async function updateOption(
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
  if (nextType === "single_select" && parsed.data.max_selections != null) {
    return {
      status: "error",
      message: "Validation invalide",
      fieldErrors: { max_selections: ["Maximum réservé aux choix multiples"] },
    };
  }

  const existingValue = await db.query.optionValues.findFirst({
    where: eq(optionValues.optionId, optionId),
    columns: { id: true },
  });
  if (!existingValue) {
    return validationError("Ajoutez au moins une valeur.");
  }

  await db
    .update(productOptions)
    .set({
      ...(hasOwn(parsed.data, "name") ? { name: parsed.data.name } : {}),
      ...(hasOwn(parsed.data, "type") ? { type: parsed.data.type } : {}),
      ...(hasOwn(parsed.data, "required")
        ? { required: parsed.data.required }
        : {}),
      ...(nextType === "single_select"
        ? { maxSelections: null }
        : hasOwn(parsed.data, "max_selections")
          ? { maxSelections: parsed.data.max_selections ?? null }
          : {}),
      ...(hasOwn(parsed.data, "position")
        ? { position: parsed.data.position }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(productOptions.id, optionId));

  revalidateCatalog(product.id, business.slug);
  return { status: "success" };
}

export async function deleteOption(
  optionId: string,
): Promise<CustomizationActionResult> {
  const { business, product, option } =
    await requireOwnedProductFromOption(optionId);
  if (!product || !option) return validationError("Option introuvable");

  await db.delete(productOptions).where(eq(productOptions.id, optionId));

  revalidateCatalog(product.id, business.slug);
  return { status: "success" };
}

export async function reorderOptions(
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

  const position =
    parsed.data.position ??
    ((await db.query.optionValues.findFirst({
      where: eq(optionValues.optionId, optionId),
      columns: { position: true },
      orderBy: [desc(optionValues.position)],
    }))?.position ?? -1) + 1;

  await db.insert(optionValues).values({
    optionId,
    name: parsed.data.name,
    priceAddition: parsed.data.price_addition.toFixed(2),
    position,
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
