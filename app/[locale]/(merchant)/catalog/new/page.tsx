import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { businesses, categories } from "@/lib/db/schema";
import { DEMO_BUSINESS_SLUG } from "@/lib/catalog/constants";
import { NewItemForm } from "@/components/merchant/new-item-form";

export default async function NewCatalogItemPage() {
  const business = await db.query.businesses.findFirst({
    where: eq(businesses.slug, DEMO_BUSINESS_SLUG),
    columns: { id: true },
  });
  if (!business) notFound();

  const rows = await db.query.categories.findMany({
    where: eq(categories.businessId, business.id),
    orderBy: [asc(categories.position)],
    columns: { id: true, name: true },
  });

  return <NewItemForm categories={rows} />;
}
