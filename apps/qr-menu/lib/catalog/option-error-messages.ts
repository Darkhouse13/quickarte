import type { OrderPlacementErrorCode } from "@/lib/ordering/line-validation";

/**
 * Short French strings for the typed option/variant error codes. Used to render
 * server-rejected validation errors inline below the offending field.
 */
export const OPTION_ERROR_MESSAGES: Record<OrderPlacementErrorCode, string> = {
  PRODUCT_UNAVAILABLE: "Cet article n'est plus disponible.",
  VARIANT_INVALID: "Cette taille n'est pas valide.",
  OPTION_REQUIRED_MISSING: "Cette option est obligatoire.",
  OPTION_MIN_NOT_MET: "Pas assez de choix pour cette option.",
  OPTION_MAX_EXCEEDED: "Trop de choix pour cette option.",
  OPTION_SINGLE_INVALID: "Un seul choix est autorisé pour cette option.",
  OPTION_VALUE_INVALID: "Ce choix n'est pas valide.",
  PRICE_RESOLVED_NEGATIVE: "Le prix calculé est invalide.",
};

export function optionErrorMessage(code: OrderPlacementErrorCode): string {
  return OPTION_ERROR_MESSAGES[code] ?? "Une erreur est survenue.";
}
