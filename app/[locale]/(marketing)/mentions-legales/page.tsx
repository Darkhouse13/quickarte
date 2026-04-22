import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LegalShell } from "@/components/marketing/legal-shell";

export const metadata: Metadata = {
  title: "Mentions légales — Quickarte",
  description:
    "Informations légales relatives à l'éditeur du site Quickarte, à son hébergement et à ses conditions d'utilisation.",
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function MentionsLegalesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <LegalShell
      title="Mentions légales"
      intro={
        <p>
          En application de l&apos;article 6-III-1 de la loi n° 2004-575 du 21
          juin 2004 pour la confiance dans l&apos;économie numérique (LCEN), les
          présentes mentions légales précisent l&apos;identité de l&apos;éditeur
          du site Quickarte, de son hébergeur et les conditions d&apos;utilisation
          du site.
        </p>
      }
      sections={[
        {
          num: "01",
          title: "Éditeur du site",
          body: (
            <>
              <p>
                Le site Quickarte est édité par{" "}
                <strong>Quickarte {"{TODO: forme juridique — SAS, SARL, etc.}"}</strong>,
                {" "}
                {"{TODO: capital social en euros}"} de capital social, dont le
                siège social est situé{" "}
                {"{TODO: adresse complète du siège social}"}.
              </p>
              <p>
                RCS&nbsp;: {"{TODO: numéro RCS et ville d'immatriculation}"}
                <br />
                SIRET&nbsp;: {"{TODO: numéro SIRET}"}
                <br />
                N° TVA intracommunautaire&nbsp;: {"{TODO: numéro de TVA intracommunautaire}"}
              </p>
              <p>
                Directeur de la publication&nbsp;:{" "}
                {"{TODO: nom et prénom du directeur de la publication}"}.
              </p>
            </>
          ),
        },
        {
          num: "02",
          title: "Hébergement",
          body: (
            <>
              <p>
                Le site Quickarte est hébergé par&nbsp;:
              </p>
              <p>
                <strong>Hetzner Online GmbH</strong>
                <br />
                Industriestr. 25
                <br />
                91710 Gunzenhausen
                <br />
                Allemagne
                <br />
                Téléphone&nbsp;: +49 (0)9831 505-0
                <br />
                Site&nbsp;: hetzner.com
              </p>
            </>
          ),
        },
        {
          num: "03",
          title: "Contact",
          body: (
            <p>
              Pour toute question relative au site ou à son contenu, vous pouvez
              nous écrire à l&apos;adresse{" "}
              <a
                href="mailto:bonjour@quickarte.fr"
                className="text-ink underline underline-offset-4 hover:text-accent transition"
              >
                bonjour@quickarte.fr
              </a>
              .
            </p>
          ),
        },
        {
          num: "04",
          title: "Propriété intellectuelle",
          body: (
            <>
              <p>
                L&apos;ensemble des éléments figurant sur le site Quickarte —
                textes, illustrations, photographies, logos, marques, icônes,
                mise en page, architecture du site, code source et tout autre
                contenu — sont la propriété exclusive de Quickarte ou de ses
                partenaires, et sont protégés par les lois françaises et
                internationales relatives à la propriété intellectuelle.
              </p>
              <p>
                Toute reproduction, représentation, modification, publication,
                adaptation ou exploitation, totale ou partielle, de tout ou
                partie des éléments du site, par quelque procédé que ce soit et
                sur quelque support que ce soit, est interdite sans
                l&apos;autorisation écrite préalable de Quickarte. Toute
                utilisation non autorisée engagerait la responsabilité civile et
                pénale du contrevenant.
              </p>
            </>
          ),
        },
        {
          num: "05",
          title: "Responsabilité",
          body: (
            <>
              <p>
                Quickarte s&apos;efforce d&apos;assurer, au mieux de ses moyens,
                l&apos;exactitude et la mise à jour des informations diffusées
                sur le site. Toutefois, Quickarte ne peut garantir
                l&apos;exhaustivité, l&apos;exactitude ou l&apos;absence de
                modification des informations mises à disposition.
              </p>
              <p>
                En conséquence, Quickarte décline toute responsabilité pour tout
                dommage direct ou indirect résultant de l&apos;utilisation du
                site ou de l&apos;impossibilité d&apos;y accéder, ainsi que pour
                toute imprécision, inexactitude ou omission portant sur des
                informations disponibles sur le site.
              </p>
              <p>
                Les liens hypertextes mis en place vers d&apos;autres sites ne
                sauraient engager la responsabilité de Quickarte quant au
                contenu de ces sites.
              </p>
            </>
          ),
        },
        {
          num: "06",
          title: "Droit applicable",
          body: (
            <p>
              Les présentes mentions légales sont soumises au droit français.
              Tout litige relatif à leur interprétation ou à leur exécution
              relève de la compétence exclusive des tribunaux de{" "}
              {"{TODO: ville du siège social, ex. Paris}"}.
            </p>
          ),
        },
      ]}
    />
  );
}
