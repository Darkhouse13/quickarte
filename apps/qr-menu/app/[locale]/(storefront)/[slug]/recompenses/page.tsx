import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { loyaltyPrograms } from "@/lib/db/schema";
import { getBusinessBySlug } from "@/lib/catalog/queries";
import { hasEntitlement } from "@/lib/entitlements/queries";
import {
  listActiveRedemptionListingsForCustomer,
  type CustomerRedemptionListing,
} from "@/lib/loyalty/credits-queries";
import { getCreditBalance } from "@/lib/loyalty/credits";
import { normalizeMoroccanPhone } from "@/lib/utils/phone";
import { RedemptionMenu } from "@/components/storefront/redemption-menu";
import { ComplianceFooter } from "@/components/legal/compliance-footer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams?: Promise<{ phone?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) return { title: "Récompenses" };
  return {
    title: `Récompenses — ${business.name}`,
    description: `Échangez vos crédits chez ${business.name}.`,
  };
}

function pickFirst(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function RedemptionMenuPage({
  params,
  searchParams,
}: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const search = (await searchParams) ?? {};

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
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45 font-bold">
            Récompenses indisponibles
          </p>
          <p className="font-mono font-bold uppercase tracking-tight text-[24px] leading-tight">
            Les récompenses ne sont pas actives.
          </p>
          <p className="font-sans text-[14px] text-ink/60 leading-snug max-w-[360px]">
            Le restaurant n&apos;a pas activé l&apos;échange de crédits pour le
            moment.
          </p>
        </section>
        <ComplianceFooter locale={locale} />
      </main>
    );
  }

  const rawPhone = pickFirst(search.phone);
  let phoneNormalized: string | null = null;
  let balance: number | null = null;
  if (rawPhone) {
    try {
      phoneNormalized = normalizeMoroccanPhone(rawPhone);
      balance = await getCreditBalance(business.id, phoneNormalized);
    } catch {
      // Invalid phone in the URL — fall back to the identification gate.
      phoneNormalized = null;
    }
  }

  return (
    <main className="w-full max-w-[480px] mx-auto bg-base min-h-screen flex flex-col border-x border-outline/50">
      <RedemptionMenu
        locale={locale}
        businessSlug={business.slug}
        businessName={business.name}
        creditLabel={program!.creditLabel}
        listings={listings satisfies CustomerRedemptionListing[]}
        initialPhone={phoneNormalized}
        initialBalance={balance}
      />
      <ComplianceFooter locale={locale} />
    </main>
  );
}
