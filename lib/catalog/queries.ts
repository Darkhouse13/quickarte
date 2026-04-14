import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  businesses,
  categories,
  products,
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

export async function getMenuByBusinessId(
  businessId: string,
): Promise<CategoryWithProducts[]> {
  const rows = await db.query.categories.findMany({
    where: eq(categories.businessId, businessId),
    orderBy: [asc(categories.position)],
    with: {
      products: {
        where: eq(products.available, true),
        orderBy: [asc(products.position)],
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
