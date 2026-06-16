import "server-only";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  categories,
  products,
  productVariants,
  productOptions,
  optionValues,
} from "@/lib/db/schema";
import { getMizaneMenu } from "./client";
import { touchMizaneLastSynced } from "./queries";
import type {
  MizaneCategory,
  MizaneOptionGroup,
  MizaneOptionValue,
  MizaneProduct,
  MizaneVariant,
} from "./types";

const MIZANE_IMAGE_BASE = "https://mizane.xyz";

export type MizaneSyncResult = {
  categories: number;
  products: number;
  variants: number;
  optionGroups: number;
  optionValues: number;
};

export async function syncMizaneMenu(
  businessId: string,
  apiKey: string,
): Promise<MizaneSyncResult> {
  const menu = await getMizaneMenu(apiKey);
  const now = new Date();

  // 1. Categories
  const categoryIdMap = new Map<string, string>(); // mizaneId → qaId
  for (const cat of menu.categories) {
    const qaId = await upsertCategory(businessId, cat, now);
    categoryIdMap.set(cat.id, qaId);
  }

  // 2. Products
  const productIdMap = new Map<string, string>(); // mizaneId → qaId
  for (const product of menu.products) {
    const categoryQaId = categoryIdMap.get(product.categoryId) ?? null;
    const qaId = await upsertProduct(businessId, product, categoryQaId, now);
    productIdMap.set(product.id, qaId);
  }

  // 3. Variants
  for (const variant of menu.variants) {
    const productQaId = productIdMap.get(variant.productId);
    if (!productQaId) continue;
    await upsertVariant(productQaId, variant, now);
  }

  // 4. Option groups + values via junction
  const groupById = new Map(menu.optionGroups.map((g) => [g.id, g]));

  for (const pog of menu.productOptionGroups) {
    const productQaId = productIdMap.get(pog.productId);
    const group = groupById.get(pog.optionGroupId);
    if (!productQaId || !group) continue;

    const groupQaId = await upsertOptionGroup(
      productQaId,
      group,
      pog.position,
      now,
    );
    for (const value of group.values) {
      await upsertOptionValue(groupQaId, value, now);
    }
  }

  await touchMizaneLastSynced(businessId);

  return {
    categories: menu.categories.length,
    products: menu.products.length,
    variants: menu.variants.length,
    optionGroups: menu.optionGroups.length,
    optionValues: menu.optionGroups.reduce((s, g) => s + g.values.length, 0),
  };
}

// ─── Per-entity upserts ───────────────────────────────────────────────────────

async function upsertCategory(
  businessId: string,
  cat: MizaneCategory,
  now: Date,
): Promise<string> {
  const existing = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.businessId, businessId),
        eq(categories.mizaneId, cat.id),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(categories)
      .set({
        name: cat.name,
        localizedNames: cat.localizedNames ?? undefined,
        position: cat.position,
        deletedAt: null,
        updatedAt: now,
      })
      .where(eq(categories.id, existing[0]!.id));
    return existing[0]!.id;
  }

  const [row] = await db
    .insert(categories)
    .values({
      businessId,
      name: cat.name,
      localizedNames: cat.localizedNames ?? undefined,
      position: cat.position,
      mizaneId: cat.id,
    })
    .returning({ id: categories.id });
  return row!.id;
}

async function upsertProduct(
  businessId: string,
  product: MizaneProduct,
  categoryQaId: string | null,
  now: Date,
): Promise<string> {
  const imageUrl = product.imageUrl
    ? `${MIZANE_IMAGE_BASE}${product.imageUrl}`
    : null;

  const existing = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        eq(products.businessId, businessId),
        eq(products.mizaneId, product.id),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(products)
      .set({
        name: product.name,
        localizedNames: product.localizedNames ?? undefined,
        description: product.description,
        image: imageUrl,
        available: product.available,
        position: product.position,
        categoryId: categoryQaId,
        deletedAt: null,
        updatedAt: now,
      })
      .where(eq(products.id, existing[0]!.id));
    return existing[0]!.id;
  }

  const [row] = await db
    .insert(products)
    .values({
      businessId,
      categoryId: categoryQaId,
      name: product.name,
      localizedNames: product.localizedNames ?? undefined,
      description: product.description,
      image: imageUrl,
      available: product.available,
      position: product.position,
      // Variants carry the real price; "0" is required by NOT NULL constraint
      price: "0",
      mizaneId: product.id,
    })
    .returning({ id: products.id });
  return row!.id;
}

async function upsertVariant(
  productQaId: string,
  variant: MizaneVariant,
  now: Date,
): Promise<string> {
  const existing = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(eq(productVariants.mizaneId, variant.id))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(productVariants)
      .set({
        name: variant.name,
        localizedNames: variant.localizedNames ?? undefined,
        priceOverride: variant.price,
        isDefault: variant.isDefault,
        available: variant.available,
        position: variant.position,
        deletedAt: null,
        updatedAt: now,
      })
      .where(eq(productVariants.id, existing[0]!.id));
    return existing[0]!.id;
  }

  const [row] = await db
    .insert(productVariants)
    .values({
      productId: productQaId,
      name: variant.name,
      localizedNames: variant.localizedNames ?? undefined,
      priceOverride: variant.price,
      isDefault: variant.isDefault,
      available: variant.available,
      position: variant.position,
      mizaneId: variant.id,
    })
    .returning({ id: productVariants.id });
  return row!.id;
}

async function upsertOptionGroup(
  productQaId: string,
  group: MizaneOptionGroup,
  position: number,
  now: Date,
): Promise<string> {
  // Lookup by (productId, mizaneId) — the unique partial index covers mizaneId
  // alone but option groups can in theory be shared; for now one row per (product, group).
  const existing = await db
    .select({ id: productOptions.id })
    .from(productOptions)
    .where(
      and(
        eq(productOptions.productId, productQaId),
        isNotNull(productOptions.mizaneId),
        eq(productOptions.mizaneId, group.id),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(productOptions)
      .set({
        name: group.name,
        localizedNames: group.localizedNames ?? undefined,
        type: group.type,
        required: group.required,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect ?? undefined,
        position,
        deletedAt: null,
        updatedAt: now,
      })
      .where(eq(productOptions.id, existing[0]!.id));
    return existing[0]!.id;
  }

  const [row] = await db
    .insert(productOptions)
    .values({
      productId: productQaId,
      name: group.name,
      localizedNames: group.localizedNames ?? undefined,
      type: group.type,
      required: group.required,
      minSelect: group.minSelect,
      maxSelect: group.maxSelect ?? undefined,
      position,
      mizaneId: group.id,
    })
    .returning({ id: productOptions.id });
  return row!.id;
}

async function upsertOptionValue(
  optionQaId: string,
  value: MizaneOptionValue,
  now: Date,
): Promise<string> {
  const existing = await db
    .select({ id: optionValues.id })
    .from(optionValues)
    .where(eq(optionValues.mizaneId, value.id))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(optionValues)
      .set({
        name: value.name,
        localizedNames: value.localizedNames ?? undefined,
        priceAddition: value.priceDelta,
        available: value.available,
        allowQuantity: value.allowQuantity,
        maxQuantity: value.maxQuantity,
        deletedAt: null,
        updatedAt: now,
      })
      .where(eq(optionValues.id, existing[0]!.id));
    return existing[0]!.id;
  }

  const [row] = await db
    .insert(optionValues)
    .values({
      optionId: optionQaId,
      name: value.name,
      localizedNames: value.localizedNames ?? undefined,
      priceAddition: value.priceDelta,
      available: value.available,
      allowQuantity: value.allowQuantity,
      maxQuantity: value.maxQuantity,
      mizaneId: value.id,
    })
    .returning({ id: optionValues.id });
  return row!.id;
}
