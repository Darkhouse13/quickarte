import { cn } from "@/lib/utils/cn";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "served"
  | "paid"
  | "completed"
  | "cancelled";

const LABELS: Record<OrderStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  preparing: "Préparation",
  ready: "Prête",
  served: "Servie",
  paid: "Payée",
  completed: "Terminée",
  cancelled: "Annulée",
};

const STYLES: Record<OrderStatus, string> = {
  pending: "border border-accent text-accent",
  confirmed: "bg-ink text-base border border-ink",
  preparing: "border border-accent text-accent",
  ready: "bg-base text-ink border border-accent",
  served: "bg-blue-100 text-blue-800 border border-blue-200",
  paid: "bg-outline text-ink/60 border border-outline",
  completed: "bg-outline text-ink/60 border border-outline",
  cancelled: "border border-outline text-ink/60 line-through",
};

type StatusBadgeProps = {
  status: OrderStatus;
  label?: string;
  className?: string;
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "px-1.5 py-0.5 text-[9px] uppercase font-mono font-bold tracking-widest leading-none",
        STYLES[status],
        className,
      )}
    >
      {label ?? LABELS[status]}
    </span>
  );
}
