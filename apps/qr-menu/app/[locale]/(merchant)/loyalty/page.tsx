import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { requireBusiness } from "@/lib/auth/get-business";
import { Gated } from "@/components/entitlements/gated";
import { UpsellCard } from "@/components/entitlements/upsell-card";
import { assertRole } from "@/lib/identity/permissions";
import {
  getCreditProgramSnapshot,
  listCreditCustomers,
  listGoogleReviewGrants,
  listRedemptionListings,
  listAddableRedemptionProducts,
} from "@/lib/loyalty/credits-queries";
import { LoyaltyTabs, type LoyaltyTabId } from "@/components/merchant/loyalty/loyalty-tabs";
import { ProgrammeTab } from "@/components/merchant/loyalty/programme-tab";
import { AvisGoogleTab } from "@/components/merchant/loyalty/avis-google-tab";
import { RecompensesTab } from "@/components/merchant/loyalty/recompenses-tab";
import { ClientsTab } from "@/components/merchant/loyalty/clients-tab";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = { title: "Quickarte — Mes habitués" };

const OWNER_MANAGER = ["owner", "manager"] as const;

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
};

const TABS: { id: LoyaltyTabId; slug: string; label: string }[] = [
  { id: "programme", slug: "programme", label: "Programme" },
  { id: "avis-google", slug: "avis-google", label: "Avis Google" },
  { id: "recompenses", slug: "recompenses", label: "Récompenses" },
  { id: "clients", slug: "clients", label: "Clients" },
];

function parseTab(raw: string | undefined): LoyaltyTabId {
  const found = TABS.find((t) => t.slug === raw);
  return found ? found.id : "programme";
}

export default async function LoyaltyPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { business } = await requireBusiness();

  return (
    <Gated module="loyalty" businessId={business.id} fallback={<LoyaltyUpsell />}>
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
  const { session } = await requireBusiness();
  try {
    await assertRole(session.user.id, businessId, [...OWNER_MANAGER]);
  } catch {
    return <ForbiddenView />;
  }

  const { tab } = await searchParams;
  const activeTab = parseTab(tab);

  const snapshot = await getCreditProgramSnapshot(businessId);
  const enabled = Boolean(snapshot.program?.enabled);

  return (
    <div className="flex flex-col">
      <PageHeader
        snapshot={snapshot}
        active={activeTab}
        creditLabelPlural={(snapshot.program?.creditLabel ?? "Crédits").toLowerCase()}
      />

      {!enabled ? (
        <p className="px-6 py-3 border-b border-outline font-sans text-[13px] text-ink/60">
          Programme désactivé. Les clients ne gagnent ni n&apos;utilisent de crédits actuellement.
        </p>
      ) : null}

      <LoyaltyTabs active={activeTab} tabs={TABS} />

      <ActiveTabContent businessId={businessId} active={activeTab} />
    </div>
  );
}

async function ActiveTabContent({
  businessId,
  active,
}: {
  businessId: string;
  active: LoyaltyTabId;
}) {
  if (active === "programme") {
    const { program } = await getCreditProgramSnapshot(businessId);
    return <ProgrammeTab businessId={businessId} program={program} />;
  }
  if (active === "avis-google") {
    const [{ program, googlePlaceId }, grants] = await Promise.all([
      getCreditProgramSnapshot(businessId),
      listGoogleReviewGrants(businessId, { limit: 20 }),
    ]);
    return (
      <AvisGoogleTab
        businessId={businessId}
        program={program}
        googlePlaceId={googlePlaceId}
        grants={grants}
      />
    );
  }
  if (active === "recompenses") {
    const [listings, addable] = await Promise.all([
      listRedemptionListings(businessId),
      listAddableRedemptionProducts(businessId),
    ]);
    return (
      <RecompensesTab
        businessId={businessId}
        listings={listings}
        addable={addable}
      />
    );
  }
  // clients
  const { rows, hasMore } = await listCreditCustomers(businessId, { limit: 20 });
  return (
    <ClientsTab
      businessId={businessId}
      initialRows={rows}
      initialHasMore={hasMore}
    />
  );
}

function PageHeader({
  snapshot,
  active,
  creditLabelPlural,
}: {
  snapshot: Awaited<ReturnType<typeof getCreditProgramSnapshot>>;
  active: LoyaltyTabId;
  creditLabelPlural: string;
}) {
  const status = snapshot.program?.enabled ? "Programme actif" : "Programme inactif";
  const customers = snapshot.totalCustomers;
  const customersLabel = customers === 1 ? "habitué" : "habitués";
  return (
    <header className="pt-8 px-6 pb-6 border-b-4 border-outline">
      <h1 className="font-mono font-bold text-2xl tracking-tighter uppercase leading-none">
        Mes habitués
      </h1>
      <p className="mt-3 font-sans text-[14px] text-ink/70 leading-snug">
        Récompensez vos clients fidèles avec un programme de crédits.
      </p>
      <p className="mt-3 font-mono text-[12px] tabular-nums text-ink/55 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>{status}</span>
        <span aria-hidden className="text-ink/30">·</span>
        <span>
          {customers} {customersLabel}
        </span>
        <span aria-hidden className="text-ink/30">·</span>
        <span>
          {snapshot.totalCreditsOutstanding} {creditLabelPlural} en circulation
        </span>
      </p>
      <p className="sr-only" aria-live="polite">
        Onglet actif : {active}
      </p>
    </header>
  );
}

function LoyaltyUpsell() {
  return (
    <>
      <header className="pt-8 px-6 pb-6 border-b-4 border-outline bg-base">
        <h1 className="font-mono font-bold text-2xl tracking-tighter uppercase leading-none">
          Mes habitués
        </h1>
      </header>
      <UpsellCard module="loyalty" />
    </>
  );
}

function ForbiddenView() {
  return (
    <div role="alert" className="px-6 py-12">
      <p className="font-mono text-[11px] uppercase tracking-widest text-ink/40">
        403 — Accès refusé
      </p>
      <h1 className="mt-2 font-mono font-bold text-2xl tracking-tighter uppercase">
        Réservé aux propriétaires
      </h1>
      <p className="mt-3 font-sans text-[14px] text-ink/70 leading-snug">
        Cette page est réservée aux rôles propriétaire et gérant. Demandez à
        votre responsable de vous donner les bons accès.
      </p>
      <Link
        href="/home"
        className="mt-6 inline-flex items-center min-h-[44px] border-2 border-ink px-4 font-mono text-[11px] font-bold uppercase tracking-widest hover:bg-ink hover:text-base transition-colors"
      >
        ← Retour à l&apos;accueil
      </Link>
    </div>
  );
}
