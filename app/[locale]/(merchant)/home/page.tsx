import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { env } from "@/lib/env";
import { requireBusiness } from "@/lib/auth/get-business";
import { getOrderStats, getRecentOrders } from "@/lib/ordering/queries";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";
import { ActionCard } from "@/components/ui/action-card";
import { CopyButton } from "@/components/ui/copy-button";
import {
  StatusBadge,
  type OrderStatus,
} from "@/components/ui/status-badge";
import { cn } from "@/lib/utils/cn";
import { formatDashboardDate, formatOrderTime } from "@/lib/utils/date";
import { formatAmountCompact } from "@/lib/utils/currency";
import { UserMenu } from "@/components/merchant/user-menu";
import { EnableNotifications } from "@/components/merchant/enable-notifications";
import { hasEntitlement } from "@/lib/entitlements/queries";
import { countNewCustomersLast24h } from "@/lib/loyalty/queries";
import { generateQRDataURL } from "@/lib/utils/qr";
import {
  RangeToggle,
  type HomeRange,
} from "@/components/merchant/analytics/range-toggle";
import { SummaryLine } from "@/components/merchant/analytics/summary-line";
import { RevenueBarChart } from "@/components/merchant/analytics/revenue-bar-chart";
import { HourlyHeatmap } from "@/components/merchant/analytics/hourly-heatmap";
import { RankedProductList } from "@/components/merchant/analytics/ranked-product-list";
import { TopCustomersList } from "@/components/merchant/analytics/top-customers-list";
import {
  getHourlyHeatmap,
  getProductPerformance,
  getRevenueByDay,
  getSummary,
  getTopLoyalCustomers,
} from "@/lib/analytics/queries";
import type { AnalyticsRange } from "@/lib/analytics/types";
import { formatShortDayLabelFR } from "@/lib/analytics/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = { title: "Quickarte — Accueil" };

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ range?: string }>;
};

const ZERO_STATS = {
  todayOrderCount: 0,
  todayRevenue: 0,
  pendingCount: 0,
};

async function safeCall<T>(
  label: string,
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[home] ${label} failed:`, err);
    return fallback;
  }
}

function parseHomeRange(raw: string | undefined): HomeRange {
  if (raw === "7d" || raw === "30d") return raw;
  return "today";
}

export default async function MerchantHomePage({
  params,
  searchParams,
}: Props) {
  const { locale } = await params;
  const { range: rangeRaw } = await searchParams;
  setRequestLocale(locale);

  const { session, business } = await requireBusiness();

  const [hasOrdering, hasLoyalty, hasAnalytics] = await Promise.all([
    safeCall(
      "hasEntitlement(online_ordering)",
      () => hasEntitlement(business.id, "online_ordering"),
      false,
    ),
    safeCall(
      "hasEntitlement(loyalty)",
      () => hasEntitlement(business.id, "loyalty"),
      false,
    ),
    safeCall(
      "hasEntitlement(analytics)",
      () => hasEntitlement(business.id, "analytics"),
      false,
    ),
  ]);

  const requestedRange = parseHomeRange(rangeRaw);
  // If user hits ?range=7d without analytics entitlement, silently fall back
  // to today rather than showing an empty/upsell state.
  const range: HomeRange = hasAnalytics ? requestedRange : "today";

  const merchantName =
    session.user.name?.trim().split(/\s+/)[0] ?? "Marchand";

  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const publicUrl = `${appUrl}/${business.slug}`;
  const displayUrl = publicUrl.replace(/^https?:\/\//, "");
  const qrDataUrl = business.slug ? await generateQRDataURL(publicUrl) : null;
  const qrFileName = `${business.slug || "quickarte"}-qr.png`;

  return (
    <>
      <header className="pt-8 px-6 pb-6 border-b-4 border-outline bg-base sticky top-0 z-20">
        <div className="flex justify-between items-start gap-4">
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <h1 className="font-sans text-xl font-normal text-ink truncate">
                Bonjour, {merchantName}
              </h1>
              <span className="font-mono text-sm tracking-tighter text-ink font-bold flex-shrink-0">
                {formatDashboardDate()}
              </span>
            </div>
            <p className="font-mono text-xs text-ink/50 uppercase tracking-widest mt-1 truncate">
              {business.name}
            </p>
          </div>
          <UserMenu
            name={session.user.name}
            email={session.user.email}
            locale={locale}
          />
        </div>
      </header>

      <div className="flex-1">
        {hasOrdering && env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? (
          <EnableNotifications
            vapidPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}
          />
        ) : null}
        {qrDataUrl ? (
          <section className="border-b-4 border-outline">
            <div className="flex gap-4 px-6 py-5 items-center">
              <div className="border-2 border-ink bg-white p-1.5 flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt={`QR code pour ${business.name}`}
                  width={100}
                  height={100}
                  className="block w-[100px] h-[100px]"
                />
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink/50">
                  Votre menu en ligne
                </span>
                <CopyButton value={displayUrl} />
                <a
                  href={qrDataUrl}
                  download={qrFileName}
                  className="font-mono text-[11px] uppercase tracking-widest text-ink/60 hover:text-accent font-bold self-start"
                >
                  Télécharger le QR →
                </a>
              </div>
            </div>
          </section>
        ) : null}

        {hasAnalytics ? (
          <div className="px-6 py-4 border-b-4 border-outline">
            <RangeToggle value={range} />
          </div>
        ) : null}

        {range === "today" ? (
          <TodayBody
            businessId={business.id}
            hasOrdering={hasOrdering}
            hasLoyalty={hasLoyalty}
          />
        ) : (
          <RangeBody
            businessId={business.id}
            range={range}
            hasLoyalty={hasLoyalty}
          />
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Today view — the "what's happening right now" default
// ─────────────────────────────────────────────────────────────

async function TodayBody({
  businessId,
  hasOrdering,
  hasLoyalty,
}: {
  businessId: string;
  hasOrdering: boolean;
  hasLoyalty: boolean;
}) {
  const [stats, recentOrders] = await Promise.all([
    safeCall("getOrderStats", () => getOrderStats(businessId), ZERO_STATS),
    safeCall(
      "getRecentOrders",
      () => getRecentOrders(businessId, 5),
      [] as Awaited<ReturnType<typeof getRecentOrders>>,
    ),
  ]);

  const newLoyaltyCustomers24h = hasLoyalty
    ? await safeCall(
        "countNewCustomersLast24h",
        () => countNewCustomersLast24h(businessId),
        0,
      )
    : 0;

  const revenueLabel = formatAmountCompact(stats.todayRevenue);

  const isGettingStarted =
    stats.todayOrderCount === 0 &&
    stats.todayRevenue === 0 &&
    stats.pendingCount === 0 &&
    recentOrders.length === 0;

  if (isGettingStarted) {
    return (
      <section>
        <SectionHeader index={1} title="Démarrage" />
        <Link
          href="/catalog/new"
          className="p-6 flex flex-col gap-2 hover:bg-black/[0.02] transition-colors group relative"
        >
          <div className="absolute left-0 top-0 w-1 h-full bg-accent scale-y-0 group-hover:scale-y-100 transition-transform origin-top" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-accent font-bold">
            Étape 1
          </span>
          <h2 className="font-sans text-[17px] font-bold leading-tight">
            Ajoutez votre premier article
          </h2>
          <p className="font-sans text-sm text-ink/60 leading-snug">
            Construisez votre menu pour que vos clients puissent commander.
          </p>
          <span className="font-mono text-[11px] uppercase tracking-widest text-ink font-bold mt-2 group-hover:text-accent transition-colors">
            + Ajouter un article →
          </span>
        </Link>
      </section>
    );
  }

  return (
    <>
      <section className="border-b-4 border-outline bg-base">
        <SectionHeader index={1} title="Aujourd'hui" />
        <div
          className={cn(
            "grid divide-x divide-y divide-outline",
            hasLoyalty
              ? "grid-cols-2"
              : hasOrdering
                ? "grid-cols-3"
                : "grid-cols-2",
          )}
        >
          <StatCard label="Commandes" value={stats.todayOrderCount} />
          <StatCard
            label="Revenu"
            unit="€"
            value={revenueLabel}
            valueClassName="text-2xl"
          />
          {hasOrdering ? (
            <StatCard
              label="En attente"
              value={stats.pendingCount}
              tone="accent"
              indicator={stats.pendingCount > 0}
            />
          ) : null}
          {hasLoyalty ? (
            <StatCard
              label="Nouveaux fidèles / 24h"
              value={newLoyaltyCustomers24h}
            />
          ) : null}
        </div>
      </section>

      <section className="border-b-4 border-outline">
        <SectionHeader index={2} title="Actions Rapides" />
        <div className="flex flex-col">
          {hasOrdering ? (
            <ActionCard
              label="Gérer les commandes"
              href="/orders"
              badge={stats.pendingCount > 0 ? stats.pendingCount : undefined}
              accent="accent"
            />
          ) : null}
          <ActionCard
            label="Modifier le catalogue"
            href="/catalog"
            accent="ink"
            isLast={!hasLoyalty}
          />
          {hasLoyalty ? (
            <ActionCard
              label="Gérer la fidélité"
              href="/loyalty"
              accent="ink"
              isLast
            />
          ) : null}
        </div>
      </section>

      {hasOrdering ? (
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
                  name={order.customerName}
                  time={formatOrderTime(order.createdAt)}
                  total={Number(order.total)}
                  status={order.status as OrderStatus}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 7d / 30d view — the collapsed analytics page
// ─────────────────────────────────────────────────────────────

async function RangeBody({
  businessId,
  range,
  hasLoyalty,
}: {
  businessId: string;
  range: Exclude<HomeRange, "today">;
  hasLoyalty: boolean;
}) {
  const analyticsRange: AnalyticsRange = range;

  const [summary, revenueByDay, products, heatmap, topCustomers] =
    await Promise.all([
      safeCall(
        "getSummary",
        () => getSummary(businessId, analyticsRange),
        {
          revenue: 0,
          orderCount: 0,
          avgTicket: 0,
          newLoyaltyCustomers: 0,
          revenueDeltaPct: null,
          bestDayOfWeek: null,
        } as Awaited<ReturnType<typeof getSummary>>,
      ),
      safeCall(
        "getRevenueByDay",
        () => getRevenueByDay(businessId, analyticsRange),
        [] as Awaited<ReturnType<typeof getRevenueByDay>>,
      ),
      safeCall(
        "getProductPerformance",
        () => getProductPerformance(businessId, analyticsRange),
        { top: [], bottom: [] } as Awaited<
          ReturnType<typeof getProductPerformance>
        >,
      ),
      safeCall(
        "getHourlyHeatmap",
        () => getHourlyHeatmap(businessId, analyticsRange),
        [] as Awaited<ReturnType<typeof getHourlyHeatmap>>,
      ),
      hasLoyalty
        ? safeCall(
            "getTopLoyalCustomers",
            () => getTopLoyalCustomers(businessId, 10),
            [] as Awaited<ReturnType<typeof getTopLoyalCustomers>>,
          )
        : Promise.resolve([] as Awaited<ReturnType<typeof getTopLoyalCustomers>>),
    ]);

  const isEmpty =
    summary.orderCount === 0 &&
    summary.revenue === 0 &&
    revenueByDay.every((d) => d.orderCount === 0);

  if (isEmpty) {
    return (
      <section className="px-6 py-10">
        <div className="border-2 border-ink p-6">
          <p className="font-mono text-[13px] text-ink/70 leading-relaxed">
            Pas encore de données sur cette période.
          </p>
        </div>
      </section>
    );
  }

  const chartData = revenueByDay.map((d) => ({
    label: formatShortDayLabelFR(new Date(`${d.date}T00:00:00`)),
    value: d.revenue,
  }));
  let highlightIndex = -1;
  let max = 0;
  for (let i = 0; i < chartData.length; i++) {
    const v = chartData[i]?.value ?? 0;
    if (v > max) {
      max = v;
      highlightIndex = i;
    }
  }

  const topProducts = products.top;
  const bottomProducts = products.bottom;
  const totalItemsSold = topProducts.reduce((s, p) => s + p.quantity, 0);
  const showBottom = bottomProducts.length > 0 && totalItemsSold >= 3;

  return (
    <>
      <SummaryLine summary={summary} range={analyticsRange} />

      <section className="border-y-4 border-outline bg-base">
        <div className="grid grid-cols-2 divide-x divide-y divide-outline">
          <StatCard
            label="Revenu"
            unit="€"
            value={formatAmountCompact(summary.revenue)}
            valueClassName="text-2xl"
          />
          <StatCard label="Commandes" value={summary.orderCount} />
          <StatCard
            label="Panier moyen"
            unit="€"
            value={formatAmountCompact(summary.avgTicket)}
            valueClassName="text-2xl"
          />
          <StatCard
            label="Nouveaux fidèles"
            value={summary.newLoyaltyCustomers}
          />
        </div>
      </section>

      <section className="border-b-4 border-outline">
        <SectionHeader index={1} title="Revenu par jour" />
        <RevenueBarChart
          data={chartData}
          highlightIndex={highlightIndex}
          emptyLabel="Pas encore de commandes sur cette période."
        />
      </section>

      <section className="border-b-4 border-outline">
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 divide-y min-[480px]:divide-y-0 min-[480px]:divide-x divide-outline">
          <div>
            <SectionHeader index={2} title="Meilleures ventes" />
            <RankedProductList
              entries={topProducts}
              emptyLabel="Pas encore de ventes sur cette période."
            />
          </div>
          <div>
            <SectionHeader index={3} title="À la traîne" />
            {showBottom ? (
              <RankedProductList
                entries={bottomProducts}
                emptyLabel="Pas assez de données pour identifier les faibles ventes."
              />
            ) : (
              <p className="px-6 py-6 font-sans text-sm text-ink/50 leading-snug">
                Pas assez de données pour identifier les faibles ventes.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className={hasLoyalty ? "border-b-4 border-outline" : undefined}>
        <SectionHeader index={4} title="Profil horaire" />
        <HourlyHeatmap
          cells={heatmap}
          emptyLabel="Pas encore assez de données pour le profil horaire."
        />
      </section>

      {hasLoyalty ? (
        <section>
          <SectionHeader index={5} title="Vos meilleurs clients" />
          <TopCustomersList
            customers={topCustomers}
            emptyLabel="Aucun client fidèle pour le moment."
          />
        </section>
      ) : null}
    </>
  );
}

type RecentOrderRowProps = {
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
          {formatAmountCompact(total)}{" "}
          <span
            className={cn(
              "text-[10px] font-normal",
              isDone ? "text-ink/40" : "text-ink/50",
            )}
          >
            €
          </span>
        </span>
        <StatusBadge status={status} />
      </div>
    </Link>
  );
}
