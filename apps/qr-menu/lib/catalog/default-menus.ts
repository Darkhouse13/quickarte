import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, products } from "@quickarte/db-schema";

type DefaultItem = { name: string; priceMAD: number };
type DefaultCategory = {
  name: string;
  order: number;
  items: DefaultItem[];
};
type DefaultMenu = { categories: DefaultCategory[] };

type BusinessType = "restaurant" | "cafe" | "autre";

export const DEFAULT_MENUS: Record<BusinessType, DefaultMenu | null> = {
  restaurant: null,
  cafe: null,
  autre: null,
};

type Executor = Pick<typeof db, "query" | "insert">;

export async function seedDefaultCatalog(
  businessId: string,
  type: BusinessType,
  tx: Executor = db,
): Promise<void> {
  const menu = DEFAULT_MENUS[type];
  if (!menu) return;

  const existingCategory = await tx.query.categories.findFirst({
    where: eq(categories.businessId, businessId),
    columns: { id: true },
  });
  const existingProduct = await tx.query.products.findFirst({
    where: eq(products.businessId, businessId),
    columns: { id: true },
  });
  if (existingCategory || existingProduct) {
    console.log(`catalog not empty, skip seeding ${businessId}`);
    return;
  }

  for (const category of menu.categories) {
    const [cat] = await tx
      .insert(categories)
      .values({
        businessId,
        name: category.name,
        position: category.order,
        visible: true,
      })
      .returning({ id: categories.id });
    if (!cat) throw new Error(`Failed to insert category ${category.name}`);

    for (const [i, item] of category.items.entries()) {
      await tx.insert(products).values({
        businessId,
        categoryId: cat.id,
        name: item.name,
        description: null,
        price: item.priceMAD.toFixed(2),
        image: null,
        available: true,
        position: i,
      });
    }
  }
}
