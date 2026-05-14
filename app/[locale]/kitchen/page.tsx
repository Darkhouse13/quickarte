import { setRequestLocale } from "next-intl/server";
import { requireBusiness } from "@/lib/auth/get-business";
import { assertRole } from "@/lib/identity/permissions";
import { getOpenKitchenOrders } from "@/lib/kitchen/queries";
import { KitchenBoard } from "@/components/kitchen/kitchen-board";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = { title: "Quickarte — Cuisine" };

type Props = { params: Promise<{ locale: string }> };

export default async function KitchenPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { session, business } = await requireBusiness();
  const role = await assertRole(session.user.id, business.id, [
    "owner",
    "manager",
    "kitchen",
  ]);

  const initialOrders = await getOpenKitchenOrders(business.id);
  const showDashboardLink = role === "owner" || role === "manager";

  return (
    <KitchenBoard
      initialOrders={initialOrders}
      businessName={business.name}
      fetchedAt={new Date().toISOString()}
      showDashboardLink={showDashboardLink}
    />
  );
}
