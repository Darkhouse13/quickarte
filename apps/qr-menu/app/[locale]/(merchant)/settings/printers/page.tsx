import { setRequestLocale } from "next-intl/server";
import { env } from "@/lib/env";
import { requireBusiness } from "@/lib/auth/get-business";
import { assertRole } from "@/lib/identity/permissions";
import { SectionHeader } from "@/components/ui/section-header";
import { PrinterSettings } from "@/components/merchant/printer-settings";
import {
  getPrinterRoutingSettings,
  getPrinterSettings,
} from "@/lib/printing/pipeline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = { title: "Quickarte - Imprimantes" };

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function PrintersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { session, business } = await requireBusiness();
  await assertRole(session.user.id, business.id, ["owner", "manager"]);

  const [printerRows, routingSettings] = await Promise.all([
    getPrinterSettings(business.id),
    getPrinterRoutingSettings(business.id),
  ]);
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  return (
    <>
      <header className="pt-8 px-6 pb-6 border-b-4 border-outline bg-base sticky top-0 z-20">
        <h1 className="font-mono font-bold text-2xl tracking-tighter uppercase leading-none">
          Imprimantes
        </h1>
        <p className="font-sans text-sm text-ink/60 mt-2 leading-snug">
          Tickets comptoir et Webprint
        </p>
      </header>

      <div className="flex-1 pb-16">
        <section>
          <SectionHeader index={1} title="Ajouter" />
          <PrinterSettings
            printers={printerRows}
            appUrl={appUrl}
            routing={routingSettings}
          />
        </section>
      </div>
    </>
  );
}
