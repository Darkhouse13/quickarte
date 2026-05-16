import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getBusinessBySlug } from "@/lib/catalog/queries";
import { CheckoutForm } from "@/components/storefront/checkout-form";
import { hasEntitlement } from "@/lib/entitlements/queries";
import { getProgram } from "@/lib/loyalty/queries";
import { parseTableNumber } from "@/lib/ordering/table";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams?: Promise<{ table?: string | string[] }>;
};

export default async function CheckoutPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const tableNumber = parseTableNumber((await searchParams)?.table);
  setRequestLocale(locale);

  const business = await getBusinessBySlug(slug);
  if (!business) notFound();

  const [hasLoyalty, hasOrdering] = await Promise.all([
    hasEntitlement(business.id, "loyalty"),
    hasEntitlement(business.id, "online_ordering"),
  ]);

  let loyaltyHint: {
    accrualType: "per_visit" | "per_euro";
    accrualRate: number;
    rewardDescription: string;
  } | null = null;
  if (hasLoyalty && hasOrdering) {
    const program = await getProgram(business.id);
    if (program && program.enabled) {
      loyaltyHint = {
        accrualType: program.accrualType,
        accrualRate: Number(program.accrualRate),
        rewardDescription: program.rewardDescription,
      };
    }
  }

  return (
    <main className="w-full max-w-[480px] mx-auto bg-base min-h-screen relative flex flex-col border-x border-outline/50 shadow-2xl shadow-black/5">
      <CheckoutForm
        businessId={business.id}
        businessName={business.name}
        businessSlug={business.slug}
        locale={locale}
        loyaltyHint={loyaltyHint}
        initialTableNumber={tableNumber}
        orderingEnabled={business.settings?.orderingEnabled !== false}
        dineInEnabled={business.settings?.dineInEnabled !== false}
        takeawayEnabled={business.settings?.takeawayEnabled !== false}
      />
    </main>
  );
}
