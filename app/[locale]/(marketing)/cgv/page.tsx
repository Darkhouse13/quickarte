import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LegalShell } from "@/components/marketing/legal-shell";

export const metadata: Metadata = {
  title: "Conditions générales de vente — Quickarte",
  description:
    "Conditions générales de vente régissant l'abonnement au logiciel Quickarte par les marchands professionnels.",
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function CgvPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <LegalShell
      title="Conditions générales de vente"
      intro={
        <p>
          Les présentes conditions générales de vente (« CGV ») régissent
          l&apos;abonnement au logiciel Quickarte par des professionnels dans
          le cadre de leur activité commerciale. Toute souscription à un
          abonnement emporte acceptation sans réserve des présentes CGV.
        </p>
      }
      sections={[
        {
          num: "01",
          title: "Objet",
          body: (
            <p>
              Quickarte propose un logiciel en mode SaaS (<em>Software as a
              Service</em>) de gestion de commerce destiné aux boulangeries,
              cafés, brunchs et restaurants indépendants établis en France. Le
              service permet notamment la gestion du menu numérique, des
              commandes en ligne, d&apos;un programme de fidélité et
              d&apos;analyses d&apos;activité, sous forme de modules
              indépendants.
            </p>
          ),
        },
        {
          num: "02",
          title: "Définitions",
          body: (
            <>
              <p>
                Dans les présentes CGV, les termes suivants ont la
                signification ci-après&nbsp;:
              </p>
              <p>
                — <strong>Service</strong>&nbsp;: le logiciel Quickarte et
                l&apos;ensemble des fonctionnalités mises à disposition du
                Client, y compris les Modules activés.
                <br />
                — <strong>Client</strong>&nbsp;: le marchand professionnel
                ayant souscrit un Abonnement au Service.
                <br />— <strong>Utilisateur Final</strong>&nbsp;: le client du
                Client qui interagit avec le Service (consultation du menu,
                commande en ligne, adhésion à la fidélité).
                <br />— <strong>Abonnement</strong>&nbsp;: le contrat par
                lequel le Client accède au Service moyennant une redevance
                mensuelle.
                <br />— <strong>Module</strong>&nbsp;: une fonctionnalité
                autonome du Service pouvant être activée indépendamment des
                autres (Menu &amp; QR, Commande en ligne, Fidélité, Analyses).
              </p>
            </>
          ),
        },
        {
          num: "03",
          title: "Commande et souscription",
          body: (
            <p>
              La souscription au Service s&apos;effectue à l&apos;issue
              d&apos;un échange direct avec l&apos;équipe de Quickarte, lors
              d&apos;une conversation téléphonique ou d&apos;une visite en
              établissement. L&apos;Abonnement est formalisé par un échange
              d&apos;emails, un bon de commande signé ou un contrat spécifique
              précisant notamment les Modules souscrits, le tarif applicable et
              la date de prise d&apos;effet.
            </p>
          ),
        },
        {
          num: "04",
          title: "Modèle tarifaire",
          body: (
            <>
              <p>
                L&apos;accès au Service est facturé sous la forme d&apos;un
                abonnement mensuel modulaire&nbsp;: le Client ne paie que pour
                les Modules qu&apos;il a activés. Les tarifs sont déterminés au
                cas par cas et communiqués au Client avant toute souscription.
              </p>
              <p>
                <strong>
                  Quickarte ne prélève aucune commission sur les ventes du
                  Client ni sur les commandes passées par les Utilisateurs
                  Finaux.
                </strong>{" "}
                L&apos;intégralité des revenus de Quickarte provient de
                l&apos;abonnement au Service.
              </p>
              <p>
                Sauf disposition contraire, les tarifs sont indiqués en euros
                hors taxes. Les factures sont émises mensuellement et payables
                à réception par prélèvement ou par virement, selon les
                modalités convenues.
              </p>
            </>
          ),
        },
        {
          num: "05",
          title: "Paiements des Utilisateurs Finaux",
          body: (
            <>
              <p>
                Les paiements effectués par les Utilisateurs Finaux via la
                fonction Commande en ligne sont encaissés{" "}
                <strong>directement par le Client</strong> via son compte
                Stripe Connect. Les fonds transitent exclusivement entre
                l&apos;Utilisateur Final, Stripe et le Client.
              </p>
              <p>
                <strong>
                  Quickarte n&apos;intervient à aucun moment dans le flux
                  financier et ne prélève aucune commission sur les
                  transactions.
                </strong>{" "}
                Les frais de traitement bancaire standards appliqués par
                Stripe relèvent de la relation contractuelle entre le Client
                et Stripe, indépendamment du présent contrat.
              </p>
            </>
          ),
        },
        {
          num: "06",
          title: "Obligations de Quickarte",
          body: (
            <>
              <p>
                Quickarte s&apos;engage à&nbsp;:
              </p>
              <p>
                — mettre en œuvre les moyens raisonnables pour assurer la
                disponibilité du Service (sans engagement de niveau de service
                contractuel strict dans la version actuelle des
                CGV)&nbsp;;<br />— fournir un support technique par email aux
                Clients, dans un délai raisonnable pendant les jours
                ouvrés&nbsp;;<br />— effectuer des sauvegardes régulières des
                données hébergées pour le compte du Client&nbsp;;<br />—
                informer le Client de toute évolution significative du Service
                susceptible d&apos;affecter son utilisation.
              </p>
            </>
          ),
        },
        {
          num: "07",
          title: "Obligations du Client",
          body: (
            <>
              <p>Le Client s&apos;engage à&nbsp;:</p>
              <p>
                — fournir des informations exactes, complètes et à jour lors de
                la souscription et pendant toute la durée de
                l&apos;Abonnement&nbsp;;<br />— respecter l&apos;ensemble de la
                législation applicable à son activité commerciale, notamment en
                matière de TVA, d&apos;hygiène alimentaire, d&apos;information
                du consommateur et d&apos;étiquetage&nbsp;;<br />— utiliser le
                Service conformément à sa destination et ne pas tenter de le
                contourner, de le détourner ou d&apos;en compromettre la
                sécurité&nbsp;;<br />— préserver la confidentialité de ses
                identifiants d&apos;accès.
              </p>
            </>
          ),
        },
        {
          num: "08",
          title: "Données personnelles",
          body: (
            <p>
              Le traitement des données personnelles collectées dans le cadre
              du Service est décrit dans notre{" "}
              <a
                href="/confidentialite"
                className="text-ink underline underline-offset-4 hover:text-accent transition"
              >
                politique de confidentialité
              </a>
              , qui fait partie intégrante du présent contrat.
            </p>
          ),
        },
        {
          num: "09",
          title: "Propriété intellectuelle",
          body: (
            <>
              <p>
                Le logiciel Quickarte, son code source, sa documentation, ses
                marques et ses éléments graphiques demeurent la propriété
                exclusive de Quickarte. Aucune disposition du contrat ne
                saurait être interprétée comme un transfert de droits de
                propriété intellectuelle au profit du Client.
              </p>
              <p>
                Quickarte concède au Client, pendant toute la durée de
                l&apos;Abonnement, une licence d&apos;usage non-exclusive,
                non-transférable et limitée à l&apos;exploitation du Service
                pour les besoins propres de son activité.
              </p>
            </>
          ),
        },
        {
          num: "10",
          title: "Résiliation",
          body: (
            <>
              <p>
                Le Client peut résilier son Abonnement à tout moment, par
                simple notification écrite adressée à{" "}
                <a
                  href="mailto:bonjour@quickarte.fr"
                  className="text-ink underline underline-offset-4 hover:text-accent transition"
                >
                  bonjour@quickarte.fr
                </a>
                . La résiliation prend effet à la fin du mois en cours.{" "}
                <strong>
                  Aucun remboursement n&apos;est effectué au prorata pour le
                  mois entamé.
                </strong>
              </p>
              <p>
                Quickarte peut résilier l&apos;Abonnement avec un préavis de 30
                jours, notifié par email. En cas de manquement grave du Client
                à ses obligations (notamment défaut de paiement, utilisation
                frauduleuse, non-respect de la législation applicable), la
                résiliation peut intervenir sans préavis après mise en demeure
                restée sans effet.
              </p>
            </>
          ),
        },
        {
          num: "11",
          title: "Responsabilité",
          body: (
            <>
              <p>
                Quickarte est tenue à une obligation de moyens dans
                l&apos;exécution des présentes. Sa responsabilité ne saurait
                être engagée qu&apos;en cas de faute prouvée et uniquement pour
                les dommages directs subis par le Client.
              </p>
              <p>
                <strong>
                  En tout état de cause, la responsabilité cumulée de Quickarte
                  au titre du présent contrat est limitée au montant des sommes
                  effectivement payées par le Client au titre de
                  l&apos;Abonnement au cours des douze (12) mois précédant le
                  fait générateur de la responsabilité.
                </strong>
              </p>
              <p>
                Quickarte ne saurait être tenue pour responsable des dommages
                indirects tels que perte de chiffre d&apos;affaires, perte de
                clientèle ou atteinte à l&apos;image.
              </p>
            </>
          ),
        },
        {
          num: "12",
          title: "Force majeure",
          body: (
            <p>
              Aucune des parties ne pourra être tenue pour responsable de tout
              manquement à ses obligations résultant d&apos;un cas de force
              majeure au sens de l&apos;article 1218 du Code civil, notamment —
              et sans que cette liste soit limitative — les catastrophes
              naturelles, grèves, pannes de réseau généralisées, décisions des
              autorités publiques ou cyberattaques affectant les infrastructures
              d&apos;hébergement.
            </p>
          ),
        },
        {
          num: "13",
          title: "Droit applicable et juridiction",
          body: (
            <p>
              Les présentes CGV sont soumises au droit français. Tout litige
              relatif à leur interprétation, leur exécution ou leur résiliation
              relève de la compétence exclusive des tribunaux de{" "}
              {"{TODO: ville du siège social, ex. Paris}"}, nonobstant
              pluralité de défendeurs ou appel en garantie.
            </p>
          ),
        },
        {
          num: "14",
          title: "Dispositions diverses",
          body: (
            <>
              <p>
                <strong>Nullité partielle&nbsp;:</strong> si une ou plusieurs
                stipulations des présentes étaient déclarées nulles ou
                inopposables, les autres stipulations conserveraient toute leur
                force et leur portée.
              </p>
              <p>
                <strong>Non-renonciation&nbsp;:</strong> le fait pour
                l&apos;une des parties de ne pas se prévaloir d&apos;un
                manquement de l&apos;autre partie à l&apos;une quelconque des
                obligations des présentes ne saurait être interprété comme une
                renonciation à se prévaloir ultérieurement dudit manquement.
              </p>
              <p>
                <strong>Intégralité du contrat&nbsp;:</strong> les présentes
                CGV, complétées le cas échéant par le bon de commande ou le
                contrat spécifique signé, constituent l&apos;intégralité de
                l&apos;accord des parties sur son objet.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
