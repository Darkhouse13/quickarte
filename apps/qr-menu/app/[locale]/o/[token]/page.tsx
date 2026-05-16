import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import {
  getCustomerOrderByToken,
  type CustomerOrderResponse,
} from "@/lib/ordering/customer-access";
import {
  buildWhatsappLink,
  formatShortOrderId,
} from "@/lib/ordering/customer-view";
import { OrderTracker } from "@/components/storefront/order-tracker";
import { ComplianceFooter } from "@/components/legal/compliance-footer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = {
  params: Promise<{ locale: string; token: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const data = await getCustomerOrderByToken(token);
  if (!data) {
    return { title: "Commande introuvable" };
  }
  const title = `Commande chez ${data.business.name}`;
  const description = "Suivez votre commande en direct.";
  return {
    title,
    description,
    openGraph: { title, description },
  };
}

// The current status was entered when its latest customer-facing event fired;
// fall back to the order's creation time when no events exist yet.
function latestEventIso(data: CustomerOrderResponse): string {
  const { timeline, createdAt } = data.order;
  const lastEvent = timeline[timeline.length - 1];
  return new Date(lastEvent ? lastEvent.at : createdAt).toISOString();
}

export default async function CustomerOrderPage({ params }: Props) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const data = await getCustomerOrderByToken(token);

  if (!data) {
    return (
      <main className="w-full max-w-[640px] mx-auto bg-base min-h-screen flex flex-col items-center justify-center border-x border-outline/50 px-8 text-center gap-4">
        <p className="font-mono font-bold uppercase tracking-tight text-2xl md:text-3xl leading-tight">
          Cette commande est introuvable.
        </p>
        <p className="font-sans text-[14px] text-ink/60 leading-snug max-w-[360px]">
          Si vous pensez qu&apos;il y a une erreur, contactez directement le
          restaurant.
        </p>
      </main>
    );
  }

  const shortOrderId = formatShortOrderId(data.order.id);
  const whatsapp = buildWhatsappLink(
    data.business.whatsappNumber,
    shortOrderId,
  );

  return (
    <main className="w-full max-w-[640px] mx-auto bg-base min-h-screen flex flex-col border-x border-outline/50">
      <header className="px-6 md:px-10 pt-12 pb-6 border-b border-outline">
        <h1 className="font-mono font-bold uppercase tracking-tighter leading-none text-3xl md:text-4xl">
          {data.business.name}
        </h1>
      </header>

      <OrderTracker
        token={token}
        locale={locale}
        initialStatus={data.order.status}
        initialLatestEventAt={latestEventIso(data)}
        type={data.order.type}
        businessName={data.business.name}
        businessSlug={data.business.slug}
        tableNumber={data.order.tableNumber}
        items={data.order.items}
        total={data.order.total}
        notes={data.order.notes}
        postOrderMessage={data.business.postOrderMessage}
        whatsapp={whatsapp}
        shortOrderId={shortOrderId}
        loyalty={data.loyalty}
        customerPhone={data.order.customerPhone}
      />
      <ComplianceFooter locale={locale} />
    </main>
  );
}
