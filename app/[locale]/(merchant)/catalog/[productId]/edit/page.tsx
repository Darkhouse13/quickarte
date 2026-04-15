import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { categories, products } from "@/lib/db/schema";
import { requireBusiness } from "@/lib/auth/get-business";
import { NewItemForm } from "@/components/merchant/new-item-form";

export const metadata = { title: "Quickarte — Modifier l'article" };

type Props = {
  params: Promise<{ locale: string; productId: string }>;
};

export default async function EditCatalogItemPage({ params }: Props) {
  const { productId } = await params;
  const { business } = await requireBusiness();

  const product = await db.query.products.findFirst({
    where: and(
      eq(products.id, productId),
      eq(products.businessId, business.id),
    ),
    columns: {
      id: true,
      name: true,
      description: true,
      price: true,
      categoryId: true,
      available: true,
    },
  });
  if (!product) notFound();

  const rows = await db.query.categories.findMany({
    where: eq(categories.businessId, business.id),
    orderBy: [asc(categories.position)],
    columns: { id: true, name: true },
  });

  return <NewItemForm categories={rows} product={product} />;
}
