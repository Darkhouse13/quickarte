import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { requireBusiness } from "@/lib/auth/get-business";
import { NewItemForm } from "@/components/merchant/new-item-form";

export default async function NewCatalogItemPage() {
  const { business } = await requireBusiness();

  const rows = await db.query.categories.findMany({
    where: eq(categories.businessId, business.id),
    orderBy: [asc(categories.position)],
    columns: { id: true, name: true },
  });

  return <NewItemForm categories={rows} />;
}
