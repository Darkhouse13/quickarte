"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { formatAmount, formatAmountCompact } from "@/lib/utils/currency";
import { StatusBadge, type OrderStatus } from "@/components/ui/status-badge";
import {
  cancelOrder,
  markOrderEnteredInPos,
  markOrderServed,
  revertOrderPosStatus,
  transitionOrderStatus,
} from "@/lib/ordering/actions";
import { enqueuePrintJob } from "@/lib/printing/actions";
import { summarizeOrderItemOptions } from "@/lib/ordering/order-item-options";
import {
  canShowServirButton,
  isTerminalOrderStatus,
  PRIMARY_ORDER_ACTIONS,
  type OrderLifecycleStatus,
} from "@/lib/ordering/status";
import type { OrderWithItems } from "@/lib/ordering/queries";
import { shouldShowRedemptionPill } from "@/lib/loyalty/redemption-pill";
import type { StaffRole } from "@/lib/identity/permissions";
import type { JournalEvent } from "@/lib/ordering/event-queries";
import {
  eventLabelFr,
  formatCasablancaTimestamp,
  roleLabelFr,
  summarisePayload,
} from "@/lib/ordering/journal-format";

type OrderRowProps = {
  order: OrderWithItems;
  events: JournalEvent[];
  expanded: boolean;
  onToggle: () => void;
  role: StaffRole;
  posCoexistenceEnabled: boolean;
};

export function OrdersPoller({ pendingOrderIds }: { pendingOrderIds: string[] }) {
  const router = useRouter();
  const [soundEnabled, setSoundEnabled] = useState(false);
  const previousPending = useRef(new Set(pendingOrderIds));

  useEffect(() => {
    const id = window.setInterval(() => router.refresh(), 15_000);
    return () => window.clearInterval(id);
  }, [router]);

  useEffect(() => {
    const next = new Set(pendingOrderIds);
    const hasNew = pendingOrderIds.some((id) => !previousPending.current.has(id));
    previousPending.current = next;
    if (hasNew && soundEnabled) playOrderTone();
  }, [pendingOrderIds, soundEnabled]);

  if (soundEnabled) return null;
  return (
    <div className="px-6 py-3 border-b border-outline bg-black/[0.02]">
      <button
        type="button"
        onClick={() => {
          setSoundEnabled(true);
          playOrderTone();
        }}
        className="font-mono text-[11px] uppercase tracking-widest text-ink hover:text-accent"
      >
        Activer le son des commandes
      </button>
    </div>
  );
}

export function OrderRow({
  order,
  events,
  expanded,
  onToggle,
  role,
  posCoexistenceEnabled,
}: OrderRowProps) {
  // Optimistic state for the SERVIR action: the row flips to `Servie` the
  // instant the merchant taps, and rolls back if the server rejects it. The
  // transition lives here, on the always-mounted row, because the SERVIR
  // button itself unmounts the moment the order flips to a terminal status.
  const [servedOptimistic, setServedOptimistic] = useState(false);
  const [serveError, setServeError] = useState(false);
  const [servePending, startServeTransition] = useTransition();
  const status = (servedOptimistic ? "completed" : order.status) as OrderStatus;
  const barColor = getBarColor(status);
  const total = Number(order.total);
  const isDineIn = order.type === "dine_in";

  const handleServe = () => {
    setServedOptimistic(true);
    setServeError(false);
    startServeTransition(async () => {
      const result = await markOrderServed(order.id);
      if (result.status === "error") {
        setServedOptimistic(false);
        setServeError(true);
        window.setTimeout(() => setServeError(false), 4_000);
      }
    });
  };

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
            {shouldShowRedemptionPill(order) ? (
              <span
                className="px-1.5 py-0.5 text-[9px] uppercase font-mono font-bold tracking-widest leading-none border border-ink text-ink"
                aria-label="Commande payée en crédits"
              >
                Récompense
              </span>
            ) : null}
            <PaymentPill status={order.paymentStatus} />
            <StatusBadge
              status={status}
              label={servedOptimistic ? "Servie" : undefined}
            />
            {posCoexistenceEnabled && order.posStatus === "pending" ? (
              <span className="px-1.5 py-0.5 text-[9px] uppercase font-mono font-bold tracking-widest leading-none border border-outline text-ink/55">
                À entrer en caisse
              </span>
            ) : null}
          </div>
        </div>
      </button>

      {expanded ? (
        <OrderDetail
          order={order}
          events={events}
          role={role}
          posCoexistenceEnabled={posCoexistenceEnabled}
          servedOptimistic={servedOptimistic}
          servePending={servePending}
          onServe={handleServe}
        />
      ) : null}

      {serveError ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 border-2 border-accent bg-base px-5 py-3 max-w-[420px] w-[calc(100%-32px)]"
        >
          <p className="font-sans text-[13px] text-ink leading-snug">
            Impossible de marquer cette commande comme servie.
          </p>
        </div>
      ) : null}
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
    ? `Sur place${tableNumber ? ` / T${tableNumber}` : ""}`
    : "\u00c0 emporter";
  return (
    <span className="bg-ink text-base text-[10px] uppercase font-mono px-1.5 py-0.5 leading-none">
      {label}
    </span>
  );
}

function OrderDetail({
  order,
  events,
  role,
  posCoexistenceEnabled,
  servedOptimistic,
  servePending,
  onServe,
}: {
  order: OrderWithItems;
  events: JournalEvent[];
  role: StaffRole;
  posCoexistenceEnabled: boolean;
  servedOptimistic: boolean;
  servePending: boolean;
  onServe: () => void;
}) {
  const status = (servedOptimistic
    ? "completed"
    : order.status) as OrderLifecycleStatus;
  const isDineIn = order.type === "dine_in";

  // While the optimistic serve is in flight the journal shows a synthetic
  // `Servie` entry; once the revalidated server data carries the real event
  // the synthetic one is dropped to avoid a duplicate.
  const hasServedEvent = events.some((e) => e.eventType === "order.served");
  const journalEvents =
    servedOptimistic && !hasServedEvent
      ? [...events, optimisticServedEvent(order.id)]
      : events;

  return (
    <div className="order-ticket-print bg-black/[0.01] border-t border-outline px-6 py-5 flex flex-col gap-5">
      <section className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3 font-mono text-[12px] uppercase tracking-widest">
        <DetailPair label="Client" value={order.customerName} />
        <DetailPair label={"T\u00e9l"} value={order.customerPhone ?? "-"} />
        <DetailPair label="Type" value={isDineIn ? "Sur place" : "\u00c0 emporter"} />
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

      {journalEvents.length > 0 ? (
        <OrderJournal events={journalEvents} />
      ) : null}

      <PrintTicketButton orderId={order.id} />

      {posCoexistenceEnabled ? (
        <PosReconciliationControl order={order} role={role} />
      ) : null}

      {!isTerminalOrderStatus(status) ? (
        <OrderActions
          orderId={order.id}
          status={status}
          role={role}
          servePending={servePending}
          onServe={onServe}
        />
      ) : null}
    </div>
  );
}

function optimisticServedEvent(orderId: string): JournalEvent {
  return {
    id: `optimistic-served-${orderId}`,
    orderId,
    eventType: "order.served",
    actorDisplayName: null,
    actorRole: null,
    payload: null,
    createdAt: new Date().toISOString(),
  };
}

function PosReconciliationControl({
  order,
  role,
}: {
  order: OrderWithItems;
  role: StaffRole;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [posReference, setPosReference] = useState(order.posReference ?? "");
  const canMark =
    role === "owner" || role === "manager" || role === "cashier";
  const canRevert = role === "owner" || role === "manager";

  if (order.posStatus === "not_required") return null;

  const markEntered = () => {
    startTransition(async () => {
      const result = await markOrderEnteredInPos(order.id, { posReference });
      if (result.status === "error") window.alert(result.message);
      else setEditing(false);
    });
  };

  const revert = () => {
    if (!window.confirm("Annuler l'entrée en caisse ?")) return;
    startTransition(async () => {
      const result = await revertOrderPosStatus(order.id);
      if (result.status === "error") window.alert(result.message);
    });
  };

  if (order.posStatus === "entered") {
    return (
      <section className="border-t border-outline pt-4 flex flex-col gap-2">
        <p className="font-mono text-[11px] uppercase tracking-widest text-ink/55">
          Entrée en caisse
          {order.posEnteredAt ? ` · ${formatCasablancaTimestamp(String(order.posEnteredAt))}` : ""}
          {order.posEnteredByDisplayName
            ? ` · ${order.posEnteredByDisplayName}`
            : ""}
          {order.posReference ? ` · ${order.posReference}` : ""}
        </p>
        {canRevert ? (
          <button
            type="button"
            onClick={revert}
            disabled={pending}
            className="self-start font-mono text-[11px] uppercase tracking-widest text-ink/50 hover:text-accent underline underline-offset-4 disabled:opacity-60"
          >
            Annuler
          </button>
        ) : null}
      </section>
    );
  }

  if (!canMark || order.posStatus !== "pending") return null;

  return (
    <section className="border-t border-outline pt-4 flex flex-col gap-3">
      <p className="font-mono text-[11px] uppercase tracking-widest text-ink/55">
        À entrer en caisse
      </p>
      {editing ? (
        <div className="flex flex-col min-[420px]:flex-row gap-2">
          <input
            type="text"
            maxLength={64}
            value={posReference}
            onChange={(event) => setPosReference(event.target.value)}
            placeholder="Réf caisse (optionnel)"
            className="min-h-[44px] flex-1 border border-outline bg-white px-3 py-2 font-mono text-[12px] focus:border-ink focus:outline-none"
          />
          <button
            type="button"
            onClick={markEntered}
            disabled={pending}
            className="px-5 py-3 font-mono font-bold uppercase tracking-widest text-[12px] transition-colors border-2 border-ink bg-ink text-base hover:bg-accent hover:text-base focus:outline-none focus:ring-4 focus:ring-accent/20 disabled:opacity-60"
          >
            {pending ? "..." : "Confirmer"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="self-start px-5 py-3 font-mono font-bold uppercase tracking-widest text-[12px] transition-colors border-2 border-ink bg-base text-ink hover:bg-ink hover:text-base focus:outline-none focus:ring-4 focus:ring-accent/20"
        >
          Entrée en caisse
        </button>
      )}
    </section>
  );
}

function OrderJournal({ events }: { events: JournalEvent[] }) {
  return (
    <section className="border-t-2 border-ink pt-4 flex flex-col gap-3">
      <h3 className="font-mono font-bold text-[11px] uppercase tracking-widest text-ink/40">
        Journal
      </h3>
      <ol className="flex flex-col">
        {events.map((event, index) => (
          <JournalEntry
            key={event.id}
            event={event}
            isFirst={index === 0}
            isLast={index === events.length - 1}
          />
        ))}
      </ol>
    </section>
  );
}

function JournalEntry({
  event,
  isFirst,
  isLast,
}: {
  event: JournalEvent;
  isFirst: boolean;
  isLast: boolean;
}) {
  const actor = formatActor(event);
  const summary = summarisePayload(event.payload);
  return (
    <li className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0">
      <div className="relative flex flex-col items-center pt-1">
        <span className="w-2 h-2 bg-ink" aria-hidden />
        {!isLast ? (
          <span className="flex-1 w-px bg-outline mt-1" aria-hidden />
        ) : null}
      </div>
      <div className={cn("pb-4", isFirst ? "pt-0" : "pt-0")}>
        <p className="font-sans text-[14px] font-bold text-ink leading-tight">
          {eventLabelFr(event.eventType)}
        </p>
        <p className="font-mono text-[11px] uppercase tracking-widest text-ink/50 mt-1">
          {formatCasablancaTimestamp(event.createdAt)} \u00b7 {actor}
        </p>
        {summary ? (
          <p className="font-sans text-[12px] text-ink/55 leading-snug mt-1">
            {summary}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function formatActor(event: JournalEvent): string {
  if (!event.actorDisplayName && event.actorRole === "customer") return "Client";
  if (!event.actorDisplayName && event.actorRole === "system") return "Syst\u00e8me";
  if (!event.actorDisplayName && !event.actorRole) return "\u2014";
  const role = roleLabelFr(event.actorRole);
  if (event.actorDisplayName && role) {
    return `${event.actorDisplayName} (${role})`;
  }
  return event.actorDisplayName ?? role ?? "\u2014";
}

function PrintTicketButton({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();

  const print = () => {
    startTransition(async () => {
      const result = await enqueuePrintJob(orderId);
      if (result.status === "error") {
        window.alert(result.message);
        return;
      }
      printPlainTextTicket(result.payloadText);
    });
  };

  return (
    <button
      type="button"
      onClick={print}
      disabled={pending}
      className="px-5 py-3 font-mono font-bold uppercase tracking-widest text-[12px] transition-colors border-2 border-ink bg-base text-ink hover:bg-ink hover:text-base focus:outline-none focus:ring-4 focus:ring-accent/20 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending ? "..." : "Imprimer / reimprimer"}
    </button>
  );
}

function printPlainTextTicket(payloadText: string): void {
  const win = window.open("", "_blank", "width=420,height=640");
  if (!win) {
    window.alert("Fenetre d'impression bloquee");
    return;
  }
  const escaped = payloadText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  win.document.write(`<!doctype html>
<html>
<head>
  <title>Ticket</title>
  <style>
    body { margin: 16px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    pre { font-size: 13px; line-height: 1.35; white-space: pre; }
  </style>
</head>
<body><pre>${escaped}</pre></body>
</html>`);
  win.document.close();
  win.focus();
  win.print();
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
  const optionLines = summarizeOrderItemOptions(item.optionsJson);

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

      {optionLines.map((line) => (
        <p
          key={line}
          className="font-mono text-[11px] uppercase tracking-widest text-ink/55 leading-snug"
        >
          {line.trim()}
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
  role,
  servePending,
  onServe,
}: {
  orderId: string;
  status: OrderLifecycleStatus;
  role: StaffRole;
  servePending: boolean;
  onServe: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const action = PRIMARY_ORDER_ACTIONS[status];
  const showServir = canShowServirButton(status, role);

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
      {showServir ? (
        <button
          type="button"
          onClick={onServe}
          disabled={servePending}
          className="px-5 py-3 font-mono font-bold uppercase tracking-widest text-[12px] transition-colors border-2 border-ink bg-ink text-base hover:bg-accent hover:text-base focus:outline-none focus:ring-4 focus:ring-accent/20 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {servePending ? "..." : "Servir"}
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
  eventsByOrderId?: Record<string, JournalEvent[]>;
  role: StaffRole;
  posCoexistenceEnabled: boolean;
};

export function OrdersBoard({
  orders,
  eventsByOrderId,
  role,
  posCoexistenceEnabled,
}: OrdersBoardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toggle = (id: string) =>
    setExpandedId((curr) => (curr === id ? null : id));

  if (orders.length === 0) {
    return (
      <div className="px-6 py-20 flex flex-col items-center text-center gap-5">
        <div className="w-12 h-12 border-2 border-ink flex items-center justify-center">
          <div className="w-3 h-3 bg-accent" />
        </div>
        <p className="font-sans text-[15px] text-ink/60 leading-snug max-w-[320px]">
          Aucune commande pour le moment — partagez votre QR code pour recevoir
          des commandes !
        </p>
        <Link
          href="/home"
          className="bg-ink text-base px-5 py-3 font-mono font-bold uppercase tracking-widest text-[12px] hover:bg-accent transition-colors border-2 border-ink focus:outline-none focus:ring-4 focus:ring-accent/20"
        >
          Voir le QR code
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {orders.map((order) => (
        <OrderRow
          key={order.id}
          order={order}
          events={eventsByOrderId?.[order.id] ?? []}
          expanded={expandedId === order.id}
          onToggle={() => toggle(order.id)}
          role={role}
          posCoexistenceEnabled={posCoexistenceEnabled}
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

function playOrderTone() {
  try {
    const AudioContextImpl =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextImpl) return;
    const ctx = new AudioContextImpl();
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1174, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.38);
  } catch {
    // Browsers may block audio until a merchant explicitly interacts.
  }
}
