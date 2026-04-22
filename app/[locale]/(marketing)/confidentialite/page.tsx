import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LegalShell } from "@/components/marketing/legal-shell";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Quickarte",
  description:
    "Politique de confidentialité de Quickarte : données collectées, finalités, base légale, droits des personnes concernées et cookies.",
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ConfidentialitePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <LegalShell
      title="Politique de confidentialité"
      intro={
        <>
          <p>
            Quickarte accorde une attention particulière à la protection des
            données personnelles. La présente politique décrit les données que
            nous collectons, les finalités pour lesquelles nous les traitons,
            leur durée de conservation ainsi que les droits dont vous disposez,
            conformément au Règlement Général sur la Protection des Données
            (RGPD, UE 2016/679) et à la loi française Informatique et Libertés.
          </p>
        </>
      }
      sections={[
        {
          num: "01",
          title: "Responsable du traitement",
          body: (
            <>
              <p>
                Le responsable du traitement des données collectées via le site
                et le service Quickarte est{" "}
                <strong>Quickarte {"{TODO: forme juridique}"}</strong>, dont le
                siège social est situé{" "}
                {"{TODO: adresse du siège social}"}.
              </p>
              <p>
                Pour toute question relative au traitement de vos données,
                écrivez-nous à{" "}
                <a
                  href="mailto:bonjour@quickarte.fr"
                  className="text-ink underline underline-offset-4 hover:text-accent transition"
                >
                  bonjour@quickarte.fr
                </a>
                .
              </p>
            </>
          ),
        },
        {
          num: "02",
          title: "Données collectées",
          body: (
            <>
              <p>
                Nous collectons uniquement les données strictement nécessaires à
                la finalité poursuivie. Selon les usages, les données concernées
                sont les suivantes&nbsp;:
              </p>
              <p>
                <strong>Via le formulaire de contact du site&nbsp;:</strong>{" "}
                nom, nom du commerce, ville, numéro de téléphone, message
                libre, ainsi que l&apos;adresse IP et le user-agent du
                navigateur au moment de la soumission (à des fins de prévention
                de la fraude et d&apos;analyse des abus).
              </p>
              <p>
                <strong>
                  Via l&apos;inscription et l&apos;embarquement marchand
                  (onboarding)&nbsp;:
                </strong>{" "}
                adresse email, nom et prénom du responsable, nom et type de
                l&apos;établissement, adresse postale de l&apos;établissement,
                numéro de téléphone professionnel.
              </p>
              <p>
                <strong>Via l&apos;utilisation du produit&nbsp;:</strong>{" "}
                commandes passées par les clients finaux du marchand (produits,
                montants, horodatage), numéros de téléphone des clients du
                programme de fidélité (lorsque le module fidélité est activé
                par le marchand).
              </p>
            </>
          ),
        },
        {
          num: "03",
          title: "Finalités du traitement",
          body: (
            <>
              <p>Les données collectées sont traitées pour&nbsp;:</p>
              <p>
                — répondre aux demandes de contact et engager la relation
                commerciale&nbsp;;<br />
                — fournir le service Quickarte aux marchands abonnés (gestion du
                catalogue, des commandes, de la fidélité, des analyses)&nbsp;;
                <br />
                — exécuter les commandes passées par les clients finaux des
                marchands via la fonction Commande en ligne&nbsp;;<br />
                — assurer la sécurité du service et prévenir la fraude.
              </p>
            </>
          ),
        },
        {
          num: "04",
          title: "Base légale",
          body: (
            <>
              <p>
                Conformément à l&apos;article 6 du RGPD, les traitements
                reposent sur les bases légales suivantes&nbsp;:
              </p>
              <p>
                — <strong>Exécution d&apos;un contrat</strong> (art. 6-1-b)
                pour la fourniture du service Quickarte aux marchands et pour
                l&apos;exécution des commandes des clients finaux&nbsp;;<br />
                — <strong>Intérêt légitime</strong> (art. 6-1-f) pour la
                prospection commerciale auprès de professionnels, la prévention
                de la fraude et la sécurité du service&nbsp;;<br />
                — <strong>Consentement</strong> (art. 6-1-a) lorsque
                celui-ci est requis, notamment pour certaines communications
                facultatives.
              </p>
            </>
          ),
        },
        {
          num: "05",
          title: "Destinataires et sous-traitants",
          body: (
            <>
              <p>
                Vos données sont destinées à l&apos;équipe de Quickarte. Elles
                peuvent être transmises aux sous-traitants techniques
                strictement nécessaires au fonctionnement du service&nbsp;:
              </p>
              <p>
                — <strong>Hetzner Online GmbH</strong> (Allemagne) —
                hébergement de l&apos;infrastructure&nbsp;;<br />
                — <strong>Stripe, Inc.</strong> (États-Unis) — traitement des
                paiements des clients finaux via Stripe Connect&nbsp;;<br />
                — <strong>Resend, Inc.</strong> (États-Unis) — envoi des
                emails transactionnels.
              </p>
              <p>
                Nous n&apos;effectuons aucune cession, location ou vente de vos
                données à des tiers à des fins commerciales.
              </p>
            </>
          ),
        },
        {
          num: "06",
          title: "Transferts hors Union européenne",
          body: (
            <>
              <p>
                Certains sous-traitants sont établis aux États-Unis. Les
                transferts correspondants sont encadrés par le{" "}
                <em>Data Privacy Framework</em> (DPF), décision
                d&apos;adéquation adoptée par la Commission européenne le 10
                juillet 2023, qui constitue la base légale de ces transferts.
              </p>
              <p>
                Sous-traitants concernés&nbsp;: Stripe, Inc. (DPF) et Resend,
                Inc. (DPF).
              </p>
            </>
          ),
        },
        {
          num: "07",
          title: "Durée de conservation",
          body: (
            <>
              <p>
                — <strong>Demandes via le formulaire de contact</strong>&nbsp;:
                3 ans à compter du dernier contact, à des fins de prospection
                commerciale B2B&nbsp;;<br />
                — <strong>Données de commande</strong>&nbsp;: 10 ans au titre
                de l&apos;obligation comptable (art. L123-22 du Code de
                commerce)&nbsp;;<br />
                — <strong>Données des clients fidélité</strong>&nbsp;:
                conservées tant que le compte marchand est actif, puis
                supprimées dans un délai d&apos;un an après la clôture du
                compte.
              </p>
            </>
          ),
        },
        {
          num: "08",
          title: "Vos droits",
          body: (
            <>
              <p>
                Conformément aux articles 15 à 22 du RGPD, vous disposez des
                droits suivants sur vos données personnelles&nbsp;:
              </p>
              <p>
                — droit d&apos;accès et de copie&nbsp;;<br />
                — droit de rectification des données inexactes&nbsp;;<br />
                — droit à l&apos;effacement (« droit à l&apos;oubli »)&nbsp;;
                <br />
                — droit à la portabilité de vos données&nbsp;;<br />
                — droit d&apos;opposition au traitement&nbsp;;<br />
                — droit à la limitation du traitement&nbsp;;<br />
                — droit de retirer votre consentement à tout moment, lorsque le
                traitement repose sur celui-ci.
              </p>
              <p>
                Pour exercer ces droits, écrivez-nous à{" "}
                <a
                  href="mailto:bonjour@quickarte.fr"
                  className="text-ink underline underline-offset-4 hover:text-accent transition"
                >
                  bonjour@quickarte.fr
                </a>{" "}
                en précisant votre demande. Nous vous répondrons dans un délai
                maximal d&apos;un mois.
              </p>
            </>
          ),
        },
        {
          num: "09",
          title: "Réclamation auprès de la CNIL",
          body: (
            <p>
              Si vous estimez, après nous avoir contactés, que vos droits ne
              sont pas respectés, vous avez la possibilité d&apos;introduire
              une réclamation auprès de la Commission Nationale de
              l&apos;Informatique et des Libertés (CNIL) via son site{" "}
              <a
                href="https://www.cnil.fr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink underline underline-offset-4 hover:text-accent transition"
              >
                www.cnil.fr
              </a>
              .
            </p>
          ),
        },
        {
          num: "10",
          title: "Cookies",
          body: (
            <>
              <p>
                <strong>
                  Quickarte n&apos;utilise ni cookies de suivi, ni pixels
                  d&apos;analyse, ni cookies tiers sur son site vitrine.
                </strong>{" "}
                Aucun outil d&apos;analyse comportementale ne suit votre
                navigation. Aucune donnée n&apos;est partagée avec des régies
                publicitaires.
              </p>
              <p>
                Seuls des cookies strictement nécessaires à
                l&apos;authentification sont déposés à l&apos;intérieur du
                produit, lorsqu&apos;un utilisateur est connecté à son espace
                marchand. Ces cookies ne nécessitent pas de consentement
                préalable au titre de l&apos;article 82 de la loi Informatique
                et Libertés.
              </p>
            </>
          ),
        },
        {
          num: "11",
          title: "Mise à jour",
          body: (
            <p>
              La présente politique peut être mise à jour à tout moment. Date
              de la dernière mise à jour&nbsp;:{" "}
              {"{TODO: date de mise à jour au format JJ/MM/AAAA}"}.
            </p>
          ),
        },
      ]}
    />
  );
}
