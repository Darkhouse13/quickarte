import type { Metadata } from "next";
import { LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell";
import { QUICKARTE_LEGAL } from "@/lib/legal/identifiers";

const LAST_UPDATED_FR = "14 mai 2026";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation — Quickarte",
  description:
    "Conditions générales d'utilisation du service Quickarte pour les restaurants et cafés.",
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function CguPage({ params }: Props) {
  const { locale } = await params;
  const L = QUICKARTE_LEGAL;

  return (
    <LegalPageShell
      locale={locale}
      title="Conditions générales d'utilisation"
      lastUpdated={LAST_UPDATED_FR}
    >
      <LegalSection title="Objet">
        <p>
          {L.companyShortName} fournit un service de menu par QR code, de
          capture de commandes et d&apos;outils opérationnels destiné aux
          restaurants et cafés indépendants au Maroc. Les présentes conditions
          générales d&apos;utilisation (CGU) encadrent l&apos;accès et
          l&apos;usage de ce service.
        </p>
      </LegalSection>

      <LegalSection title="Acceptation">
        <p>
          L&apos;utilisation du service implique l&apos;acceptation pleine et
          entière des présentes CGU. Si vous n&apos;acceptez pas ces
          conditions, vous ne devez pas utiliser le service.
        </p>
      </LegalSection>

      <LegalSection title="Comptes commerçants">
        <p>
          L&apos;accès au service nécessite la création d&apos;un compte
          commerçant. Le commerçant est responsable de la confidentialité de
          son mot de passe et de toute activité réalisée depuis son compte.
          {" "}
          {L.companyShortName} se réserve le droit de suspendre ou de fermer un
          compte en cas d&apos;abus ou de manquement aux présentes CGU.
        </p>
      </LegalSection>

      <LegalSection title="Utilisation conforme">
        <p>
          Le commerçant s&apos;engage à ne pas utiliser le service pour
          diffuser des contenus illégaux, à ne pas en faire un usage abusif, et
          à ne pas recourir à une automatisation non autorisée (extraction de
          données, scripts, etc.) susceptible de perturber le service.
        </p>
      </LegalSection>

      <LegalSection title="Tarification">
        <p>
          Les tarifs des modules sont communiqués au commerçant lors de
          l&apos;activation de ces modules. {L.companyShortName} ne prélève
          aucune commission sur les commandes passées par les clients finaux.
        </p>
      </LegalSection>

      <LegalSection title="Paiements clients">
        <p>
          {L.companyShortName} ne traite pas les paiements entre le client
          final et le commerçant. En version 1 du service, le seul mode de
          paiement supporté est «&nbsp;à régler sur place&nbsp;».
        </p>
      </LegalSection>

      <LegalSection title="Limitation de responsabilité">
        <p>
          Le service est fourni «&nbsp;en l&apos;état&nbsp;».{" "}
          {L.companyShortName} met en œuvre les moyens raisonnables pour
          assurer la disponibilité et la fiabilité du service, sans garantir
          une absence totale d&apos;interruption ou d&apos;erreur. La
          responsabilité de {L.companyShortName} ne saurait être engagée pour
          les dommages indirects résultant de l&apos;utilisation du service.
        </p>
      </LegalSection>

      <LegalSection title="Données personnelles">
        <p>
          Le traitement des données personnelles est décrit dans la{" "}
          <a
            href={`/${locale}/politique-de-confidentialite`}
            className="text-ink underline underline-offset-2 hover:text-accent transition"
          >
            politique de confidentialité
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Modification des CGU">
        <p>
          {L.companyShortName} peut faire évoluer les présentes CGU. Les
          commerçants sont notifiés par email de toute modification
          substantielle.
        </p>
      </LegalSection>

      <LegalSection title="Droit applicable et juridiction">
        <p>
          Les présentes CGU sont régies par le droit marocain. Tout litige
          relève de la compétence des tribunaux de [À COMPLÉTER — ville du
          siège].
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
