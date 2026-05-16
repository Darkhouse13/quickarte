import type { OrderLifecycleStatus } from "@/lib/ordering/status";

export type KitchenColumn = "to_prepare" | "in_progress" | "ready";

export const KITCHEN_COLUMN_ORDER: readonly KitchenColumn[] = [
  "to_prepare",
  "in_progress",
  "ready",
] as const;

export const KITCHEN_COLUMN_LABELS: Record<KitchenColumn, string> = {
  to_prepare: "À préparer",
  in_progress: "En préparation",
  ready: "Prêt",
};

export const KITCHEN_COLUMN_EMPTY_COPY: Record<KitchenColumn, string> = {
  to_prepare: "Rien à préparer pour le moment.",
  in_progress: "Aucune commande en préparation.",
  ready: "Aucune commande prête.",
};

export function bucketOrderByStatus(
  status: OrderLifecycleStatus,
): KitchenColumn | null {
  switch (status) {
    case "pending":
    case "confirmed":
      return "to_prepare";
    case "preparing":
      return "in_progress";
    case "ready":
      return "ready";
    case "completed":
    case "cancelled":
      return null;
  }
}
