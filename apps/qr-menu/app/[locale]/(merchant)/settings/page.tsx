import { setRequestLocale } from "next-intl/server";
import { env } from "@/lib/env";
import { requireBusiness } from "@/lib/auth/get-business";
import { assertRole } from "@/lib/identity/permissions";
import { SectionHeader } from "@/components/ui/section-header";
import { getEntitlements, hasEntitlement } from "@/lib/entitlements/queries";
import { NotificationsSettings } from "@/components/merchant/notifications-settings";
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

  const [hasOrdering, entitlements] = await Promise.all([
    hasEntitlement(business.id, "online_ordering"),
    getEntitlements(business.id),
  ]);

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
          <SectionHeader index={1} title="Établissement" />
          <BusinessProfileSection
            name={business.name}
            type={business.type}
            slug={business.slug}
            locationLabel={locationLabel}
          />
        </section>

        <section>
          <SectionHeader index={2} title="Adresse" />
          <AddressSettingsSection
            formattedAddress={business.formattedAddress ?? ""}
            city={business.city ?? ""}
            address={business.address ?? ""}
          />
        </section>

        <section>
          <SectionHeader index={3} title="Modules" />
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
          <SectionHeader index={4} title="Confirmation client" />
          <CustomerFacingSettingsSection
            initial={{
              whatsappNumber: settings.whatsappNumber ?? "",
              customerPostOrderMessage:
                settings.customerPostOrderMessage ?? "",
            }}
          />
        </section>

        <section>
          <SectionHeader index={5} title="Coexistence avec votre caisse" />
          <PosCoexistenceSettingsSection
            initialEnabled={settings.posCoexistenceEnabled}
          />
        </section>

        <section>
          <SectionHeader index={6} title="QR tables" />
          <TableQrSettingsSection
            locale={locale}
            slug={business.slug}
            appUrl={appUrl}
            initialCount={settings.tableQrCount}
          />
        </section>

        {hasOrdering && env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? (
          <NotificationsSettings
            vapidPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}
          />
        ) : null}
      </div>
    </>
  );
}
