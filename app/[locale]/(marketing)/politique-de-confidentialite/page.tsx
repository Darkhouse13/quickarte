import type { Metadata } from "next";
import { LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell";
import { QUICKARTE_LEGAL, isPlaceholder } from "@/lib/legal/identifiers";
import { SUBPROCESSORS } from "@/lib/legal/subprocessors";

const LAST_UPDATED_FR = "14 mai 2026";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Quickarte",
  description:
    "Comment Quickarte collecte, utilise et protège les données personnelles, conformément à la loi 09-08.",
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function PolitiqueConfidentialitePage({ params }: Props) {
  const { locale } = await params;
  const L = QUICKARTE_LEGAL;
  const cndpDeclared = !isPlaceholder(L.cndpDeclarationNumber);

  return (
    <LegalPageShell
      locale={locale}
      title="Politique de confidentialité"
      lastUpdated={LAST_UPDATED_FR}
    >
      <LegalSection title="Responsable du traitement">
        <p>
          Le responsable du traitement des données personnelles est{" "}
          {L.companyLegalName}. Pour toute question relative à cette politique,
          vous pouvez écrire à{" "}
          <a
            href={`mailto:${L.contactEmail}`}
            className="text-ink underline underline-offset-2 hover:text-accent transition"
          >
            {L.contactEmail}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Données collectées">
        <p>Quickarte collecte les catégories de données suivantes&nbsp;:</p>
        <ul className="space-y-2">
          <li>
            <strong className="text-ink/80">Comptes commerçants</strong> —
            nom, email, téléphone (optionnel), mot de passe haché.
          </li>
          <li>
            <strong className="text-ink/80">Établissements</strong> — nom de
            l&apos;établissement, adresse, type, slug, paramètres
            opérationnels.
          </li>
          <li>
            <strong className="text-ink/80">Catalogue</strong> — noms et
            descriptions d&apos;articles, prix, images (hébergées par
            Cloudinary).
          </li>
          <li>
            <strong className="text-ink/80">Commandes</strong> — articles
            commandés, montants, numéro de table, statut.
          </li>
          <li>
            <strong className="text-ink/80">Clients finaux</strong> — nom et
            téléphone optionnels saisis lors de la commande&nbsp;; aucun email
            n&apos;est obligatoire.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Finalités du traitement">
        <p>
          Les données sont traitées pour&nbsp;: l&apos;exploitation du service
          Quickarte, le support aux commerçants, la sécurité du service, et une
          analytique technique anonyme destinée à améliorer le produit.
        </p>
      </LegalSection>

      <LegalSection title="Bases légales">
        <p>
          Le traitement repose sur&nbsp;: l&apos;exécution du contrat de service
          pour les commerçants, l&apos;intérêt légitime pour la sécurité du
          service, et le consentement explicite pour les cookies non
          essentiels.
        </p>
      </LegalSection>

      <LegalSection title="Durée de conservation">
        <ul className="space-y-1">
          <li>Comptes actifs&nbsp;: jusqu&apos;à leur suppression.</li>
          <li>Comptes inactifs&nbsp;: 36 mois.</li>
          <li>Logs techniques&nbsp;: 12 mois.</li>
          <li>
            Commandes&nbsp;: 10 ans, au titre des obligations comptables
            marocaines.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Destinataires">
        <p>
          Les données sont traitées par les sous-traitants techniques suivants,
          chacun strictement dans le cadre de la prestation indiquée&nbsp;:
        </p>
        <table className="w-full border-t-2 border-b-2 border-ink mt-2 text-[13px] leading-snug">
          <thead>
            <tr className="border-b border-outline">
              <th className="text-left font-mono uppercase tracking-widest text-[10px] text-ink/40 py-2 pr-3">
                Sous-traitant
              </th>
              <th className="text-left font-mono uppercase tracking-widest text-[10px] text-ink/40 py-2 pr-3">
                Rôle
              </th>
              <th className="text-left font-mono uppercase tracking-widest text-[10px] text-ink/40 py-2">
                Localisation
              </th>
            </tr>
          </thead>
          <tbody>
            {SUBPROCESSORS.map((s) => (
              <tr key={s.name} className="border-b border-outline last:border-b-0">
                <td className="py-2.5 pr-3 align-top text-ink/80">
                  <a
                    href={s.website}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 hover:text-accent transition"
                  >
                    {s.name}
                  </a>
                </td>
                <td className="py-2.5 pr-3 align-top">{s.role}</td>
                <td className="py-2.5 align-top">{s.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </LegalSection>

      <LegalSection title="Transferts hors Maroc">
        <p>
          Les données principales (comptes, établissements, catalogues,
          commandes) sont hébergées en Allemagne (Hetzner), au sein de
          l&apos;Union européenne. Certains sous-traitants opèrent depuis les
          États-Unis ou à l&apos;échelle mondiale (CDN), comme indiqué dans le
          tableau ci-dessus. Ces transferts sont encadrés par des garanties
          contractuelles standard avec chaque sous-traitant.
        </p>
      </LegalSection>

      <LegalSection title="Vos droits (loi 09-08)">
        <p>
          Conformément à la loi 09-08 relative à la protection des personnes
          physiques à l&apos;égard du traitement des données à caractère
          personnel, vous disposez d&apos;un droit d&apos;accès, de
          rectification, d&apos;opposition, d&apos;effacement et de portabilité
          de vos données.
        </p>
        <p>
          Pour exercer ces droits, écrivez à{" "}
          <a
            href={`mailto:${L.contactEmail}`}
            className="text-ink underline underline-offset-2 hover:text-accent transition"
          >
            {L.contactEmail}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="CNDP">
        <p>
          La Commission Nationale de Contrôle de la Protection des Données à
          Caractère Personnel (CNDP) est l&apos;autorité marocaine chargée de
          veiller au respect de la loi 09-08.
        </p>
        {cndpDeclared ? (
          <p>
            Le traitement réalisé par Quickarte fait l&apos;objet de la
            déclaration CNDP n°&nbsp;{L.cndpDeclarationNumber}.
          </p>
        ) : null}
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          Quickarte utilise uniquement des cookies essentiels au fonctionnement
          du service (notamment la session de connexion). Aucun traceur tiers
          n&apos;est déposé sans votre consentement. Vous pouvez à tout moment
          gérer ou supprimer les cookies via les paramètres de votre
          navigateur.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Pour toute question relative à cette politique de confidentialité,
          contactez-nous à{" "}
          <a
            href={`mailto:${L.contactEmail}`}
            className="text-ink underline underline-offset-2 hover:text-accent transition"
          >
            {L.contactEmail}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
