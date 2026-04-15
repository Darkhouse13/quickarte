import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { requireBusiness } from "@/lib/auth/get-business";
import { generateQRDataURL } from "@/lib/utils/qr";
import { SectionHeader } from "@/components/ui/section-header";
import { CopyButton } from "@/components/ui/copy-button";
import { QRDisplay } from "@/components/merchant/qr-display";

export const metadata = { title: "Quickarte — Boutique" };

const BUSINESS_TYPE_LABEL: Record<string, string> = {
  restaurant: "Restaurant",
  cafe: "Café",
  hotel: "Hôtel",
  retail: "Commerce",
  other: "Autre",
};

type Props = { params: Promise<{ locale: string }> };

export default async function StorePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { business } = await requireBusiness();

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  const publicUrl = `${appUrl}/${business.slug}`;
  const displayUrl = publicUrl.replace(/^https?:\/\//, "");
  const storefrontHref = `/${locale}/${business.slug}`;
  const qrDataUrl = await generateQRDataURL(publicUrl);
  const typeLabel = BUSINESS_TYPE_LABEL[business.type] ?? business.type;
  const locationLabel =
    [business.city, business.address].filter(Boolean).join(" · ") ||
    "Non renseignée";

  return (
    <>
      <header className="pt-8 px-6 pb-6 border-b-4 border-outline bg-base sticky top-0 z-20">
        <h1 className="font-mono font-bold text-2xl tracking-tighter uppercase leading-none">
          Boutique
        </h1>
      </header>

      <div className="flex-1 pb-16">
        <section className="border-b-4 border-outline">
          <SectionHeader index={1} title="Votre Boutique" />
          <div className="p-6 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <h2 className="font-mono font-bold text-2xl tracking-tighter uppercase leading-none">
                {business.name}
              </h2>
              <p className="font-mono text-xs text-ink/60 uppercase tracking-widest">
                {locationLabel}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="font-mono text-[11px] uppercase tracking-widest text-ink/50">
                Adresse publique
              </span>
              <CopyButton value={displayUrl} />
            </div>

            <Link
              href={storefrontHref}
              target="_blank"
              rel="noopener noreferrer"
              className="self-start border-2 border-ink bg-base px-5 py-3 font-mono text-[11px] font-bold uppercase tracking-widest hover:bg-ink hover:text-base transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20"
            >
              Voir la boutique →
            </Link>
          </div>
        </section>

        <section className="border-b-4 border-outline">
          <SectionHeader index={2} title="QR Code" />
          <div className="p-6">
            <QRDisplay
              dataUrl={qrDataUrl}
              businessName={business.name}
              targetUrl={publicUrl}
            />
          </div>
        </section>

        <section>
          <SectionHeader index={3} title="Informations" />
          <dl className="flex flex-col divide-y divide-outline">
            <InfoRow label="Nom" value={business.name} />
            <InfoRow label="Type" value={typeLabel} />
            <InfoRow label="Emplacement" value={locationLabel} />
            <InfoRow label="Slug" value={business.slug} mono />
            <div className="flex items-center justify-between px-6 py-5">
              <span className="font-mono text-[11px] uppercase tracking-widest text-ink/40">
                Modifier →
              </span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-ink/30 border border-outline px-1.5 py-0.5">
                Bientôt
              </span>
            </div>
          </dl>
        </section>
      </div>
    </>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4">
      <dt className="font-mono text-[11px] uppercase tracking-widest text-ink/50">
        {label}
      </dt>
      <dd
        className={
          mono
            ? "font-mono text-sm text-ink"
            : "font-sans text-[15px] font-bold text-ink"
        }
      >
        {value}
      </dd>
    </div>
  );
}
