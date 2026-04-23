import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, products } from "@/lib/db/schema";

type DefaultItem = { name: string; priceEUR: number };
type DefaultCategory = {
  name: string;
  order: number;
  items: DefaultItem[];
};
type DefaultMenu = { categories: DefaultCategory[] };

type BusinessType = "boulangerie" | "cafe" | "restaurant" | "hotel" | "other";

export const DEFAULT_MENUS: Record<BusinessType, DefaultMenu | null> = {
  boulangerie: {
    categories: [
      {
        name: "Viennoiseries",
        order: 0,
        items: [
          { name: "Croissant", priceEUR: 1.3 },
          { name: "Pain au chocolat", priceEUR: 1.4 },
          { name: "Chausson aux pommes", priceEUR: 2.2 },
          { name: "Brioche", priceEUR: 3.5 },
        ],
      },
      {
        name: "Pains",
        order: 1,
        items: [
          { name: "Baguette tradition", priceEUR: 1.5 },
          { name: "Baguette classique", priceEUR: 1.1 },
          { name: "Pain de campagne", priceEUR: 4.5 },
          { name: "Pain complet", priceEUR: 4.0 },
        ],
      },
      {
        name: "Pâtisseries",
        order: 2,
        items: [
          { name: "Éclair au chocolat", priceEUR: 3.5 },
          { name: "Tarte aux fruits", priceEUR: 4.0 },
          { name: "Mille-feuille", priceEUR: 4.0 },
          { name: "Flan pâtissier", priceEUR: 3.0 },
        ],
      },
      {
        name: "Boissons",
        order: 3,
        items: [
          { name: "Café expresso", priceEUR: 1.5 },
          { name: "Café allongé", priceEUR: 1.8 },
          { name: "Thé", priceEUR: 2.5 },
          { name: "Chocolat chaud", priceEUR: 3.0 },
        ],
      },
      {
        name: "Sandwichs & en-cas",
        order: 4,
        items: [
          { name: "Jambon beurre", priceEUR: 4.5 },
          { name: "Poulet crudités", priceEUR: 5.5 },
          { name: "Sandwich au thon", priceEUR: 5.0 },
          { name: "Quiche lorraine", priceEUR: 4.0 },
        ],
      },
    ],
  },
  cafe: null,
  restaurant: null,
  hotel: null,
  other: null,
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
        price: item.priceEUR.toFixed(2),
        image: null,
        available: true,
        position: i,
      });
    }
  }
}
