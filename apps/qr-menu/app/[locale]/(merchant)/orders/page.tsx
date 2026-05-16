import { setRequestLocale } from "next-intl/server";
import { requireBusiness } from "@/lib/auth/get-business";
import { assertRole, type StaffRole } from "@/lib/identity/permissions";
import { getOrdersByBusinessId } from "@/lib/ordering/queries";
import { getEventsForOrders } from "@/lib/ordering/event-queries";
import { OrdersBoard, OrdersPoller } from "@/components/merchant/order-row";
import { Gated } from "@/components/entitlements/gated";
import { UpsellCard } from "@/components/entitlements/upsell-card";
import type { JournalEvent } from "@/lib/ordering/event-queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = { title: "Quickarte — Commandes" };

type Props = { params: Promise<{ locale: string }> };

export default async function OrdersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { session, business } = await requireBusiness();
  const role = await assertRole(session.user.id, business.id, [
    "owner",
    "manager",
    "waiter",
    "cashier",
  ]);
  const orderingOperational = business.settings?.orderingEnabled !== false;

  return (
    <Gated
      module="online_ordering"
      businessId={business.id}
      fallback={<OrdersUpsell />}
    >
      {orderingOperational ? (
        <OrdersView
          businessId={business.id}
          role={role}
          posCoexistenceEnabled={
            business.settings?.posCoexistenceEnabled === true
          }
        />
      ) : (
        <OrdersDisabled />
      )}
    </Gated>
  );
}

async function OrdersView({
  businessId,
  role,
  posCoexistenceEnabled,
}: {
  businessId: string;
  role: StaffRole;
  posCoexistenceEnabled: boolean;
}) {
  const orders = await getOrdersByBusinessId(businessId, undefined, 50);
  const totalActive = orders.filter(
    (o) => o.status !== "completed" && o.status !== "cancelled",
  ).length;

  let eventsByOrderId: Record<string, JournalEvent[]> = {};
  if (role === "owner" || role === "manager") {
    const map = await getEventsForOrders(
      businessId,
      orders.map((o) => o.id),
    );
    eventsByOrderId = Object.fromEntries(map);
  }

  return (
    <>
      <OrdersPoller
        pendingOrderIds={orders
          .filter((order) => order.status === "pending")
          .map((order) => order.id)}
      />
      <header className="pt-8 px-6 pb-6 border-b-4 border-outline bg-base sticky top-0 z-20 flex justify-between items-baseline">
        <h1 className="font-mono font-bold text-2xl tracking-tighter uppercase leading-none">
          Commandes
        </h1>
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink/50 font-bold">
          {totalActive} {totalActive === 1 ? "active" : "actives"}
        </span>
      </header>

      <div className="flex-1">
        <OrdersBoard
          orders={orders}
          eventsByOrderId={eventsByOrderId}
          posCoexistenceEnabled={posCoexistenceEnabled}
          role={role}
        />
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

function OrdersDisabled() {
  return (
    <>
      <header className="pt-8 px-6 pb-6 border-b-4 border-outline bg-base sticky top-0 z-20">
        <h1 className="font-mono font-bold text-2xl tracking-tighter uppercase leading-none">
          Commandes
        </h1>
      </header>
      <div className="px-6 py-16 text-center">
        <p className="font-sans text-[15px] text-ink/60 leading-snug">
          La commande en ligne est desactivee. Reactivez le module dans les
          parametres pour recevoir des commandes.
        </p>
      </div>
    </>
  );
}
