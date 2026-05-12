"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { formatAmount, formatAmountCompact } from "@/lib/utils/currency";
import { StatusBadge, type OrderStatus } from "@/components/ui/status-badge";
import { cancelOrder, transitionOrderStatus } from "@/lib/ordering/actions";
import { parseOrderItemOptions } from "@/lib/ordering/options-summary";
import {
  isTerminalOrderStatus,
  PRIMARY_ORDER_ACTIONS,
  type OrderLifecycleStatus,
} from "@/lib/ordering/status";
import type { OrderWithItems } from "@/lib/ordering/queries";

type OrderRowProps = {
  order: OrderWithItems;
  expanded: boolean;
  onToggle: () => void;
};

export function OrdersPoller() {
  const router = useRouter();

  useEffect(() => {
    const id = window.setInterval(() => router.refresh(), 15_000);
    return () => window.clearInterval(id);
  }, [router]);

  return null;
}

export function OrderRow({ order, expanded, onToggle }: OrderRowProps) {
  const status = order.status as OrderStatus;
  const barColor = getBarColor(status);
  const total = Number(order.total);
  const isDineIn = order.type === "dine_in";

  return (
    <div
      className={cn(
        "border-b border-outline group relative",
        status === "cancelled" && "opacity-70",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full p-4 px-6 flex justify-between items-start gap-4 text-left hover:bg-black/[0.02] transition-colors cursor-pointer"
      >
        <div
          className={cn(
            "absolute left-0 top-0 w-1 h-full scale-y-0 group-hover:scale-y-100 transition-transform origin-top",
            expanded && "scale-y-100",
            barColor,
          )}
        />
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[11px] leading-none text-ink/45 font-bold">
              #{shortOrderId(order.id)}
            </span>
            <span className="font-bold text-[15px] leading-none truncate">
              {order.customerName}
            </span>
            <OrderTypeBadge dineIn={isDineIn} tableNumber={order.tableNumber} />
          </div>
          <div className="flex flex-col gap-1 font-mono text-[12px] leading-none text-ink/50">
            <span className="truncate">
              {order.customerPhone ?? "T\u00e9l\u00e9phone absent"}
            </span>
            <span>{formatRelativeTime(order.createdAt)}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className="font-mono text-[15px] font-bold leading-none text-right">
            {formatAmountCompact(total)}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <PaymentPill status={order.paymentStatus} />
            <StatusBadge status={status} />
          </div>
        </div>
      </button>

      {expanded ? <OrderDetail order={order} /> : null}
    </div>
  );
}

function PaymentPill({
  status,
}: {
  status: "unpaid" | "paid" | "refunded" | "failed";
}) {
  if (status === "paid") {
    return (
      <span className="px-1.5 py-0.5 text-[9px] uppercase font-mono font-bold tracking-widest leading-none bg-accent text-base">
        {"Pay\u00e9"}
      </span>
    );
  }
  if (status === "refunded") {
    return (
      <span className="px-1.5 py-0.5 text-[9px] uppercase font-mono font-bold tracking-widest leading-none border border-outline text-ink/50">
        Remb.
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="px-1.5 py-0.5 text-[9px] uppercase font-mono font-bold tracking-widest leading-none border border-accent text-accent">
        {"\u00c9chec"}
      </span>
    );
  }
  return (
    <span className="px-1.5 py-0.5 text-[9px] uppercase font-mono font-bold tracking-widest leading-none border border-outline text-ink/50">
      Sur place
    </span>
  );
}

function OrderTypeBadge({
  dineIn,
  tableNumber,
}: {
  dineIn: boolean;
  tableNumber: string | null;
}) {
  const label = dineIn
    ? `Sur Place${tableNumber ? ` / T${tableNumber}` : ""}`
    : "\u00c0 Emporter";
  return (
    <span className="bg-ink text-base text-[10px] uppercase font-mono px-1.5 py-0.5 leading-none">
      {label}
    </span>
  );
}

function OrderDetail({ order }: { order: OrderWithItems }) {
  const status = order.status as OrderLifecycleStatus;
  const isDineIn = order.type === "dine_in";

  return (
    <div className="bg-black/[0.01] border-t border-outline px-6 py-5 flex flex-col gap-5">
      <section className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3 font-mono text-[12px] uppercase tracking-widest">
        <DetailPair label="Client" value={order.customerName} />
        <DetailPair label={"T\u00e9l"} value={order.customerPhone ?? "-"} />
        <DetailPair label="Type" value={isDineIn ? "Sur Place" : "\u00c0 Emporter"} />
        {isDineIn ? (
          <DetailPair label="Table" value={order.tableNumber ?? "-"} />
        ) : null}
        {order.notes ? (
          <p className="min-[420px]:col-span-2 font-sans normal-case tracking-normal text-[13px] text-ink/60 leading-snug border-t border-outline pt-3">
            {order.notes}
          </p>
        ) : null}
      </section>

      <ul className="flex flex-col gap-3">
        {order.items.map((item) => (
          <OrderLineItem key={item.id} item={item} />
        ))}
      </ul>

      <div className="border-t-2 border-ink pt-4 flex justify-between items-center font-mono font-bold uppercase tracking-widest text-[13px]">
        <span>Total</span>
        <span>{formatAmount(Number(order.total))}</span>
      </div>

      {!isTerminalOrderStatus(status) ? (
        <OrderActions orderId={order.id} status={status} />
      ) : null}
    </div>
  );
}

function DetailPair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-ink/40">{label}</span>
      <span className="text-ink/80 truncate">{value}</span>
    </div>
  );
}

function OrderLineItem({ item }: { item: OrderWithItems["items"][number] }) {
  const parsed = parseOrderItemOptions(item.optionsJson);

  return (
    <li className="border border-outline p-3 flex flex-col gap-2">
      <div className="flex justify-between gap-4">
        <span className="font-sans text-[14px] leading-snug font-bold min-w-0">
          {item.product?.name ?? "Article supprim\u00e9"}{" "}
          <span className="font-mono text-ink/50">x{item.quantity}</span>
        </span>
        <span className="font-mono text-[12px] text-ink/60 whitespace-nowrap">
          {formatAmount(Number(item.unitPrice))}
        </span>
      </div>

      {parsed.variantName ? (
        <p className="font-mono text-[11px] uppercase tracking-widest text-ink/55 leading-snug">
          Variante : {parsed.variantName}
        </p>
      ) : null}
      {parsed.options.map((option) => (
        <p
          key={option.optionName}
          className="font-mono text-[11px] uppercase tracking-widest text-ink/55 leading-snug"
        >
          {option.optionName} :{" "}
          {option.values
            .map((value) =>
              value.priceAddition > 0
                ? `${value.valueName} (+${formatAmount(value.priceAddition)})`
                : value.valueName,
            )
            .join(", ")}
        </p>
      ))}

      <div className="flex justify-end font-mono text-[12px] font-bold text-ink">
        {formatAmount(Number(item.subtotal))}
      </div>
    </li>
  );
}

function OrderActions({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderLifecycleStatus;
}) {
  const [pending, startTransition] = useTransition();
  const action = PRIMARY_ORDER_ACTIONS[status];

  const runPrimary = () => {
    if (!action) return;
    startTransition(async () => {
      const result = await transitionOrderStatus(orderId, action.next);
      if (result.status === "error") window.alert(result.message);
    });
  };

  const runCancel = () => {
    if (!window.confirm("Annuler cette commande ?")) return;
    startTransition(async () => {
      const result = await cancelOrder(orderId);
      if (result.status === "error") window.alert(result.message);
    });
  };

  return (
    <div className="flex flex-col min-[420px]:flex-row justify-end gap-2">
      {action ? (
        <button
          type="button"
          onClick={runPrimary}
          disabled={pending}
          className="px-5 py-3 font-mono font-bold uppercase tracking-widest text-[12px] transition-colors border-2 border-ink bg-ink text-base hover:bg-accent hover:text-base focus:outline-none focus:ring-4 focus:ring-accent/20 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? "..." : action.label}
        </button>
      ) : null}
      <button
        type="button"
        onClick={runCancel}
        disabled={pending}
        className="px-5 py-3 font-mono font-bold uppercase tracking-widest text-[12px] transition-colors border-2 border-accent text-accent bg-base hover:bg-accent hover:text-base focus:outline-none focus:ring-4 focus:ring-accent/20 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        Annuler
      </button>
    </div>
  );
}

type OrdersBoardProps = {
  orders: OrderWithItems[];
};

export function OrdersBoard({ orders }: OrdersBoardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toggle = (id: string) =>
    setExpandedId((curr) => (curr === id ? null : id));

  if (orders.length === 0) {
    return (
      <div className="px-6 py-20 flex flex-col items-center text-center gap-4">
        <div className="w-12 h-12 border-2 border-ink flex items-center justify-center">
          <div className="w-3 h-3 bg-accent" />
        </div>
        <p className="font-mono text-[12px] uppercase tracking-widest text-ink/50 font-bold">
          Aucune commande pour le moment
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {orders.map((order) => (
        <OrderRow
          key={order.id}
          order={order}
          expanded={expandedId === order.id}
          onToggle={() => toggle(order.id)}
        />
      ))}
    </div>
  );
}

function getBarColor(status: OrderStatus): string {
  if (status === "pending" || status === "preparing") return "bg-accent";
  if (status === "completed" || status === "cancelled") return "bg-outline";
  return "bg-ink";
}

function shortOrderId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function formatRelativeTime(input: Date | string): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (diffMinutes < 1) return "\u00e0 l'instant";
  if (diffMinutes < 60) return `il y a ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `il y a ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `il y a ${diffDays} j`;
}
