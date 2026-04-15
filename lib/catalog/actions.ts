"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { categories, products } from "@/lib/db/schema";
import { requireBusiness } from "@/lib/auth/get-business";
import {
  createCategorySchema,
  createProductSchema,
  updateProductSchema,
} from "./schemas";

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

export async function updateProduct(
  productId: string,
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

  const parsed = updateProductSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Validation invalide",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { business } = await requireBusiness();

  const existing = await db.query.products.findFirst({
    where: and(
      eq(products.id, productId),
      eq(products.businessId, business.id),
    ),
    columns: { id: true },
  });
  if (!existing) {
    return { status: "error", message: "Article introuvable" };
  }

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

  await db
    .update(products)
    .set({
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      price: parsed.data.price.toFixed(2),
      available: parsed.data.available,
      updatedAt: new Date(),
    })
    .where(
      and(eq(products.id, productId), eq(products.businessId, business.id)),
    );

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
  redirect("/catalog");
}

export type CreateCategoryResult =
  | { status: "success"; category: { id: string; name: string } }
  | { status: "error"; message: string };

export async function createCategory(
  name: string,
): Promise<CreateCategoryResult> {
  const parsed = createCategorySchema.safeParse({ name });
  if (!parsed.success) {
    const first =
      parsed.error.flatten().fieldErrors.name?.[0] ?? "Nom invalide";
    return { status: "error", message: first };
  }

  const { business } = await requireBusiness();

  const last = await db.query.categories.findFirst({
    where: eq(categories.businessId, business.id),
    columns: { position: true },
    orderBy: [desc(categories.position)],
  });
  const position = (last?.position ?? -1) + 1;

  const [created] = await db
    .insert(categories)
    .values({
      businessId: business.id,
      name: parsed.data.name,
      position,
      visible: true,
    })
    .returning({ id: categories.id, name: categories.name });

  if (!created) {
    return { status: "error", message: "Création impossible" };
  }

  revalidatePath("/catalog");
  revalidatePath(`/${business.slug}`);
  return { status: "success", category: created };
}
