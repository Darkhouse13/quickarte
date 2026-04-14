"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { categories, products } from "@/lib/db/schema";
import { requireBusiness } from "@/lib/auth/get-business";
import { createProductSchema } from "./schemas";

export type ActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "success" };

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

  const { business } = await requireBusiness();

  const category = await db.query.categories.findFirst({
    where: and(
      eq(categories.id, parsed.data.categoryId),
      eq(categories.businessId, business.id),
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
    businessId: business.id,
    categoryId: parsed.data.categoryId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    price: parsed.data.price.toFixed(2),
    available: parsed.data.available,
    position: 999,
  });

  revalidatePath("/catalog");
  revalidatePath(`/${business.slug}`);
  redirect("/catalog");
}

export async function updateProductAvailability(
  productId: string,
  available: boolean,
): Promise<void> {
  const { business } = await requireBusiness();
  await db
    .update(products)
    .set({ available, updatedAt: new Date() })
    .where(
      and(eq(products.id, productId), eq(products.businessId, business.id)),
    );
  revalidatePath("/catalog");
  revalidatePath(`/${business.slug}`);
}

export async function deleteProduct(productId: string): Promise<void> {
  const { business } = await requireBusiness();
  await db
    .delete(products)
    .where(
      and(eq(products.id, productId), eq(products.businessId, business.id)),
    );
  revalidatePath("/catalog");
  revalidatePath(`/${business.slug}`);
}
