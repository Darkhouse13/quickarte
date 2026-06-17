import "server-only";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  businesses,
  categories,
  optionValues,
  products,
  productOptions,
  productVariants,
  type Business,
  type BusinessSettings,
  type Category,
  type Product,
} from "@/lib/db/schema";

export type BusinessWithSettings = Business & {
  settings: BusinessSettings | null;
};

export async function getBusinessBySlug(
  slug: string,
): Promise<BusinessWithSettings | null> {
  const row = await db.query.businesses.findFirst({
    where: eq(businesses.slug, slug),
    with: { settings: true },
  });
  return row ?? null;
}

export type CategoryWithProducts = Category & { products: Product[] };

export type StorefrontProduct = Product & {
  variants: Array<{
    id: string;
    name: string;
    priceOverride: string | null;
    isDefault: boolean;
    available: boolean;
    optionMaxSelectionsOverrides: Record<string, number>;
    position: number;
  }>;
  options: Array<{
    id: string;
    name: string;
    type: "single_select" | "multi_select";
    required: boolean;
    minSelect: number;
    maxSelect: number | null;
    available: boolean;
    position: number;
    values: Array<{
      id: string;
      name: string;
      priceAddition: string;
      available: boolean;
      position: number;
      allowQuantity: boolean;
      maxQuantity: number | null;
    }>;
  }>;
};

export type StorefrontCategoryWithProducts = Category & {
  products: StorefrontProduct[];
};

export async function getMenuByBusinessId(
  businessId: string,
): Promise<StorefrontCategoryWithProducts[]> {
  // Mizane sync soft-deletes (sets deleted_at on) entities it no longer lists;
  // every read of the live menu must exclude them at each level of the tree.
  const rows = await db.query.categories.findMany({
    where: and(
      eq(categories.businessId, businessId),
      isNull(categories.deletedAt),
    ),
    orderBy: [asc(categories.position)],
    with: {
      products: {
        where: and(eq(products.available, true), isNull(products.deletedAt)),
        orderBy: [asc(products.position)],
        with: {
          variants: {
            where: isNull(productVariants.deletedAt),
            orderBy: [asc(productVariants.position)],
            columns: {
              id: true,
              name: true,
              priceOverride: true,
              isDefault: true,
              available: true,
              optionMaxSelectionsOverrides: true,
              position: true,
            },
          },
          options: {
            where: isNull(productOptions.deletedAt),
            orderBy: [asc(productOptions.position)],
            columns: {
              id: true,
              name: true,
              type: true,
              required: true,
              minSelect: true,
              maxSelect: true,
              available: true,
              position: true,
            },
            with: {
              values: {
                where: isNull(optionValues.deletedAt),
                orderBy: [asc(optionValues.position)],
                columns: {
                  id: true,
                  name: true,
                  priceAddition: true,
                  available: true,
                  position: true,
                  allowQuantity: true,
                  maxQuantity: true,
                },
              },
            },
          },
        },
      },
    },
  });
  return rows;
}

export async function getAllProductsByBusinessId(
  businessId: string,
): Promise<CategoryWithProducts[]> {
  const rows = await db.query.categories.findMany({
    where: eq(categories.businessId, businessId),
    orderBy: [asc(categories.position)],
    with: {
      products: {
        orderBy: [asc(products.position)],
      },
    },
  });
  return rows;
}

export async function countProductsByBusinessId(
  businessId: string,
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.businessId, businessId));
  return row?.count ?? 0;
}
