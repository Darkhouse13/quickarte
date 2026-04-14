import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { requireBusiness } from "@/lib/auth/get-business";
import { getOrderStats, getRecentOrders } from "@/lib/ordering/queries";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";
import { ActionCard } from "@/components/ui/action-card";
import {
  StatusBadge,
  type OrderStatus,
} from "@/components/ui/status-badge";
import { cn } from "@/lib/utils/cn";
import { formatDashboardDate, formatOrderTime } from "@/lib/utils/date";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function MerchantHomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { session, business } = await requireBusiness();

  const [stats, recentOrders] = await Promise.all([
    getOrderStats(business.id),
    getRecentOrders(business.id, 5),
  ]);

  const today_date = formatDashboardDate();
  const merchantName =
    session.user.name?.trim().split(/\s+/)[0] ?? "Marchand";
  const revenueLabel = stats.todayRevenue.toLocaleString("fr-FR", {
    maximumFractionDigits: 0,
  });

  return (
    <>
      <header className="pt-8 px-6 pb-6 border-b-4 border-outline bg-base sticky top-0 z-20 flex flex-col gap-1">
        <div className="flex justify-between items-baseline">
          <h1 className="font-sans text-xl font-normal text-ink">
            Bonjour, {merchantName}
          </h1>
          <span className="font-mono text-sm tracking-tighter text-ink font-bold">
            {today_date}
          </span>
        </div>
        <p className="font-mono text-xs text-ink/50 uppercase tracking-widest mt-1">
          {business.name}
        </p>
      </header>

      <div className="flex-1">
        <section className="border-b-4 border-outline bg-base">
          <SectionHeader index={1} title="Aujourd'hui" />
          <div className="grid grid-cols-3 divide-x divide-outline">
            <StatCard label="Commandes" value={stats.todayOrderCount} />
            <StatCard
              label="Revenu"
              unit="MAD"
              value={revenueLabel}
              valueClassName="text-2xl"
            />
            <StatCard
              label="En attente"
              value={stats.pendingCount}
              tone="accent"
              indicator={stats.pendingCount > 0}
            />
          </div>
        </section>

        <section className="border-b-4 border-outline">
          <SectionHeader index={2} title="Actions Rapides" />
          <div className="flex flex-col">
            <ActionCard
              label="Gérer les commandes"
              href="/orders"
              badge={stats.pendingCount > 0 ? stats.pendingCount : undefined}
              accent="accent"
            />
            <ActionCard
              label="Modifier le catalogue"
              href="/catalog"
              accent="ink"
            />
            <ActionCard
              label="Voir ma boutique"
              href={`/${locale}/${business.slug}`}
              accent="ink"
              isLast
            />
          </div>
        </section>

        <section>
          <SectionHeader index={3} title="Dernières Commandes" />
          {recentOrders.length === 0 ? (
            <p className="px-6 py-10 text-center font-sans text-sm text-ink/50">
              Aucune commande récente
            </p>
          ) : (
            <div className="flex flex-col">
              {recentOrders.map((order) => (
                <RecentOrderRow
                  key={order.id}
                  id={order.id}
                  name={order.customerName}
                  time={formatOrderTime(order.createdAt)}
                  total={Number(order.total)}
                  status={order.status as OrderStatus}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

type RecentOrderRowProps = {
  id: string;
  name: string;
  time: string;
  total: number;
  status: OrderStatus;
};

function RecentOrderRow({ name, time, total, status }: RecentOrderRowProps) {
  const isLive = status === "pending";
  const isDone = status === "completed";
  const barColor = isLive ? "bg-accent" : isDone ? "bg-outline" : "bg-ink";

  return (
    <Link
      href="/orders"
      className={cn(
        "p-4 px-6 border-b border-outline flex justify-between items-center hover:bg-black/[0.02] transition-colors cursor-pointer group relative",
        status === "confirmed" && "bg-black/[0.01]",
        isDone && "opacity-70",
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
          {name}
        </span>
        <span
          className={cn(
            "font-mono text-[12px] leading-none",
            isDone ? "text-ink/40" : "text-ink/50",
          )}
        >
          {time}
        </span>
      </div>
      <div
        className={cn(
          "flex flex-col items-end gap-2",
          isDone && "text-ink/80",
        )}
      >
        <span className="font-mono text-[15px] font-bold leading-none">
          {total.toFixed(0)}{" "}
          <span
            className={cn(
              "text-[10px] font-normal",
              isDone ? "text-ink/40" : "text-ink/50",
            )}
          >
            MAD
          </span>
        </span>
        <StatusBadge status={status} />
      </div>
    </Link>
  );
}
