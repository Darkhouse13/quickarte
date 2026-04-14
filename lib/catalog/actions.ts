"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { businesses, categories, products } from "@/lib/db/schema";
import { createProductSchema } from "./schemas";
import { DEMO_BUSINESS_SLUG } from "./constants";

export type ActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "success" };

async function getDemoBusinessIdOrThrow(): Promise<string> {
  const row = await db.query.businesses.findFirst({
    where: eq(businesses.slug, DEMO_BUSINESS_SLUG),
    columns: { id: true },
  });
  if (!row) {
    throw new Error(
      `Demo business "${DEMO_BUSINESS_SLUG}" not found. Run \`npm run db:seed\`.`,
    );
  }
  return row.id;
}

export async function createProduct(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = {
    name: formData.get("name"),
    description: formData.get("description"),
    price: formData.get("price"),
    categoryId: formData.get("categoryId"),
    available: formData.get("available"),
  };

  const parsed = createProductSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Validation invalide",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const businessId = await getDemoBusinessIdOrThrow();

  // Ensure category belongs to this business (defense-in-depth)
  const category = await db.query.categories.findFirst({
    where: and(
      eq(categories.id, parsed.data.categoryId),
      eq(categories.businessId, businessId),
    ),
    columns: { id: true },
  });
  if (!category) {
    return {
      status: "error",
      message: "Catégorie introuvable pour cette boutique",
    };
  }

  await db.insert(products).values({
    businessId,
    categoryId: parsed.data.categoryId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    price: parsed.data.price.toFixed(2),
    available: parsed.data.available,
    position: 999,
  });

  revalidatePath("/catalog");
  revalidatePath(`/${DEMO_BUSINESS_SLUG}`);
  redirect("/catalog");
}

export async function updateProductAvailability(
  productId: string,
  available: boolean,
): Promise<void> {
  const businessId = await getDemoBusinessIdOrThrow();
  await db
    .update(products)
    .set({ available, updatedAt: new Date() })
    .where(
      and(eq(products.id, productId), eq(products.businessId, businessId)),
    );
  revalidatePath("/catalog");
  revalidatePath(`/${DEMO_BUSINESS_SLUG}`);
}

export async function deleteProduct(productId: string): Promise<void> {
  const businessId = await getDemoBusinessIdOrThrow();
  await db
    .delete(products)
    .where(
      and(eq(products.id, productId), eq(products.businessId, businessId)),
    );
  revalidatePath("/catalog");
  revalidatePath(`/${DEMO_BUSINESS_SLUG}`);
}
