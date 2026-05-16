import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { loyaltyPrograms } from "@/lib/db/schema";
import { getBusinessBySlug } from "@/lib/catalog/queries";
import { hasEntitlement } from "@/lib/entitlements/queries";
import { listActiveRedemptionListingsForCustomer } from "@/lib/loyalty/credits-queries";
import { RedemptionCheckoutForm } from "@/components/storefront/redemption-checkout-form";
import { ComplianceFooter } from "@/components/legal/compliance-footer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) return { title: "Échanger mes crédits" };
  return {
    title: `Échanger — ${business.name}`,
  };
}

export default async function RedemptionCheckoutPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const business = await getBusinessBySlug(slug);
  if (!business) notFound();

  const [hasLoyalty, program, listings] = await Promise.all([
    hasEntitlement(business.id, "loyalty"),
    db.query.loyaltyPrograms.findFirst({
      where: eq(loyaltyPrograms.businessId, business.id),
    }),
    listActiveRedemptionListingsForCustomer(business.id),
  ]);

  const programActive =
    hasLoyalty &&
    program?.enabled &&
    program.loyaltyType === "credits" &&
    program.redemptionEnabled;

  if (!programActive) {
    return (
      <main className="w-full max-w-[480px] mx-auto bg-base min-h-screen flex flex-col border-x border-outline/50">
        <header className="px-6 pt-12 pb-6 border-b border-outline">
          <h1 className="font-mono font-bold uppercase tracking-tighter leading-none text-2xl">
            {business.name}
          </h1>
        </header>
        <section className="px-6 py-16 flex flex-col gap-4">
          <p className="font-mono font-bold uppercase tracking-tight text-[20px] leading-tight">
            Les récompenses ne sont pas actives.
          </p>
        </section>
        <ComplianceFooter locale={locale} />
      </main>
    );
  }

  return (
    <main className="w-full max-w-[480px] mx-auto bg-base min-h-screen flex flex-col border-x border-outline/50">
      <header className="px-6 pt-12 pb-6 border-b border-outline">
        <h1 className="font-mono font-bold uppercase tracking-tighter leading-none text-2xl">
          {business.name}
        </h1>
        <p className="font-sans text-[14px] text-ink/65 leading-snug mt-3">
          Confirmer l&apos;échange
        </p>
      </header>
      <RedemptionCheckoutForm
        locale={locale}
        businessSlug={business.slug}
        creditLabel={program!.creditLabel}
        dineInEnabled={business.settings?.dineInEnabled !== false}
        takeawayEnabled={business.settings?.takeawayEnabled !== false}
        activeListings={listings.map((l) => ({
          listingId: l.listingId,
          productId: l.productId,
          productName: l.productName,
          creditPrice: l.creditPrice,
        }))}
      />
      <ComplianceFooter locale={locale} />
    </main>
  );
}
