import "server-only";
import {
  and,
  eq,
  inArray,
  isNotNull,
  isNull,
  notInArray,
  type AnyColumn,
} from "drizzle-orm";
import { db } from "@/lib/db";
import {
  categories,
  products,
  productVariants,
  productOptions,
  optionValues,
} from "@/lib/db/schema";
import { getMizaneMenu } from "./client";
import { getMizaneMenuEtag, markMizaneMenuSynced } from "./queries";
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
  // Rows soft-deleted because Mizane no longer lists them.
  softDeleted: number;
  // True when the cached ETag matched (304) — nothing was re-fetched or written.
  notModified: boolean;
};

export async function syncMizaneMenu(
  businessId: string,
  apiKey: string,
): Promise<MizaneSyncResult> {
  const cachedEtag = await getMizaneMenuEtag(businessId);
  const result = await getMizaneMenu(apiKey, cachedEtag);

  // Menu unchanged since the last sync — skip all DB work, just re-stamp.
  if (result.notModified) {
    await markMizaneMenuSynced(businessId, result.etag);
    return {
      categories: 0,
      products: 0,
      variants: 0,
      optionGroups: 0,
      optionValues: 0,
      softDeleted: 0,
      notModified: true,
    };
  }

  const { menu } = result;
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

  // 5. Soft-delete entities Mizane no longer lists. Mizane has no tombstone — a
  // removed entity simply disappears from the menu — so we reconcile by id: any
  // mizane-linked row for this business whose id isn't in the fresh response is
  // marked deleted. Soft (not hard) delete preserves historical order coherence
  // and is reversible — a later sync that re-lists the id clears deletedAt.
  const softDeleted = await softDeleteAbsent(businessId, menu, now);

  await markMizaneMenuSynced(businessId, result.etag);

  return {
    categories: menu.categories.length,
    products: menu.products.length,
    variants: menu.variants.length,
    optionGroups: menu.optionGroups.length,
    optionValues: menu.optionGroups.reduce((s, g) => s + g.values.length, 0),
    softDeleted,
    notModified: false,
  };
}

// ─── Soft-delete reconciliation ───────────────────────────────────────────────

async function softDeleteAbsent(
  businessId: string,
  menu: {
    categories: MizaneCategory[];
    products: MizaneProduct[];
    variants: MizaneVariant[];
    optionGroups: MizaneOptionGroup[];
  },
  now: Date,
): Promise<number> {
  const seenCategoryIds = menu.categories.map((c) => c.id);
  const seenProductIds = menu.products.map((p) => p.id);
  const seenVariantIds = menu.variants.map((v) => v.id);
  const seenGroupIds = menu.optionGroups.map((g) => g.id);
  const seenValueIds = menu.optionGroups.flatMap((g) =>
    g.values.map((v) => v.id),
  );

  // Subqueries that scope variant/option/value deletes to THIS business (those
  // tables carry no business_id — only a parent chain back to products).
  const businessProductIds = db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.businessId, businessId));
  const businessOptionIds = db
    .select({ id: productOptions.id })
    .from(productOptions)
    .where(inArray(productOptions.productId, businessProductIds));

  // `notInArray(col, [])` is invalid SQL, and an empty seen-set means the
  // response listed none of that entity — so omit the clause and let the scope
  // filters delete everything mizane-linked in scope.
  const absent = (column: AnyColumn, seenIds: string[]) =>
    seenIds.length > 0 ? notInArray(column, seenIds) : undefined;

  const counts = await Promise.all([
    db
      .update(categories)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(categories.businessId, businessId),
          isNotNull(categories.mizaneId),
          isNull(categories.deletedAt),
          absent(categories.mizaneId, seenCategoryIds),
        ),
      )
      .returning({ id: categories.id }),
    db
      .update(products)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(products.businessId, businessId),
          isNotNull(products.mizaneId),
          isNull(products.deletedAt),
          absent(products.mizaneId, seenProductIds),
        ),
      )
      .returning({ id: products.id }),
    db
      .update(productVariants)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          inArray(productVariants.productId, businessProductIds),
          isNotNull(productVariants.mizaneId),
          isNull(productVariants.deletedAt),
          absent(productVariants.mizaneId, seenVariantIds),
        ),
      )
      .returning({ id: productVariants.id }),
    db
      .update(productOptions)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          inArray(productOptions.productId, businessProductIds),
          isNotNull(productOptions.mizaneId),
          isNull(productOptions.deletedAt),
          absent(productOptions.mizaneId, seenGroupIds),
        ),
      )
      .returning({ id: productOptions.id }),
    db
      .update(optionValues)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          inArray(optionValues.optionId, businessOptionIds),
          isNotNull(optionValues.mizaneId),
          isNull(optionValues.deletedAt),
          absent(optionValues.mizaneId, seenValueIds),
        ),
      )
      .returning({ id: optionValues.id }),
  ]);

  return counts.reduce((sum, rows) => sum + rows.length, 0);
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
