import type { StaffRole } from "@/lib/identity/permissions";

const EVENT_LABELS_FR: Record<string, string> = {
  "order.created": "Commande créée",
  "order.accepted": "Acceptée",
  "order.preparing": "En préparation",
  "order.ready": "Prête",
  "order.served": "Servie",
  "order.cancelled": "Annulée",
  "order.printed": "Ticket imprimé",
  "order.reprinted": "Ticket réimprimé",
  "order.pos_entered": "Entrée en caisse",
  "order.pos_skipped": "Sautée en caisse",
  "order.pos_reverted": "Caisse annulée",
};

const ROLE_LABELS_FR: Record<string, string> = {
  owner: "Propriétaire",
  manager: "Gérant",
  waiter: "Serveur",
  kitchen: "Cuisine",
  cashier: "Caisse",
  customer: "Client",
  system: "Système",
};

export function eventLabelFr(eventType: string): string {
  return EVENT_LABELS_FR[eventType] ?? eventType;
}

export function roleLabelFr(
  role: StaffRole | "customer" | "system" | null,
): string | null {
  if (!role) return null;
  return ROLE_LABELS_FR[role] ?? role;
}

const CASABLANCA_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Africa/Casablanca",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatCasablancaTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return CASABLANCA_FORMATTER.format(date).replace(",", " ·");
  } catch {
    return iso;
  }
}

export function summarisePayload(
  payload: Record<string, unknown> | null,
): string | null {
  if (!payload) return null;
  if (typeof payload.reason === "string" && payload.reason.trim().length > 0) {
    return `Motif : ${payload.reason}`;
  }
  if (
    typeof payload.posReference === "string" &&
    payload.posReference.trim().length > 0
  ) {
    return `Réf caisse : ${payload.posReference}`;
  }
  if (
    typeof payload.from_status === "string" &&
    typeof payload.to_status === "string"
  ) {
    return `${payload.from_status} → ${payload.to_status}`;
  }
  if (typeof payload.order_type === "string") {
    return payload.order_type === "dine_in"
      ? "Sur place"
      : payload.order_type === "takeaway"
        ? "À emporter"
        : String(payload.order_type);
  }
  if (payload.status === "enqueue_failed" && typeof payload.error === "string") {
    return `Impression non planifiee : ${payload.error}`;
  }
  if (payload.status === "failed" && typeof payload.error === "string") {
    return `Impression echouee : ${payload.error}`;
  }
  if (payload.status === "printed") {
    return "Impression confirmee";
  }
  return null;
}
