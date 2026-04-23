import { setRequestLocale } from "next-intl/server";
import { env } from "@/lib/env";
import { requireBusiness } from "@/lib/auth/get-business";
import { SectionHeader } from "@/components/ui/section-header";
import { hasEntitlement } from "@/lib/entitlements/queries";
import { getConnectStatus } from "@/lib/payments";
import { PaymentsSection } from "@/components/merchant/payments-section";
import { NotificationsSettings } from "@/components/merchant/notifications-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = { title: "Quickarte — Paramètres" };

const BUSINESS_TYPE_LABEL: Record<string, string> = {
  boulangerie: "Boulangerie",
  restaurant: "Restaurant",
  cafe: "Café",
  hotel: "Hôtel",
  retail: "Commerce",
  other: "Autre",
};

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ stripe?: string }>;
};

export default async function SettingsPage({ params, searchParams }: Props) {
  const [{ locale }, { stripe: stripeFlag }] = await Promise.all([
    params,
    searchParams,
  ]);
  setRequestLocale(locale);

  const { business } = await requireBusiness();

  const [hasOrdering, connectStatus] = await Promise.all([
    hasEntitlement(business.id, "online_ordering"),
    hasEntitlement(business.id, "online_ordering").then((ok) =>
      ok ? getConnectStatus(business.id) : null,
    ),
  ]);

  const typeLabel = BUSINESS_TYPE_LABEL[business.type] ?? business.type;
  const locationLabel =
    [business.city, business.address].filter(Boolean).join(" · ") ||
    "Non renseignée";

  return (
    <>
      <header className="pt-8 px-6 pb-6 border-b-4 border-outline bg-base sticky top-0 z-20">
        <h1 className="font-mono font-bold text-2xl tracking-tighter uppercase leading-none">
          Paramètres
        </h1>
        <p className="font-sans text-sm text-ink/60 mt-2 leading-snug">
          Informations de votre établissement
        </p>
      </header>

      <div className="flex-1 pb-16">
        <section>
          <SectionHeader index={1} title="Établissement" />
          <dl className="flex flex-col divide-y divide-outline">
            <InfoRow label="Nom" value={business.name} />
            <InfoRow label="Type" value={typeLabel} />
            <InfoRow label="Emplacement" value={locationLabel} />
            <InfoRow label="Adresse publique" value={business.slug} mono />
            <div className="flex items-center justify-between px-6 py-5">
              <span className="font-mono text-[11px] uppercase tracking-widest text-ink/40">
                Modifier →
              </span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-ink/30 border border-outline px-1.5 py-0.5">
                Bientôt
              </span>
            </div>
          </dl>
        </section>

        {hasOrdering && connectStatus ? (
          <PaymentsSection
            status={connectStatus}
            stripeQueryFlag={stripeFlag}
          />
        ) : null}

        {hasOrdering && env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? (
          <NotificationsSettings
            vapidPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}
          />
        ) : null}
      </div>
    </>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4">
      <dt className="font-mono text-[11px] uppercase tracking-widest text-ink/50">
        {label}
      </dt>
      <dd
        className={
          mono
            ? "font-mono text-sm text-ink"
            : "font-sans text-[15px] font-bold text-ink"
        }
      >
        {value}
      </dd>
    </div>
  );
}
