import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories } from "@quickarte/db-schema";
import { requireBusiness } from "@/lib/auth/get-business";
import { assertRole } from "@/lib/identity/permissions";
import { NewItemForm } from "@/components/merchant/new-item-form";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = { title: "Quickarte — Nouvel article" };

export default async function NewCatalogItemPage() {
  const { session, business } = await requireBusiness();
  await assertRole(session.user.id, business.id, ["owner", "manager"]);

  const rows = await db.query.categories.findMany({
    where: eq(categories.businessId, business.id),
    orderBy: [asc(categories.position)],
    columns: { id: true, name: true },
  });

  return <NewItemForm categories={rows} />;
}
