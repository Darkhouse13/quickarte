// Single source of truth for every Quickarte-specific legal identifier.
// Values prefixed with "À COMPLÉTER" are placeholders: the founder fills them in
// once (ideally after a Moroccan lawyer reviews the draft copy), and the draft
// banner on each legal page auto-hides. No other file should hard-code these.

export const QUICKARTE_LEGAL = {
  companyLegalName: "À COMPLÉTER — Raison sociale",
  companyShortName: "Quickarte",
  rcNumber: "À COMPLÉTER — Numéro RC",
  iceNumber: "À COMPLÉTER — Numéro ICE",
  capitalSocial: "À COMPLÉTER — Capital social",
  registeredAddress: "À COMPLÉTER — Adresse du siège social",
  publicationDirector: "À COMPLÉTER — Directeur de la publication",
  contactEmail: "bonjour@quickarte.fr",
  contactWhatsapp: "À COMPLÉTER — Numéro WhatsApp",
  cndpDeclarationNumber: "À COMPLÉTER — Numéro de déclaration CNDP",
} as const;

export type QuickarteLegalIdentifiers = Record<
  keyof typeof QUICKARTE_LEGAL,
  string
>;

const PLACEHOLDER_PREFIX = "À COMPLÉTER";

export function isPlaceholder(value: string): boolean {
  return value.startsWith(PLACEHOLDER_PREFIX);
}

// True while any identifier is still a placeholder — drives the draft banner.
export function hasIncompleteIdentifiers(
  identifiers: QuickarteLegalIdentifiers = QUICKARTE_LEGAL,
): boolean {
  return Object.values(identifiers).some(isPlaceholder);
}
