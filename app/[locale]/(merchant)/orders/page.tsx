import { setRequestLocale } from "next-intl/server";
import { requireBusiness } from "@/lib/auth/get-business";
import { getOrdersByBusinessId } from "@/lib/ordering/queries";
import { OrdersBoard, OrdersPoller } from "@/components/merchant/order-row";
import { Gated } from "@/components/entitlements/gated";
import { UpsellCard } from "@/components/entitlements/upsell-card";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = { title: "Quickarte — Commandes" };

type Props = { params: Promise<{ locale: string }> };

export default async function OrdersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { business } = await requireBusiness();

  return (
    <Gated
      module="online_ordering"
      businessId={business.id}
      fallback={<OrdersUpsell />}
    >
      <OrdersView businessId={business.id} />
    </Gated>
  );
}

async function OrdersView({ businessId }: { businessId: string }) {
  const orders = await getOrdersByBusinessId(businessId, undefined, 50);
  const totalActive = orders.filter(
    (o) => o.status !== "completed" && o.status !== "cancelled",
  ).length;

  return (
    <>
      <OrdersPoller />
      <header className="pt-8 px-6 pb-6 border-b-4 border-outline bg-base sticky top-0 z-20 flex justify-between items-baseline">
        <h1 className="font-mono font-bold text-2xl tracking-tighter uppercase leading-none">
          Commandes
        </h1>
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink/50 font-bold">
          {totalActive} {totalActive === 1 ? "active" : "actives"}
        </span>
      </header>

      <div className="flex-1">
        <OrdersBoard orders={orders} />
      </div>
    </>
  );
}

function OrdersUpsell() {
  return (
    <>
      <header className="pt-8 px-6 pb-6 border-b-4 border-outline bg-base sticky top-0 z-20">
        <h1 className="font-mono font-bold text-2xl tracking-tighter uppercase leading-none">
          Commandes
        </h1>
      </header>
      <UpsellCard module="online_ordering" />
    </>
  );
}
