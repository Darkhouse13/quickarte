import "server-only";
import { asc, eq, sql } from "drizzle-orm";
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
    position: number;
  }>;
  options: Array<{
    id: string;
    name: string;
    type: "single_select" | "multi_select";
    required: boolean;
    maxSelections: number | null;
    position: number;
    values: Array<{
      id: string;
      name: string;
      priceAddition: string;
      position: number;
    }>;
  }>;
};

export type StorefrontCategoryWithProducts = Category & {
  products: StorefrontProduct[];
};

export async function getMenuByBusinessId(
  businessId: string,
): Promise<StorefrontCategoryWithProducts[]> {
  const rows = await db.query.categories.findMany({
    where: eq(categories.businessId, businessId),
    orderBy: [asc(categories.position)],
    with: {
      products: {
        where: eq(products.available, true),
        orderBy: [asc(products.position)],
        with: {
          variants: {
            orderBy: [asc(productVariants.position)],
            columns: {
              id: true,
              name: true,
              priceOverride: true,
              position: true,
            },
          },
          options: {
            orderBy: [asc(productOptions.position)],
            columns: {
              id: true,
              name: true,
              type: true,
              required: true,
              maxSelections: true,
              position: true,
            },
            with: {
              values: {
                orderBy: [asc(optionValues.position)],
                columns: {
                  id: true,
                  name: true,
                  priceAddition: true,
                  position: true,
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
