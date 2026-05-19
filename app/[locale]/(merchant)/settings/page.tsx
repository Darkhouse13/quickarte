import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { env } from "@/lib/env";
import { requireBusiness } from "@/lib/auth/get-business";
import { assertRole } from "@/lib/identity/permissions";
import { SectionHeader } from "@/components/ui/section-header";
import { getEntitlements } from "@/lib/entitlements/queries";
import { BusinessProfileSection } from "@/components/merchant/business-profile-section";
import {
  AddressSettingsSection,
  CustomerFacingSettingsSection,
  OperationalSettingsSection,
  PosCoexistenceSettingsSection,
  TableQrSettingsSection,
} from "@/components/merchant/settings-sections";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = { title: "Quickarte — Paramètres" };

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { session, business } = await requireBusiness();
  await assertRole(session.user.id, business.id, ["owner", "manager"]);

  const entitlements = await getEntitlements(business.id);

  const locationLabel =
    [business.city, business.address].filter(Boolean).join(" · ") ||
    "Non renseignée";
  const settings = business.settings ?? {
    menuQrEnabled: true,
    orderingEnabled: true,
    loyaltyEnabled: true,
    analyticsEnabled: true,
    dineInEnabled: true,
    takeawayEnabled: true,
    tableQrCount: 0,
    whatsappNumber: null,
    customerPostOrderMessage: null,
    posCoexistenceEnabled: false,
  };
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

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
          <SectionHeader index={1} title="Raccourcis" />
          <div className="px-6 py-5 border-b-4 border-outline grid grid-cols-1 gap-3">
            <Link
              href={`/${locale}/settings/printers`}
              className="border-2 border-ink px-5 py-4 flex items-center justify-between gap-4 hover:bg-ink hover:text-base transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20"
            >
              <span className="flex flex-col gap-1">
                <span className="font-mono text-[12px] uppercase tracking-widest font-bold">
                  Imprimantes
                </span>
                <span className="font-sans text-sm opacity-70 leading-snug">
                  Webprint, tickets comptoir/cuisine/bar et tests d'impression
                </span>
              </span>
              <span className="font-mono text-xl leading-none" aria-hidden>
                →
              </span>
            </Link>
            <Link
              href={`/${locale}/settings/staff`}
              className="border-2 border-outline px-5 py-4 flex items-center justify-between gap-4 hover:border-ink hover:bg-black/[0.02] transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20"
            >
              <span className="flex flex-col gap-1">
                <span className="font-mono text-[12px] uppercase tracking-widest font-bold">
                  Équipe
                </span>
                <span className="font-sans text-sm text-ink/60 leading-snug">
                  Invitations et accès employés
                </span>
              </span>
              <span className="font-mono text-xl leading-none" aria-hidden>
                →
              </span>
            </Link>
          </div>
        </section>

        <section>
          <SectionHeader index={2} title="Établissement" />
          <BusinessProfileSection
            name={business.name}
            type={business.type}
            slug={business.slug}
            locationLabel={locationLabel}
          />
        </section>

        <section>
          <SectionHeader index={3} title="Adresse" />
          <AddressSettingsSection
            formattedAddress={business.formattedAddress ?? ""}
            city={business.city ?? ""}
            address={business.address ?? ""}
          />
        </section>

        <section>
          <SectionHeader index={4} title="Modules" />
          <OperationalSettingsSection
            entitlements={entitlements}
            initial={{
              menuQrEnabled: settings.menuQrEnabled,
              orderingEnabled: settings.orderingEnabled,
              loyaltyEnabled: settings.loyaltyEnabled,
              analyticsEnabled: settings.analyticsEnabled,
              dineInEnabled: settings.dineInEnabled,
              takeawayEnabled: settings.takeawayEnabled,
            }}
          />
        </section>

        <section>
          <SectionHeader index={5} title="Confirmation client" />
          <CustomerFacingSettingsSection
            initial={{
              whatsappNumber: settings.whatsappNumber ?? "",
              customerPostOrderMessage:
                settings.customerPostOrderMessage ?? "",
            }}
          />
        </section>

        <section>
          <SectionHeader index={6} title="Coexistence avec votre caisse" />
          <PosCoexistenceSettingsSection
            initialEnabled={settings.posCoexistenceEnabled}
          />
        </section>

        <section>
          <SectionHeader index={7} title="QR tables" />
          <TableQrSettingsSection
            locale={locale}
            slug={business.slug}
            appUrl={appUrl}
            initialCount={settings.tableQrCount}
          />
        </section>
      </div>
    </>
  );
}
