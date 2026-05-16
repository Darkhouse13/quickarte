// MERCHANT-OWNED DATA: phones are shown in full on this page (no masking).
// This is the merchant's own loyalty database — owners and managers must be
// able to identify a customer when granting credits or auditing reviews. The
// phone-masking pattern from Phase 0/1 applies only to surfaces shared with
// cashier/waiter/kitchen roles (the orders board), not to owner/manager-only
// surfaces like /loyalty/*.
import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireBusiness } from "@/lib/auth/get-business";
import { Gated } from "@/components/entitlements/gated";
import { UpsellCard } from "@/components/entitlements/upsell-card";
import { assertRole } from "@/lib/identity/permissions";
import {
  getCustomerSummary,
  listCustomerLedger,
} from "@/lib/loyalty/credits-queries";
import { InvalidPhoneError, formatPhoneForDisplay } from "@/lib/utils/phone";
import { CustomerActionBar } from "@/components/merchant/loyalty/customer-action-bar";
import { TransactionsTable } from "@/components/merchant/loyalty/transactions-table";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = { title: "Quickarte — Habitué" };

const OWNER_MANAGER = ["owner", "manager"] as const;

type Props = {
  params: Promise<{ locale: string; phoneNormalized: string }>;
};

export default async function CustomerDetailPage({ params }: Props) {
  const { locale, phoneNormalized: rawPhone } = await params;
  setRequestLocale(locale);

  const phoneNormalized = decodeURIComponent(rawPhone);
  const { business } = await requireBusiness();

  return (
    <Gated module="loyalty" businessId={business.id} fallback={<UpsellCard module="loyalty" />}>
      <CustomerDetailBody businessId={business.id} phoneNormalized={phoneNormalized} />
    </Gated>
  );
}

async function CustomerDetailBody({
  businessId,
  phoneNormalized,
}: {
  businessId: string;
  phoneNormalized: string;
}) {
  const { session } = await requireBusiness();
  try {
    await assertRole(session.user.id, businessId, [...OWNER_MANAGER]);
  } catch {
    return (
      <div role="alert" className="px-6 py-12">
        <h1 className="font-mono font-bold text-2xl tracking-tighter uppercase">
          Réservé aux propriétaires
        </h1>
      </div>
    );
  }

  let summary;
  let ledger;
  try {
    [summary, ledger] = await Promise.all([
      getCustomerSummary(businessId, phoneNormalized),
      listCustomerLedger(businessId, phoneNormalized, { limit: 20 }),
    ]);
  } catch (err) {
    if (err instanceof InvalidPhoneError) notFound();
    throw err;
  }

  const balance = summary.member?.balance ?? 0;
  const phoneDisplay = formatPhoneForDisplay(phoneNormalized);

  return (
    <div className="flex flex-col">
      <header className="pt-8 px-6 pb-6 border-b-4 border-outline">
        <Link
          href="/loyalty?tab=clients"
          className="inline-flex items-center font-mono text-[11px] uppercase tracking-widest text-ink/55 hover:text-ink"
        >
          ← Retour
        </Link>
        <div className="mt-4 flex items-baseline gap-3 flex-wrap">
          <h1 className="font-mono font-bold text-[22px] sm:text-2xl tracking-tighter tabular-nums">
            {phoneDisplay}
          </h1>
          <span className="font-sans text-[14px] text-ink/55">
            {summary.firstKnownName ?? "Sans nom"}
          </span>
        </div>
      </header>

      <section className="px-6 pt-8 pb-7 border-b border-outline">
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink/40">
          Solde
        </p>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="font-mono font-bold tabular-nums leading-none tracking-tight text-[64px] sm:text-[96px]">
            {balance}
          </span>
          <span className="font-mono font-bold text-ink/50 text-lg sm:text-2xl">
            crédits
          </span>
        </div>
      </section>

      <CustomerActionBar
        businessId={businessId}
        phoneNormalized={phoneNormalized}
        currentBalance={balance}
      />

      <section className="px-6 py-6 flex flex-col gap-4">
        <h2 className="font-mono font-bold text-[11px] uppercase tracking-widest text-ink/40">
          Mouvements
        </h2>
        <TransactionsTable
          initialRows={ledger.rows}
          initialHasMore={ledger.hasMore}
          businessId={businessId}
          phoneNormalized={phoneNormalized}
        />
      </section>
    </div>
  );
}
