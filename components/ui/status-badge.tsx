import { cn } from "@/lib/utils/cn";

export type OrderStatus = "pending" | "confirmed" | "completed";

const LABELS: Record<OrderStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  completed: "Terminée",
};

const STYLES: Record<OrderStatus, string> = {
  pending: "border border-accent text-accent",
  confirmed: "bg-ink text-base border border-ink",
  completed: "bg-outline text-ink/60 border border-outline",
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
