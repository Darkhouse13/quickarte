import { setRequestLocale } from "next-intl/server";
import { requireBusiness } from "@/lib/auth/get-business";
import { getOrdersByBusinessId } from "@/lib/ordering/queries";
import { OrdersBoard } from "@/components/merchant/order-row";

type Props = { params: Promise<{ locale: string }> };

export default async function OrdersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { business } = await requireBusiness();
  const orders = await getOrdersByBusinessId(business.id);
  const pending = orders.filter((o) => o.status === "pending");
  const confirmed = orders.filter((o) => o.status === "confirmed");
  const completed = orders
    .filter((o) => o.status === "completed")
    .slice(0, 10);

  const totalActive = pending.length + confirmed.length;

  return (
    <>
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
          pending={pending}
          confirmed={confirmed}
          completed={completed}
        />
      </div>
    </>
  );
}
