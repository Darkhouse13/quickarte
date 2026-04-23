import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  loyaltyCustomers,
  loyaltyTransactions,
} from "@/lib/db/schema";
import { getBusinessBySlug } from "@/lib/catalog/queries";
import { getOrderById } from "@/lib/ordering/queries";
import { getProgram } from "@/lib/loyalty/queries";
import { StatusBadge, type OrderStatus } from "@/components/ui/status-badge";
import { formatAmount } from "@/lib/utils/currency";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ orderId?: string }>;
};

const TYPE_LABELS = {
  dine_in: "Sur Place",
  takeaway: "À Emporter",
  delivery: "Livraison",
} as const;

function formatOrderNumber(orderId: string): string {
  return orderId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: Props) {
  const [{ locale, slug }, { orderId }] = await Promise.all([
    params,
    searchParams,
  ]);
  setRequestLocale(locale);

  if (!orderId) notFound();

  const [business, order] = await Promise.all([
    getBusinessBySlug(slug),
    getOrderById(orderId),
  ]);

  if (!business || !order) notFound();
  if (order.businessId !== business.id) notFound();

  const orderNumber = formatOrderNumber(order.id);
  const typeLabel =
    TYPE_LABELS[order.type as keyof typeof TYPE_LABELS] ?? order.type;
  const statusForBadge: OrderStatus =
    order.status === "cancelled" ? "completed" : order.status;
  const totalNum = Number(order.total);

  const loyaltyInfo = await buildLoyaltySummary(order.id, order.businessId);

  return (
    <main className="w-full max-w-[480px] mx-auto bg-base min-h-screen relative flex flex-col border-x border-outline/50 shadow-2xl shadow-black/5">
      <div className="relative overflow-hidden bg-ink text-base px-6 pt-12 pb-10 border-b-2 border-ink">
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, currentColor 0 1px, transparent 1px 12px)",
            }}
          />
        </div>
        <div className="relative">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-accent flex items-center justify-center flex-shrink-0">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="square"
                strokeLinejoin="miter"
                className="text-base"
              >
                <path d="M5 12l5 5L20 7" />
              </svg>
            </div>
            <span className="font-mono text-[11px] uppercase tracking-widest text-base/60">
              Confirmation
            </span>
          </div>
          <h1 className="font-mono font-bold text-3xl tracking-tighter uppercase leading-none">
            Commande
            <br />
            Reçue.
          </h1>
          <div className="mt-8 flex items-baseline justify-between gap-4 pt-6 border-t border-base/20">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-base/50 mb-1">
                N° Commande
              </p>
              <p className="font-mono font-bold text-xl tracking-tight">
                #{orderNumber}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusBadge status={statusForBadge} />
              <PaymentStatusBadge status={order.paymentStatus} />
            </div>
          </div>
        </div>
      </div>

      <section className="px-6 py-6 border-b-4 border-outline">
        <div className="flex items-baseline justify-between mb-5">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[11px] tracking-widest text-ink/40">
              01
            </span>
            <h2 className="font-mono font-bold text-[14px] uppercase tracking-widest">
              Détails
            </h2>
          </div>
        </div>
        <dl className="flex flex-col">
          <DetailRow label="Boutique" value={business.name} />
          <DetailRow label="Mode" value={typeLabel} />
          {order.tableNumber ? (
            <DetailRow label="Table" value={`N° ${order.tableNumber}`} mono />
          ) : null}
          <DetailRow label="Client" value={order.customerName} />
          {order.customerPhone ? (
            <DetailRow label="Téléphone" value={order.customerPhone} mono />
          ) : null}
          <DetailRow
            label="Passée le"
            value={formatDateTime(new Date(order.createdAt))}
          />
        </dl>
      </section>

      <section className="px-6 py-6 border-b-4 border-outline">
        <div className="flex items-baseline justify-between mb-5">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[11px] tracking-widest text-ink/40">
              02
            </span>
            <h2 className="font-mono font-bold text-[14px] uppercase tracking-widest">
              Articles
            </h2>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink/40">
            {order.items.length}{" "}
            {order.items.length === 1 ? "article" : "articles"}
          </span>
        </div>
        <ul className="flex flex-col">
          {order.items.map((item) => {
            const subtotal = Number(item.subtotal);
            const unit = Number(item.unitPrice);
            return (
              <li
                key={item.id}
                className="flex gap-3 py-3 border-b border-outline last:border-b-0"
              >
                <span className="font-mono font-bold text-[13px] w-8 flex-shrink-0 text-ink/40">
                  ×{item.quantity}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold leading-tight">
                    {item.product?.name ?? "Article supprimé"}
                  </p>
                  <p className="font-mono text-[11px] text-ink/50 mt-1">
                    {formatAmount(unit)} € × {item.quantity}
                  </p>
                </div>
                <span className="font-mono font-bold text-[14px] self-center whitespace-nowrap">
                  {formatAmount(subtotal)}{" "}
                  <span className="text-[10px] text-ink/50">€</span>
                </span>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 pt-4 border-t-2 border-ink flex justify-between items-baseline">
          <span className="font-mono text-[12px] uppercase tracking-widest font-bold">
            Total
          </span>
          <span className="font-mono font-bold text-2xl tracking-tight">
            {formatAmount(totalNum)}{" "}
            <span className="text-sm font-sans font-normal text-ink/60">
              €
            </span>
          </span>
        </div>
      </section>

      {order.notes ? (
        <section className="px-6 py-6 border-b-4 border-outline">
          <div className="flex items-baseline gap-3 mb-4">
            <span className="font-mono text-[11px] tracking-widest text-ink/40">
              03
            </span>
            <h2 className="font-mono font-bold text-[14px] uppercase tracking-widest">
              Notes
            </h2>
          </div>
          <p className="text-[14px] leading-relaxed text-ink/80 border-l-2 border-accent pl-4">
            {order.notes}
          </p>
        </section>
      ) : null}

      {loyaltyInfo ? (
        <section className="px-6 py-6 border-b-4 border-outline">
          <div className="border-2 border-ink bg-accent/5 p-5 flex flex-col gap-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-accent font-bold">
              Programme fidélité
            </span>
            <p className="text-[14px] leading-snug text-ink">
              Vous avez{" "}
              <span className="font-bold">
                {formatBalance(loyaltyInfo.balance)}{" "}
                {loyaltyInfo.unitLabel(loyaltyInfo.balance)}
              </span>
              .
              {loyaltyInfo.remaining > 0 ? (
                <>
                  {" "}
                  Encore{" "}
                  <span className="font-bold">
                    {formatBalance(loyaltyInfo.remaining)}{" "}
                    {loyaltyInfo.unitLabel(loyaltyInfo.remaining)}
                  </span>{" "}
                  pour {loyaltyInfo.rewardDescription}.
                </>
              ) : (
                <>
                  {" "}
                  Votre récompense est prête&nbsp;: {loyaltyInfo.rewardDescription}.
                </>
              )}
            </p>
          </div>
        </section>
      ) : null}

      <section className="px-6 py-8 flex-1">
        <div className="border-2 border-ink bg-ink/[0.02] p-5">
          <p className="font-mono text-[11px] uppercase tracking-widest text-ink/60 mb-2">
            Prochaine étape
          </p>
          <p className="text-[14px] leading-snug">
            Votre commande a été transmise à la cuisine. Conservez le numéro{" "}
            <span className="font-mono font-bold">#{orderNumber}</span> pour la
            retirer.
          </p>
        </div>
      </section>

      <div className="sticky bottom-0 left-0 w-full bg-base border-t-2 border-ink p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <Link
          href={`/${locale}/${slug}`}
          className="w-full bg-accent text-base px-6 py-4 flex justify-between items-center hover:bg-ink transition-colors border-2 border-transparent hover:border-base focus:outline-none focus:ring-4 focus:ring-accent/20"
        >
          <span className="font-bold uppercase tracking-widest text-sm">
            Retour au menu
          </span>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="square"
            strokeLinejoin="miter"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </main>
  );
}

type PaymentStatus = "unpaid" | "paid" | "refunded" | "failed";

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  if (status === "paid") {
    return (
      <span className="px-2 py-0.5 bg-accent text-base text-[9px] uppercase font-mono font-bold tracking-widest leading-none border border-accent">
        Paiement confirmé
      </span>
    );
  }
  if (status === "refunded") {
    return (
      <span className="px-2 py-0.5 bg-base/10 text-base/70 text-[9px] uppercase font-mono font-bold tracking-widest leading-none border border-base/30">
        Remboursé
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="px-2 py-0.5 bg-base/10 text-accent text-[9px] uppercase font-mono font-bold tracking-widest leading-none border border-accent/60">
        Paiement échoué
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 bg-transparent text-base/60 text-[9px] uppercase font-mono font-bold tracking-widest leading-none border border-base/30">
      À régler sur place
    </span>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between items-baseline py-2.5 border-b border-outline last:border-b-0 gap-4">
      <dt className="font-mono text-[11px] uppercase tracking-widest text-ink/50 flex-shrink-0">
        {label}
      </dt>
      <dd
        className={`text-[14px] text-ink text-right truncate ${
          mono ? "font-mono" : "font-sans"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function formatBalance(n: number): string {
  return n % 1 === 0 ? n.toString() : n.toFixed(2).replace(".", ",");
}

type LoyaltySummary = {
  balance: number;
  threshold: number;
  remaining: number;
  rewardDescription: string;
  unitLabel: (n: number) => string;
};

async function buildLoyaltySummary(
  orderId: string,
  businessId: string,
): Promise<LoyaltySummary | null> {
  const ledger = await db.query.loyaltyTransactions.findFirst({
    where: and(
      eq(loyaltyTransactions.orderId, orderId),
      eq(loyaltyTransactions.type, "earn"),
    ),
    orderBy: [desc(loyaltyTransactions.createdAt)],
  });
  if (!ledger) return null;

  const program = await getProgram(businessId);
  if (!program) return null;

  const customer = await db.query.loyaltyCustomers.findFirst({
    where: eq(loyaltyCustomers.id, ledger.customerId),
  });
  if (!customer) return null;

  const balance = Number(customer.balance);
  const threshold = Number(program.rewardThreshold);
  const remaining = Math.max(threshold - balance, 0);
  const unitLabel = (n: number) =>
    program.accrualType === "per_visit"
      ? n === 1
        ? "tampon"
        : "tampons"
      : n === 1
        ? "point"
        : "points";

  return {
    balance,
    threshold,
    remaining,
    rewardDescription: program.rewardDescription,
    unitLabel,
  };
}
