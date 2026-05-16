import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import {
  addDaysToBusinessDateParam,
  DEFAULT_BUSINESS_TIMEZONE,
  formatBusinessTime,
  getBusinessDateParam,
  getBusinessDayBoundsForDateString,
  parseBusinessDateParam,
} from "@/lib/business/business-day";
import {
  formatCountDelta,
  formatMadAmount,
  formatPercentDelta,
} from "@/lib/business/format";
import { requireBusiness } from "@/lib/auth/get-business";
import { assertRole } from "@/lib/identity/permissions";
import {
  CLOSE_OF_DAY_ROLES,
  isForbiddenRoleError,
} from "@/lib/analytics/close-of-day-access";
import { getDailyClose } from "@/lib/analytics/close-of-day";
import {
  getOrdersForDay,
  parsePosStatusFilter,
  parseOrderStatusFilters,
  type OrderListItemFilters,
  type OrderStatus,
  summarizePosCountsFr,
} from "@/lib/analytics/close-of-day-orders";
import {
  formatPosStatusFr,
  formatOrderStatusFr,
  formatOrderTypeFr,
} from "@/lib/analytics/close-of-day-csv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = { title: "Quickarte - Clôture" };

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    date?: string | string[];
    posStatus?: string | string[];
    statusIn?: string | string[];
    tableNumberQuery?: string | string[];
  }>;
};

const STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: "pending", label: "Reçue" },
  { value: "preparing", label: "En préparation" },
  { value: "ready", label: "Prête" },
  { value: "completed", label: "Servie" },
  { value: "cancelled", label: "Annulée" },
];

const POS_STATUS_OPTIONS = [
  { value: "pending", label: "À entrer" },
  { value: "entered", label: "Entrée" },
  { value: "skipped", label: "Sautée" },
] as const;

export default async function CloturePage({ params, searchParams }: Props) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);

  const { session, business } = await requireBusiness();
  try {
    await assertRole(session.user.id, business.id, CLOSE_OF_DAY_ROLES);
  } catch (error) {
    if (isForbiddenRoleError(error)) return <CloseForbidden />;
    throw error;
  }

  const timezone = business.timezone || DEFAULT_BUSINESS_TIMEZONE;
  const todayParam = getBusinessDateParam(new Date(), timezone);
  const requestedDate = firstParam(query.date);
  const dateParam =
    requestedDate && parseBusinessDateParam(requestedDate)
      ? requestedDate
      : todayParam;
  const bounds =
    getBusinessDayBoundsForDateString(dateParam, timezone) ??
    getBusinessDayBoundsForDateString(todayParam, timezone);

  if (!bounds) {
    throw new Error("Unable to compute close-of-day bounds");
  }

  const selectedStatus = firstParam(query.statusIn);
  const statusIn = parseOrderStatusFilters(selectedStatus);
  const posStatus = parsePosStatusFilter(firstParam(query.posStatus));
  const posCoexistenceEnabled =
    business.settings?.posCoexistenceEnabled === true;
  const tableNumberQuery =
    firstParam(query.tableNumberQuery)?.trim() || undefined;
  const filters: OrderListItemFilters = {
    statusIn,
    posStatus: posCoexistenceEnabled ? posStatus : undefined,
    tableNumberQuery,
  };
  const activeStatus = statusIn?.[0];
  const filtersActive = Boolean(activeStatus || filters.posStatus || tableNumberQuery);

  const [dailyClose, orders, allOrdersForPosCounts] = await Promise.all([
    getDailyClose(business.id, bounds, { timezone }),
    getOrdersForDay(business.id, bounds, filters),
    posCoexistenceEnabled
      ? getOrdersForDay(business.id, bounds, {})
      : Promise.resolve([]),
  ]);
  const posSummary = summarizePosCountsFr(allOrdersForPosCounts);

  const previousDate = addDaysToBusinessDateParam(dateParam, -1) ?? dateParam;
  const nextDate = addDaysToBusinessDateParam(dateParam, 1) ?? dateParam;
  const showNext = dateParam < todayParam;

  const { totals, byType, byStatus, comparison } = dailyClose;
  const comparisonWeekday = capitalizeFirst(
    dailyClose.date.label.split(" ")[0] ?? "Jour",
  );
  const hasLastWeek = !(
    comparison.lastWeekRevenueMad === 0 && comparison.lastWeekOrderCount === 0
  );
  const deltaTag =
    [
      formatPercentDelta(totals.revenueMad, comparison.lastWeekRevenueMad),
      formatCountDelta(totals.orderCount, comparison.lastWeekOrderCount),
    ]
      .filter((part): part is string => Boolean(part))
      .join(" · ") || null;

  const typeRows = [
    { label: "Sur place", data: byType.dine_in },
    { label: "À emporter", data: byType.takeaway },
    { label: "Livraison", data: byType.delivery },
  ];
  const statusRows = [
    { label: "Reçue", count: byStatus.pending },
    { label: "En préparation", count: byStatus.preparing },
    { label: "Prête", count: byStatus.ready },
    { label: "Servie", count: byStatus.completed },
    { label: "Annulée", count: byStatus.cancelled },
  ];

  const navLink =
    "hover:text-ink hover:underline underline-offset-4 transition-colors";

  return (
    <div className="cloture-print">
      {/* Date band */}
      <header className="pt-8 px-6 pb-6 border-b border-outline">
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-mono font-bold text-[28px] sm:text-[32px] leading-none tracking-tight">
            {capitalizeFirst(dailyClose.date.label)}
          </h1>
          <nav
            aria-label="Navigation jour"
            className="cloture-print-hide shrink-0 flex items-center gap-3 pt-1 font-mono text-[11px] uppercase tracking-widest text-ink/60"
          >
            <Link href={clotureHref(previousDate, filters)} className={navLink}>
              Précédent
            </Link>
            <Link href={clotureHref(todayParam, filters)} className={navLink}>
              Aujourd&apos;hui
            </Link>
            {showNext ? (
              <Link href={clotureHref(nextDate, filters)} className={navLink}>
                Suivant
              </Link>
            ) : null}
          </nav>
        </div>
      </header>

      {/* Hero KPI band */}
      <section className="px-6 pt-8 pb-7 border-b border-outline">
        <div className="flex items-baseline gap-2">
          <span className="font-mono font-bold tabular-nums leading-none tracking-tight text-[64px] sm:text-[96px]">
            {formatMadAmount(totals.revenueMad)}
          </span>
          <span className="font-mono font-bold text-ink/50 text-lg sm:text-2xl">
            MAD
          </span>
        </div>

        <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[13px] tabular-nums text-ink/60">
          <span>
            {totals.orderCount}{" "}
            {totals.orderCount === 1 ? "commande" : "commandes"}
          </span>
          <span aria-hidden className="text-ink/30">
            ·
          </span>
          <span>
            Ticket moyen {formatMadAmount(totals.averageTicketMad)} MAD
          </span>
          <span aria-hidden className="text-ink/30">
            ·
          </span>
          <span>
            {totals.cancelledCount}{" "}
            {totals.cancelledCount === 1 ? "annulée" : "annulées"}
          </span>
        </p>

        {hasLastWeek ? (
          <p className="mt-2 font-mono text-[12px] tabular-nums text-ink/50">
            {comparisonWeekday} dernier :{" "}
            {formatMadAmount(comparison.lastWeekRevenueMad)} MAD ·{" "}
            {comparison.lastWeekOrderCount}{" "}
            {comparison.lastWeekOrderCount === 1 ? "commande" : "commandes"}
            {deltaTag ? (
              <span className="ml-2 text-ink/70">{deltaTag}</span>
            ) : null}
          </p>
        ) : (
          <p className="mt-2 font-mono text-[12px] text-ink/50">
            Pas de données pour la semaine dernière.
          </p>
        )}
        {posCoexistenceEnabled ? (
          <p className="mt-2 font-mono text-[12px] tabular-nums text-ink/50">
            {posSummary}
          </p>
        ) : null}
      </section>

      {/* Breakdowns band */}
      <section className="px-6 py-6 border-b border-outline grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-2 font-mono font-bold text-[11px] uppercase tracking-widest text-ink/40">
            Par type
          </h2>
          <table className="w-full border-y-2 border-ink font-mono text-[13px]">
            <thead>
              <tr className="border-b border-outline text-[10px] uppercase tracking-widest text-ink/40">
                <th scope="col" className="py-1.5 pr-2 text-left font-bold">
                  Type
                </th>
                <th scope="col" className="py-1.5 px-2 text-right font-bold">
                  Cmd
                </th>
                <th scope="col" className="py-1.5 pl-2 text-right font-bold">
                  Revenu
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline">
              {typeRows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                    {row.label}
                  </th>
                  <td className="py-1.5 px-2 text-right tabular-nums">
                    {row.data.count}
                  </td>
                  <td className="py-1.5 pl-2 text-right tabular-nums">
                    {formatMadAmount(row.data.revenueMad)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="mb-2 font-mono font-bold text-[11px] uppercase tracking-widest text-ink/40">
            Par statut
          </h2>
          <table className="w-full border-y-2 border-ink font-mono text-[13px]">
            <thead>
              <tr className="border-b border-outline text-[10px] uppercase tracking-widest text-ink/40">
                <th scope="col" className="py-1.5 pr-2 text-left font-bold">
                  Statut
                </th>
                <th scope="col" className="py-1.5 pl-2 text-right font-bold">
                  Cmd
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline">
              {statusRows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                    {row.label}
                  </th>
                  <td className="py-1.5 pl-2 text-right tabular-nums">
                    {row.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Orders band */}
      <section>
        <div className="px-6 pt-6 pb-3 flex items-baseline justify-between gap-4">
          <h2 className="font-mono font-bold text-[11px] uppercase tracking-widest text-ink/40">
            Commandes
          </h2>
          <span className="font-mono text-[11px] tabular-nums text-ink/40">
            {orders.length}
          </span>
        </div>

          <div className="cloture-print-hide sticky top-0 z-10 bg-base border-y border-outline px-6 py-4 flex flex-col gap-3">
          {posCoexistenceEnabled ? (
            <form method="get" className="flex flex-wrap gap-2">
              <input type="hidden" name="date" value={dateParam} />
              {activeStatus ? (
                <input type="hidden" name="statusIn" value={activeStatus} />
              ) : null}
              {tableNumberQuery ? (
                <input
                  type="hidden"
                  name="tableNumberQuery"
                  value={tableNumberQuery}
                />
              ) : null}
              <button
                type="submit"
                name="posStatus"
                value=""
                className={pillClass(!filters.posStatus)}
              >
                Tout
              </button>
              {POS_STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="submit"
                  name="posStatus"
                  value={option.value}
                  className={pillClass(filters.posStatus === option.value)}
                >
                  {option.label}
                </button>
              ))}
            </form>
          ) : null}
          <form method="get" className="flex flex-wrap gap-2">
            <input type="hidden" name="date" value={dateParam} />
            {filters.posStatus ? (
              <input type="hidden" name="posStatus" value={filters.posStatus} />
            ) : null}
            {tableNumberQuery ? (
              <input
                type="hidden"
                name="tableNumberQuery"
                value={tableNumberQuery}
              />
            ) : null}
            <button
              type="submit"
              name="statusIn"
              value=""
              className={pillClass(!activeStatus)}
            >
              Tous
            </button>
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="submit"
                name="statusIn"
                value={option.value}
                className={pillClass(activeStatus === option.value)}
              >
                {option.label}
              </button>
            ))}
          </form>

          <div className="flex flex-wrap items-center gap-3">
            <form method="get" className="flex items-center">
              <input type="hidden" name="date" value={dateParam} />
              {activeStatus ? (
                <input type="hidden" name="statusIn" value={activeStatus} />
              ) : null}
              {filters.posStatus ? (
                <input type="hidden" name="posStatus" value={filters.posStatus} />
              ) : null}
              <input
                type="search"
                name="tableNumberQuery"
                defaultValue={tableNumberQuery ?? ""}
                placeholder="N° de table"
                aria-label="Filtrer par numéro de table"
                className="w-[140px] border border-outline bg-white px-3 py-2 font-mono text-[12px] focus:border-ink focus:outline-none"
              />
            </form>

            {filtersActive ? (
              <Link
                href={clotureHref(dateParam, {})}
                className="font-mono text-[11px] uppercase tracking-widest text-ink/50 hover:text-ink underline underline-offset-4"
              >
                Réinitialiser
              </Link>
            ) : null}

            <a
              href={exportHref(dateParam, filters)}
              className="ml-auto inline-flex items-center min-h-[44px] border-2 border-ink px-4 font-mono text-[11px] font-bold uppercase tracking-widest hover:bg-ink hover:text-base transition-colors"
            >
              Exporter en CSV
            </a>
          </div>
        </div>

        {orders.length === 0 ? (
          <p className="px-6 py-10 font-mono text-[13px] text-ink/50">
            {filtersActive
              ? "Aucune commande ne correspond à ces filtres."
              : "Aucune commande sur cette journée."}
          </p>
        ) : (
          <div className="cloture-orders-scroll overflow-x-auto">
            <table className="w-full border-collapse border-y-2 border-ink font-mono text-[12px]">
              <thead>
                <tr className="border-b border-outline text-[10px] uppercase tracking-widest text-ink/40">
                  <th scope="col" className="py-2 px-3 text-left font-bold">
                    Heure
                  </th>
                  <th scope="col" className="py-2 px-3 text-left font-bold">
                    Réf
                  </th>
                  <th scope="col" className="py-2 px-3 text-left font-bold">
                    Type
                  </th>
                  <th scope="col" className="py-2 px-3 text-left font-bold">
                    Table
                  </th>
                  <th scope="col" className="py-2 px-3 text-left font-bold">
                    Articles
                  </th>
                  <th scope="col" className="py-2 px-3 text-right font-bold">
                    Total
                  </th>
                  <th scope="col" className="py-2 px-3 text-left font-bold">
                    Statut
                  </th>
                  <th scope="col" className="py-2 px-3 text-left font-bold">
                    Caisse
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="py-2 px-3 align-top tabular-nums whitespace-nowrap">
                      {formatBusinessTime(order.createdAt, timezone)}
                    </td>
                    <td className="py-2 px-3 align-top uppercase whitespace-nowrap">
                      {order.shortRef}
                    </td>
                    <td className="py-2 px-3 align-top whitespace-nowrap">
                      {formatOrderTypeFr(order.type)}
                    </td>
                    <td className="py-2 px-3 align-top tabular-nums whitespace-nowrap">
                      {order.tableNumber ?? "—"}
                    </td>
                    <td className="py-2 px-3 align-top md:max-w-[260px] md:truncate">
                      {order.itemsSummary}
                    </td>
                    <td
                      className={`py-2 px-3 align-top text-right tabular-nums whitespace-nowrap ${
                        order.status === "cancelled"
                          ? "line-through text-ink/40"
                          : ""
                      }`}
                    >
                      {formatMadAmount(order.totalMad)}{" "}
                      <span className="text-ink/40">MAD</span>
                    </td>
                    <td className="py-2 px-3 align-top whitespace-nowrap">
                      {formatOrderStatusFr(order.status)}
                    </td>
                    <td className="py-2 px-3 align-top whitespace-nowrap">
                      {formatPosStatusFr(order.posStatus, order.posReference)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function CloseForbidden() {
  return (
    <div role="alert">
      <p>403 / Accès refusé</p>
      <h1>Clôture réservée</h1>
      <p>
        Cette page est accessible aux rôles propriétaire, gérant et caisse.
        Demandez à votre responsable de vous donner les bons accès.
      </p>
    </div>
  );
}

function pillClass(active: boolean): string {
  const shared =
    "px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors";
  return active
    ? `${shared} bg-ink text-base border border-ink`
    : `${shared} bg-base text-ink border border-outline hover:border-ink`;
}

function capitalizeFirst(value: string): string {
  const first = value[0];
  return first ? first.toUpperCase() + value.slice(1) : value;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function clotureHref(dateParam: string, filters: OrderListItemFilters): string {
  const params = new URLSearchParams({ date: dateParam });
  appendFilters(params, filters);
  return `/cloture?${params.toString()}`;
}

function exportHref(dateParam: string, filters: OrderListItemFilters): string {
  const params = new URLSearchParams({ date: dateParam });
  appendFilters(params, filters);
  return `/api/cloture/export?${params.toString()}`;
}

function appendFilters(
  params: URLSearchParams,
  filters: OrderListItemFilters,
): void {
  if (filters.statusIn?.[0]) params.set("statusIn", filters.statusIn[0]);
  if (filters.posStatus) params.set("posStatus", filters.posStatus);
  if (filters.tableNumberQuery) {
    params.set("tableNumberQuery", filters.tableNumberQuery);
  }
}
