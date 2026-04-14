import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";
import { ActionCard } from "@/components/ui/action-card";
import {
  StatusBadge,
  type OrderStatus,
} from "@/components/ui/status-badge";
import { cn } from "@/lib/utils/cn";

type RecentOrder = {
  id: string;
  name: string;
  time: string;
  total: number;
  status: OrderStatus;
};

const today = {
  merchantName: "Karim",
  businessName: "Café des Arts",
  date: "24 OCT 2023",
  orders: 42,
  revenue: "1,450",
  pending: 5,
};

const recentOrders: RecentOrder[] = [
  {
    id: "1",
    name: "Youssef B.",
    time: "14:32",
    total: 85,
    status: "pending",
  },
  { id: "2", name: "Sara M.", time: "14:28", total: 120, status: "pending" },
  { id: "3", name: "Mehdi T.", time: "14:15", total: 45, status: "confirmed" },
  {
    id: "4",
    name: "Amina R.",
    time: "13:50",
    total: 210,
    status: "confirmed",
  },
  { id: "5", name: "Omar K.", time: "13:10", total: 65, status: "completed" },
];

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function MerchantHomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <header className="pt-8 px-6 pb-6 border-b-4 border-outline bg-base sticky top-0 z-20 flex flex-col gap-1">
        <div className="flex justify-between items-baseline">
          <h1 className="font-sans text-xl font-normal text-ink">
            Bonjour, {today.merchantName}
          </h1>
          <span className="font-mono text-sm tracking-tighter text-ink font-bold">
            {today.date}
          </span>
        </div>
        <p className="font-mono text-xs text-ink/50 uppercase tracking-widest mt-1">
          {today.businessName}
        </p>
      </header>

      <div className="flex-1">
        <section className="border-b-4 border-outline bg-base">
          <SectionHeader index={1} title="Aujourd'hui" />
          <div className="grid grid-cols-3 divide-x divide-outline">
            <StatCard label="Commandes" value={today.orders} />
            <StatCard
              label="Revenu"
              unit="MAD"
              value={today.revenue}
              valueClassName="text-2xl"
            />
            <StatCard
              label="En attente"
              value={today.pending}
              tone="accent"
              indicator
            />
          </div>
        </section>

        <section className="border-b-4 border-outline">
          <SectionHeader index={2} title="Actions Rapides" />
          <div className="flex flex-col">
            <ActionCard
              label="Gérer les commandes"
              href="/orders"
              badge={today.pending}
              accent="accent"
            />
            <ActionCard
              label="Modifier le catalogue"
              href="/catalog"
              accent="ink"
            />
            <ActionCard
              label="Voir ma boutique"
              href={`/${locale}/cafe-des-arts`}
              accent="ink"
              isLast
            />
          </div>
        </section>

        <section>
          <SectionHeader index={3} title="Dernières Commandes" />
          <div className="flex flex-col">
            {recentOrders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function OrderRow({ order }: { order: RecentOrder }) {
  const isLive = order.status === "pending";
  const isDone = order.status === "completed";
  const barColor = isLive ? "bg-accent" : isDone ? "bg-outline" : "bg-ink";

  return (
    <Link
      href={`/orders/${order.id}`}
      className={cn(
        "p-4 px-6 border-b border-outline flex justify-between items-center hover:bg-black/[0.02] transition-colors cursor-pointer group relative",
        order.status === "confirmed" && "bg-black/[0.01]",
        order.status === "completed" && "opacity-70",
      )}
    >
      <div
        className={cn(
          "absolute left-0 top-0 w-1 h-full scale-y-0 group-hover:scale-y-100 transition-transform origin-top",
          barColor,
        )}
      />
      <div className="flex flex-col gap-1.5">
        <span
          className={cn(
            "font-bold text-[15px] leading-none",
            isDone && "text-ink/80",
          )}
        >
          {order.name}
        </span>
        <span
          className={cn(
            "font-mono text-[12px] leading-none",
            isDone ? "text-ink/40" : "text-ink/50",
          )}
        >
          {order.time}
        </span>
      </div>
      <div
        className={cn(
          "flex flex-col items-end gap-2",
          isDone && "text-ink/80",
        )}
      >
        <span className="font-mono text-[15px] font-bold leading-none">
          {order.total}{" "}
          <span
            className={cn(
              "text-[10px] font-normal",
              isDone ? "text-ink/40" : "text-ink/50",
            )}
          >
            MAD
          </span>
        </span>
        <StatusBadge status={order.status} />
      </div>
    </Link>
  );
}
