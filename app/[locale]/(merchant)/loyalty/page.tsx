import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { requireBusiness } from "@/lib/auth/get-business";
import { Gated } from "@/components/entitlements/gated";
import { UpsellCard } from "@/components/entitlements/upsell-card";
import { hasEntitlement } from "@/lib/entitlements/queries";
import { getProgram, listCustomers } from "@/lib/loyalty/queries";
import { formatPhoneForDisplay } from "@/lib/utils/phone";
import { LoyaltyProgramForm } from "@/components/merchant/loyalty-program-form";
import { LoyaltyAccrualPanel } from "@/components/merchant/loyalty-accrual-panel";
import {
  LoyaltyCustomerList,
  type LoyaltyCustomerRow,
} from "@/components/merchant/loyalty-customer-list";

export const metadata = { title: "Quickarte — Fidélité" };

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string; settings?: string }>;
};

const PAGE_SIZE = 20;

export default async function LoyaltyPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { business } = await requireBusiness();

  return (
    <Gated
      module="loyalty"
      businessId={business.id}
      fallback={<LoyaltyUpsell />}
    >
      <LoyaltyBody businessId={business.id} searchParams={searchParams} />
    </Gated>
  );
}

async function LoyaltyBody({
  businessId,
  searchParams,
}: {
  businessId: string;
  searchParams: Props["searchParams"];
}) {
  const { q, page, settings } = await searchParams;
  const program = await getProgram(businessId);
  const showSettings = settings === "1";

  if (!program || showSettings) {
    const initial = program
      ? {
          name: program.name,
          accrualType: program.accrualType,
          accrualRate: Number(program.accrualRate)
            .toString()
            .replace(".", ","),
          rewardThreshold: Number(program.rewardThreshold)
            .toString()
            .replace(".", ","),
          rewardDescription: program.rewardDescription,
        }
      : null;
    return (
      <>
        <header className="pt-8 px-6 pb-6 border-b-4 border-outline bg-base sticky top-0 z-20 flex justify-between items-baseline">
          <h1 className="font-mono font-bold text-2xl tracking-tighter uppercase leading-none">
            Fidélité
          </h1>
          {program ? (
            <Link
              href="/loyalty"
              className="font-mono text-[11px] uppercase tracking-widest text-ink/50 hover:text-ink"
            >
              Annuler
            </Link>
          ) : null}
        </header>

        {!program ? (
          <section className="px-6 py-6 border-b-4 border-outline">
            <p className="font-sans text-[15px] text-ink/80 leading-snug">
              Configurez votre programme de fidélité en une étape. Vos clients
              cumulent des tampons ou des points à chaque passage, et
              déclenchent automatiquement une récompense.
            </p>
          </section>
        ) : null}

        <LoyaltyProgramForm initial={initial} />
      </>
    );
  }

  const currentPage = Math.max(1, Number(page) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;
  const { customers, total } = await listCustomers(businessId, {
    limit: PAGE_SIZE,
    offset,
    search: q,
  });

  const rows: LoyaltyCustomerRow[] = customers.map((c) => ({
    id: c.id,
    phoneDisplay: formatPhoneForDisplay(c.phone),
    name: c.name,
    balance: Number(c.balance),
    threshold: Number(program.rewardThreshold),
    lastVisitLabel: c.lastVisitAt
      ? formatLastVisit(c.lastVisitAt)
      : "Aucun passage",
  }));

  const accrualType = program.accrualType;

  return (
    <>
      <header className="pt-8 px-6 pb-6 border-b-4 border-outline bg-base sticky top-0 z-20 flex justify-between items-baseline">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <h1 className="font-mono font-bold text-2xl tracking-tighter uppercase leading-none">
            Fidélité
          </h1>
          <p className="font-mono text-xs text-ink/60 uppercase tracking-widest mt-1 truncate">
            {program.name ?? program.rewardDescription}
          </p>
        </div>
        <Link
          href="/loyalty?settings=1"
          aria-label="Paramètres du programme"
          className="w-10 h-10 border-2 border-ink flex items-center justify-center hover:bg-ink hover:text-base transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20"
        >
          <GearIcon />
        </Link>
      </header>

      <LoyaltyAccrualPanel
        accrualType={accrualType}
        threshold={Number(program.rewardThreshold)}
        rewardDescription={program.rewardDescription}
      />

      <LoyaltyCustomerList
        customers={rows}
        total={total}
        pageSize={PAGE_SIZE}
        currentPage={currentPage}
        initialSearch={q ?? ""}
      />
    </>
  );
}

function LoyaltyUpsell() {
  return (
    <>
      <header className="pt-8 px-6 pb-6 border-b-4 border-outline bg-base sticky top-0 z-20">
        <h1 className="font-mono font-bold text-2xl tracking-tighter uppercase leading-none">
          Fidélité
        </h1>
      </header>
      <UpsellCard module="loyalty" />
    </>
  );
}

function GearIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function formatLastVisit(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 30) return `Il y a ${diffD} j`;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
