"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { formatOrderTime } from "@/lib/utils/date";
import {
  StatusBadge,
  type OrderStatus,
} from "@/components/ui/status-badge";
import { confirmOrder, completeOrder } from "@/lib/ordering/actions";
import type { OrderWithItems } from "@/lib/ordering/queries";

type OrderRowProps = {
  order: OrderWithItems;
  expanded: boolean;
  onToggle: () => void;
  muted?: boolean;
};

export function OrderRow({
  order,
  expanded,
  onToggle,
  muted = false,
}: OrderRowProps) {
  const status = order.status as OrderStatus;
  const isPending = status === "pending";
  const isDone = status === "completed";
  const barColor = isPending ? "bg-accent" : isDone ? "bg-outline" : "bg-ink";
  const total = Number(order.total);
  const time = formatOrderTime(order.createdAt);
  const isDineIn = order.type === "dine_in";

  return (
    <div
      className={cn(
        "border-b border-outline group relative",
        status === "confirmed" && "bg-black/[0.01]",
        muted && "opacity-70",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={cn(
          "w-full p-4 px-6 flex justify-between items-start gap-4 text-left hover:bg-black/[0.02] transition-colors cursor-pointer",
        )}
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
            <span
              className={cn(
                "font-bold text-[15px] leading-none",
                isDone && "text-ink/80",
              )}
            >
              {order.customerName}
            </span>
            <OrderTypeBadge dineIn={isDineIn} tableNumber={order.tableNumber} />
          </div>
          <span
            className={cn(
              "font-mono text-[12px] leading-none",
              isDone ? "text-ink/40" : "text-ink/50",
            )}
          >
            {time}
          </span>
        </div>
        <div
          className={cn(
            "flex flex-col items-end gap-2 flex-shrink-0",
            isDone && "text-ink/80",
          )}
        >
          <span className="font-mono text-[15px] font-bold leading-none text-right">
            {total.toFixed(0)}{" "}
            <span
              className={cn(
                "text-[10px] font-normal",
                isDone ? "text-ink/40" : "text-ink/50",
              )}
            >
              MAD
            </span>
          </span>
          <StatusBadge status={status} />
        </div>
      </button>

      {expanded ? <OrderDetail order={order} /> : null}
    </div>
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
    ? `Sur place${tableNumber ? ` · T${tableNumber}` : ""}`
    : "À emporter";
  return (
    <span className="bg-ink text-base text-[10px] uppercase font-mono px-1.5 py-0.5 leading-none">
      {label}
    </span>
  );
}

function OrderDetail({ order }: { order: OrderWithItems }) {
  const status = order.status as OrderStatus;
  return (
    <div className="bg-black/[0.01] border-t border-outline px-6 py-5 flex flex-col gap-4">
      <ul className="flex flex-col gap-1.5">
        {order.items.map((item) => (
          <li
            key={item.id}
            className="flex justify-between gap-4 font-mono text-[13px] leading-snug"
          >
            <span>
              <span className="font-bold">{item.quantity}×</span>{" "}
              {item.product?.name ?? "Article supprimé"}
            </span>
            <span className="text-ink/70 whitespace-nowrap">
              {Number(item.subtotal).toFixed(0)} MAD
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-1 font-mono text-[12px] uppercase tracking-widest">
        <div className="flex gap-2">
          <span className="text-ink/40">Tél</span>
          <span className="text-ink/80">
            {order.customerPhone ?? "—"}
          </span>
        </div>
        {order.notes ? (
          <p className="font-sans normal-case tracking-normal text-[13px] text-ink/50 mt-2 leading-snug">
            {order.notes}
          </p>
        ) : null}
      </div>

      {status !== "completed" ? (
        <div className="flex justify-end">
          <OrderActionButton orderId={order.id} status={status} />
        </div>
      ) : null}
    </div>
  );
}

function OrderActionButton({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const [pending, startTransition] = useTransition();
  const isConfirmStep = status === "pending";
  const label = isConfirmStep ? "Confirmer" : "Terminer";
  const colorClass = isConfirmStep
    ? "bg-ink text-base hover:bg-accent"
    : "bg-accent text-base hover:bg-ink";

  const run = () => {
    startTransition(async () => {
      if (isConfirmStep) {
        await confirmOrder(orderId);
      } else {
        await completeOrder(orderId);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className={cn(
        "px-5 py-3 font-mono font-bold uppercase tracking-widest text-[12px] transition-colors border-2 border-transparent focus:outline-none focus:border-ink focus:ring-4 focus:ring-accent/20 disabled:opacity-60 disabled:cursor-not-allowed",
        colorClass,
      )}
    >
      {pending ? "…" : label}
    </button>
  );
}

type OrdersBoardProps = {
  pending: OrderWithItems[];
  confirmed: OrderWithItems[];
  completed: OrderWithItems[];
};

export function OrdersBoard({
  pending,
  confirmed,
  completed,
}: OrdersBoardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toggle = (id: string) =>
    setExpandedId((curr) => (curr === id ? null : id));

  const totalCount = pending.length + confirmed.length + completed.length;
  if (totalCount === 0) {
    return (
      <div className="px-6 py-20 flex flex-col items-center text-center gap-6">
        <div className="w-12 h-12 border-2 border-ink flex items-center justify-center">
          <div className="w-3 h-3 bg-accent" />
        </div>
        <div className="flex flex-col gap-2 max-w-[320px]">
          <p className="font-sans text-[15px] text-ink font-bold">
            Aucune commande pour le moment
          </p>
          <p className="font-sans text-sm text-ink/60 leading-snug">
            Partagez votre QR code pour recevoir des commandes !
          </p>
        </div>
        <Link
          href="/store"
          className="bg-ink text-base px-6 py-3 font-mono font-bold uppercase tracking-widest text-[12px] hover:bg-accent transition-colors border-2 border-ink focus:outline-none focus:ring-4 focus:ring-accent/20"
        >
          Voir mon QR code →
        </Link>
      </div>
    );
  }

  return (
    <>
      <Section
        index={1}
        title="En attente"
        accent
        orders={pending}
        expandedId={expandedId}
        onToggle={toggle}
        emptyLabel="Aucune commande en attente"
      />
      <Section
        index={2}
        title="Confirmées"
        orders={confirmed}
        expandedId={expandedId}
        onToggle={toggle}
        emptyLabel="Aucune commande confirmée"
      />
      <Section
        index={3}
        title="Terminées"
        orders={completed}
        expandedId={expandedId}
        onToggle={toggle}
        emptyLabel="Aucune commande terminée"
        muted
      />
    </>
  );
}

function Section({
  index,
  title,
  orders,
  expandedId,
  onToggle,
  emptyLabel,
  accent = false,
  muted = false,
}: {
  index: number;
  title: string;
  orders: OrderWithItems[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  emptyLabel: string;
  accent?: boolean;
  muted?: boolean;
}) {
  const padded = String(index).padStart(2, "0");
  return (
    <section className="border-b-4 border-outline">
      <div
        className={cn(
          "px-6 py-6 border-b border-outline bg-base/50 flex items-center justify-between",
          accent && "bg-accent/[0.02]",
        )}
      >
        <h2
          className={cn(
            "font-mono font-bold text-lg uppercase tracking-widest",
            accent ? "text-accent" : "text-ink/40",
          )}
        >
          {padded} / {title}
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink/50 font-bold">
          {orders.length}
        </span>
      </div>
      {orders.length === 0 ? (
        <p className="px-6 py-5 font-sans text-sm text-ink/40">{emptyLabel}</p>
      ) : (
        <div className="flex flex-col">
          {orders.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              expanded={expandedId === order.id}
              onToggle={() => onToggle(order.id)}
              muted={muted}
            />
          ))}
        </div>
      )}
    </section>
  );
}
