import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { loyaltyPrograms } from "@quickarte/db-schema";
import { StorefrontMenu } from "@/components/storefront/storefront-menu";
import { LoyaltyBalanceBanner } from "@/components/storefront/loyalty-balance-banner";
import { ComplianceFooter } from "@/components/legal/compliance-footer";
import {
  getBusinessBySlug,
  getMenuByBusinessId,
} from "@/lib/catalog/queries";
import { buildStorefrontFixture } from "@/lib/catalog/storefront-dto";
import { hasEntitlement } from "@/lib/entitlements/queries";
import { parseTableNumber } from "@/lib/ordering/table";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams?: Promise<{ table?: string | string[] }>;
};

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();
  const location = [business.city, business.address]
    .filter(Boolean)
    .join(" · ");
  return {
    title: `${business.name} — Menu`,
    description: location
      ? `${business.name} — ${location}`
      : `${business.name} — Menu`,
  };
}

export default async function StorefrontPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const tableNumber = parseTableNumber((await searchParams)?.table);
  setRequestLocale(locale);

  const business = await getBusinessBySlug(slug);
  if (!business) notFound();

  const menu = await getMenuByBusinessId(business.id);
  const fixture = buildStorefrontFixture(business, menu);

  const [hasLoyalty, program] = await Promise.all([
    hasEntitlement(business.id, "loyalty"),
    db.query.loyaltyPrograms.findFirst({
      where: eq(loyaltyPrograms.businessId, business.id),
      columns: { enabled: true, loyaltyType: true, creditLabel: true },
    }),
  ]);
  const loyaltyActive = Boolean(
    hasLoyalty &&
      program?.enabled &&
      program.loyaltyType === "credits",
  );

  return (
    <main className="w-full max-w-[480px] mx-auto bg-base min-h-screen relative flex flex-col border-x border-outline/50 shadow-2xl shadow-black/5">
      <LoyaltyBalanceBanner
        locale={locale}
        businessSlug={business.slug}
        businessName={business.name}
        loyaltyActive={loyaltyActive}
        creditLabel={program?.creditLabel ?? "Crédits"}
      />
      <StorefrontMenu
        business={fixture}
        locale={locale}
        initialTableNumber={tableNumber}
      />
      <ComplianceFooter locale={locale} />
    </main>
  );
}
