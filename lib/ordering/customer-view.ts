import { normalizeMoroccanPhone } from "@/lib/utils/phone";

// Inlined from the removed kitchen module — the customer tracker is the only
// remaining caller. Formats a positive elapsed duration as "X min" / "H h MM".
function formatElapsedFr(elapsedMs: number): string {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return "< 1 min";
  const totalMinutes = Math.floor(elapsedMs / 1000 / 60);
  if (totalMinutes < 1) return "< 1 min";
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} h ${minutes.toString().padStart(2, "0")}`;
}

// The customer-facing page speaks in finished French words, not lifecycle
// codes. `confirmed` is still "Reçue" to the customer — the kitchen accepting
// an order is not a milestone she needs to distinguish from it landing.
const STATUS_LABELS: Record<string, string> = {
  pending: "Reçue",
  confirmed: "Reçue",
  preparing: "En préparation",
  ready: "Prête",
  completed: "Servie",
  cancelled: "Annulée",
};

export function customerStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? "Reçue";
}

export function customerStatusContext(status: string, type: string): string {
  switch (status) {
    case "pending":
    case "confirmed":
      return "Votre commande est bien arrivée.";
    case "preparing":
      return "Le restaurant prépare votre commande.";
    case "ready":
      if (type === "dine_in") return "Sera apportée à votre table.";
      if (type === "takeaway") return "Prête à emporter.";
      return "À retirer au comptoir.";
    case "completed":
      return "Merci.";
    case "cancelled":
      return "Contactez le restaurant pour en savoir plus.";
    default:
      return "Votre commande est bien arrivée.";
  }
}

// Terminal for the customer's purposes: nothing more will change, so polling
// can stop forever. Maps to the lifecycle's `completed` / `cancelled`.
export function isCustomerTerminalStatus(status: string): boolean {
  return status === "completed" || status === "cancelled";
}

export function formatShortOrderId(orderId: string): string {
  return orderId.slice(0, 6).toUpperCase();
}

export function formatElapsedSinceFr(elapsedMs: number): string {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 60_000) return "À l'instant";
  return `Il y a ${formatElapsedFr(elapsedMs)}`;
}

export type WhatsappLink = {
  url: string;
  display: string;
};

export function buildWhatsappLink(
  rawNumber: string | null | undefined,
  shortOrderId: string,
): WhatsappLink | null {
  if (!rawNumber || rawNumber.trim().length === 0) return null;

  // The utils normalizer throws on a non-Moroccan-mobile input; fall back to the
  // raw trimmed number so a foreign/landline number still yields a wa.me link.
  let e164: string;
  try {
    e164 = normalizeMoroccanPhone(rawNumber);
  } catch {
    e164 = rawNumber.trim();
  }
  const digits = e164.replace(/\D/g, "");
  if (digits.length < 8) return null;

  const prefill = `Bonjour, à propos de ma commande #${shortOrderId}.`;
  return {
    url: `https://wa.me/${digits}?text=${encodeURIComponent(prefill)}`,
    display: formatWhatsappDisplay(e164),
  };
}

function formatWhatsappDisplay(e164: string): string {
  const match = /^\+212([67])(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(e164);
  if (match) {
    const [, lead, a, b, c, d] = match;
    return `+212 ${lead} ${a} ${b} ${c} ${d}`;
  }
  return e164;
}
