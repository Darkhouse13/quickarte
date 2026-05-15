import type { Metadata } from "next";
import { LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell";
import { QUICKARTE_LEGAL } from "@/lib/legal/identifiers";

const LAST_UPDATED_FR = "14 mai 2026";

export const metadata: Metadata = {
  title: "Mentions légales — Quickarte",
  description:
    "Mentions légales de Quickarte : éditeur du site, hébergeur et propriété intellectuelle.",
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function MentionsLegalesPage({ params }: Props) {
  const { locale } = await params;
  const L = QUICKARTE_LEGAL;

  return (
    <LegalPageShell
      locale={locale}
      title="Mentions légales"
      lastUpdated={LAST_UPDATED_FR}
    >
      <LegalSection title="Éditeur du site">
        <p>
          Le site et le service {L.companyShortName} sont édités par&nbsp;:
        </p>
        <ul className="space-y-1">
          <li>Raison sociale&nbsp;: {L.companyLegalName}</li>
          <li>Siège social&nbsp;: {L.registeredAddress}</li>
          <li>Registre du commerce (RC)&nbsp;: {L.rcNumber}</li>
          <li>Identifiant commun de l&apos;entreprise (ICE)&nbsp;: {L.iceNumber}</li>
          <li>Capital social&nbsp;: {L.capitalSocial}</li>
          <li>Directeur de la publication&nbsp;: {L.publicationDirector}</li>
          <li>
            Contact&nbsp;:{" "}
            <a
              href={`mailto:${L.contactEmail}`}
              className="text-ink underline underline-offset-2 hover:text-accent transition"
            >
              {L.contactEmail}
            </a>
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Hébergeur">
        <p>Le site est hébergé par&nbsp;:</p>
        <ul className="space-y-1">
          <li>Hetzner Online GmbH</li>
          <li>Industriestr. 25, 91710 Gunzenhausen, Allemagne</li>
          <li>
            <a
              href="https://www.hetzner.com"
              target="_blank"
              rel="noreferrer"
              className="text-ink underline underline-offset-2 hover:text-accent transition"
            >
              www.hetzner.com
            </a>
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          La marque {L.companyShortName}, le design du site, son interface et
          son code source sont la propriété exclusive de l&apos;éditeur et sont
          protégés par les lois en vigueur sur la propriété intellectuelle.
          Toute reproduction ou réutilisation sans autorisation est interdite.
        </p>
        <p>
          Les contenus fournis par les utilisateurs — catalogues des
          commerçants, descriptions d&apos;articles, images, commandes des
          clients — restent la propriété de l&apos;utilisateur ou du commerçant
          concerné. {L.companyShortName} ne revendique aucun droit sur ces
          contenus et se limite à les traiter pour fournir le service.
        </p>
      </LegalSection>

      <LegalSection title="Crédits">
        <p>
          Conception et développement&nbsp;: l&apos;équipe {L.companyShortName}.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
