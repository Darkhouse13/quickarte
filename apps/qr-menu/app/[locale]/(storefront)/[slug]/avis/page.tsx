import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { loyaltyPrograms } from "@/lib/db/schema";
import { getBusinessBySlug } from "@/lib/catalog/queries";
import { hasEntitlement } from "@/lib/entitlements/queries";
import { ReviewClaimForm } from "@/components/storefront/review-claim-form";
import { ComplianceFooter } from "@/components/legal/compliance-footer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams?: Promise<{
    phone?: string | string[];
    from?: string | string[];
    order?: string | string[];
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) return { title: "Avis Google" };
  return {
    title: `Récompensez votre avis — ${business.name}`,
    description: `Laissez un avis Google chez ${business.name} et recevez vos crédits.`,
  };
}

function pickFirst(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function ReviewClaimPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const search = (await searchParams) ?? {};

  const business = await getBusinessBySlug(slug);
  if (!business) notFound();

  const [hasLoyalty, program] = await Promise.all([
    hasEntitlement(business.id, "loyalty"),
    db.query.loyaltyPrograms.findFirst({
      where: eq(loyaltyPrograms.businessId, business.id),
    }),
  ]);

  const placeId = business.settings?.googlePlaceId?.trim() ?? null;
  const reviewActive =
    hasLoyalty &&
    program?.enabled &&
    program.loyaltyType === "credits" &&
    program.reviewRewardEnabled &&
    program.creditsPerReview > 0 &&
    !!placeId;

  if (!reviewActive) {
    return (
      <main className="w-full max-w-[480px] mx-auto bg-base min-h-screen flex flex-col border-x border-outline/50">
        <header className="px-6 pt-12 pb-6 border-b border-outline">
          <h1 className="font-mono font-bold uppercase tracking-tighter leading-none text-2xl">
            {business.name}
          </h1>
        </header>
        <section className="px-6 py-16 flex flex-col gap-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45 font-bold">
            Récompense indisponible
          </p>
          <p className="font-mono font-bold uppercase tracking-tight text-[24px] leading-tight">
            Cette récompense n&apos;est pas active.
          </p>
          <p className="font-sans text-[14px] text-ink/60 leading-snug max-w-[360px]">
            Le restaurant n&apos;offre pas de récompense pour les avis Google
            pour le moment.
          </p>
        </section>
        <ComplianceFooter locale={locale} />
      </main>
    );
  }

  const initialPhone = pickFirst(search.phone);
  const fromOrder = pickFirst(search.from) === "order";
  const orderToken = pickFirst(search.order);

  return (
    <main className="w-full max-w-[480px] mx-auto bg-base min-h-screen flex flex-col border-x border-outline/50">
      <header className="px-6 pt-12 pb-6 border-b border-outline">
        <h1 className="font-mono font-bold uppercase tracking-tighter leading-none text-2xl">
          {business.name}
        </h1>
        <p className="font-sans text-[14px] text-ink/65 leading-snug mt-3 max-w-[360px]">
          Récompensez-vous pour votre avis Google.
        </p>
      </header>

      <ReviewClaimForm
        locale={locale}
        businessSlug={business.slug}
        businessName={business.name}
        creditLabel={program!.creditLabel}
        creditsPerReview={program!.creditsPerReview}
        googlePlaceId={placeId!}
        initialPhone={initialPhone}
        fromOrder={fromOrder}
        orderToken={orderToken}
      />

      <ComplianceFooter locale={locale} />
    </main>
  );
}
