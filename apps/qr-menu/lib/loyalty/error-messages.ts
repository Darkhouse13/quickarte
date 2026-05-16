/**
 * Short French strings for the typed error codes returned by the loyalty
 * server actions in lib/loyalty/actions.ts. Used to render server-rejected
 * validation errors inline below the offending field, or in a calm toast.
 *
 * Some codes (notably GOOGLE_PLACES_PREREQUISITES_MISSING) are returned with
 * a context-specific message from the server — for those, the caller should
 * prefer the server's message and fall back to the generic one here.
 */
export const LOYALTY_ERROR_MESSAGES = {
  VALIDATION_ERROR: "Paramètres invalides.",
  GOOGLE_PLACES_PREREQUISITES_MISSING:
    "Configurez d'abord votre identifiant Google Place.",
  NOT_FOUND: "Élément introuvable.",
  RATE_LIMITED:
    "Trop de tentatives pour le moment. Réessayez dans une heure.",
  REVIEW_NOT_FOUND:
    "Nous n'avons pas encore trouvé votre avis. Google peut prendre quelques minutes pour l'indexer. Réessayez dans 10 minutes.",
  REVIEW_ALREADY_CLAIMED: "Cet avis a déjà été crédité.",
  REVIEW_REWARD_DISABLED: "Cette récompense n'est pas activée.",
  LOYALTY_DISABLED: "Le programme n'est pas actif.",
  REDEMPTION_DISABLED: "Les récompenses ne sont pas actives.",
  ORDER_TYPE_DISABLED: "Ce type de commande est désactivé.",
  PRODUCT_NOT_REDEEMABLE: "Cet article n'est pas disponible en récompense.",
  INSUFFICIENT_CREDITS: "Solde de crédits insuffisant.",
  LOYALTY_NOT_ENTITLED: "Le programme de fidélité n'est pas actif.",
  NETWORK_ERROR: "Une erreur est survenue. Réessayez.",
} as const;

export type LoyaltyErrorCode = keyof typeof LOYALTY_ERROR_MESSAGES;

export function loyaltyErrorMessage(
  code: string | undefined,
  serverMessage?: string,
): string {
  if (serverMessage && serverMessage.trim().length > 0) return serverMessage;
  if (code && code in LOYALTY_ERROR_MESSAGES) {
    return LOYALTY_ERROR_MESSAGES[code as LoyaltyErrorCode];
  }
  return "Une erreur est survenue.";
}
