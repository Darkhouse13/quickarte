import type { Metadata } from "next";
import { LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell";
import { QUICKARTE_LEGAL, isPlaceholder } from "@/lib/legal/identifiers";

const LAST_UPDATED_FR = "14 mai 2026";

export const metadata: Metadata = {
  title: "Nous contacter — Quickarte",
  description: "Une question, une démo, un partenariat ? Contactez Quickarte.",
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  const L = QUICKARTE_LEGAL;
  const hasWhatsapp = !isPlaceholder(L.contactWhatsapp);
  const whatsappNumber = L.contactWhatsapp.replace(/\D/g, "");
  const hasAddress = !isPlaceholder(L.registeredAddress);

  return (
    <LegalPageShell
      locale={locale}
      title="Nous contacter"
      lastUpdated={LAST_UPDATED_FR}
    >
      <LegalSection title="Écrivez-nous">
        <p>Une question, une démo, un partenariat&nbsp;? Écrivez-nous.</p>
      </LegalSection>

      <LegalSection title="Email">
        <a
          href={`mailto:${L.contactEmail}`}
          className="font-sans text-2xl md:text-3xl text-ink hover:text-accent transition break-all"
        >
          {L.contactEmail}
        </a>
      </LegalSection>

      {hasWhatsapp ? (
        <LegalSection title="WhatsApp">
          <a
            href={`https://wa.me/${whatsappNumber}`}
            target="_blank"
            rel="noreferrer"
            className="font-sans text-xl md:text-2xl text-ink hover:text-accent transition"
          >
            {L.contactWhatsapp}
          </a>
          <p className="font-mono text-xs uppercase tracking-widest text-ink/40">
            Réponse dans la journée.
          </p>
        </LegalSection>
      ) : null}

      {hasAddress ? (
        <LegalSection title="Adresse">
          <p>{L.registeredAddress}</p>
        </LegalSection>
      ) : null}
    </LegalPageShell>
  );
}
