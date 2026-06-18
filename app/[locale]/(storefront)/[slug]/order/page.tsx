import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getBusinessBySlug } from "@/lib/catalog/queries";
import { CheckoutForm } from "@/components/storefront/checkout-form";
import { parseTableContext } from "@/lib/ordering/table";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams?: Promise<{
    table?: string | string[];
    t?: string | string[];
    tl?: string | string[];
  }>;
};

export default async function CheckoutPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const table = parseTableContext((await searchParams) ?? {});
  setRequestLocale(locale);

  const business = await getBusinessBySlug(slug);
  if (!business) notFound();

  return (
    <main className="w-full max-w-[480px] mx-auto bg-base min-h-screen relative flex flex-col border-x border-outline/50 shadow-2xl shadow-black/5">
      <CheckoutForm
        businessId={business.id}
        businessName={business.name}
        businessSlug={business.slug}
        locale={locale}
        initialMizaneTableId={table.mizaneTableId}
        initialTableLabel={table.label}
        orderingEnabled={business.settings?.orderingEnabled !== false}
        dineInEnabled={business.settings?.dineInEnabled !== false}
        takeawayEnabled={business.settings?.takeawayEnabled !== false}
      />
    </main>
  );
}
