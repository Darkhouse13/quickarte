"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { cn } from "@/lib/utils/cn";
import { formatElapsedFr } from "@/lib/kitchen/elapsed";
import {
  bucketOrderByStatus,
  KITCHEN_COLUMN_EMPTY_COPY,
  KITCHEN_COLUMN_LABELS,
  KITCHEN_COLUMN_ORDER,
  type KitchenColumn,
} from "@/lib/kitchen/buckets";
import {
  fetchKitchenSnapshot,
  kitchenAcceptOrder,
  kitchenMarkReady,
} from "@/lib/kitchen/actions";
import type { KitchenOrder } from "@/lib/kitchen/queries";
import { shouldShowRedemptionPill } from "@/lib/loyalty/redemption-pill";

const POLL_INTERVAL_MS = 4_000;
const TICKER_INTERVAL_MS = 10_000;
const READY_LINGER_MS = 60_000;

type Toast = { id: number; message: string };

type Props = {
  initialOrders: KitchenOrder[];
  businessName: string;
  fetchedAt: string;
  showDashboardLink?: boolean;
};

export function KitchenBoard({
  initialOrders,
  businessName,
  fetchedAt,
  showDashboardLink = false,
}: Props) {
  const [orders, setOrders] = useState<KitchenOrder[]>(initialOrders);
  const [tick, setTick] = useState(0);
  const [lastFetchAt, setLastFetchAt] = useState<string>(fetchedAt);
  const [toast, setToast] = useState<Toast | null>(null);

  const seenOrderIdsRef = useRef<Set<string>>(
    new Set(initialOrders.map((o) => o.id)),
  );
  const soundEnabledRef = useRef(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const optimisticIdsRef = useRef<Set<string>>(new Set());
  const toastIdRef = useRef(0);

  const showToast = useCallback((message: string) => {
    toastIdRef.current += 1;
    const id = toastIdRef.current;
    setToast({ id, message });
    window.setTimeout(() => {
      setToast((curr) => (curr && curr.id === id ? null : curr));
    }, 4_000);
  }, []);

  const replaceFromServer = useCallback((next: KitchenOrder[]) => {
    setOrders((curr) => {
      if (optimisticIdsRef.current.size === 0) return next;
      const optimisticIds = optimisticIdsRef.current;
      const optimistic = curr.filter((o) => optimisticIds.has(o.id));
      const fromServer = next.filter((o) => !optimisticIds.has(o.id));
      return [...optimistic, ...fromServer];
    });
  }, []);

  const detectNewArrivals = useCallback((next: KitchenOrder[]) => {
    const seen = seenOrderIdsRef.current;
    const newlyArrived = next.some(
      (o) => o.status === "pending" && !seen.has(o.id),
    );
    seenOrderIdsRef.current = new Set(next.map((o) => o.id));
    if (newlyArrived && soundEnabledRef.current) playOrderTone();
  }, []);

  const refresh = useCallback(async () => {
    const result = await fetchKitchenSnapshot();
    if (result.status !== "success") {
      showToast(result.message);
      return;
    }
    detectNewArrivals(result.orders);
    replaceFromServer(result.orders);
    setLastFetchAt(result.fetchedAt);
  }, [detectNewArrivals, replaceFromServer, showToast]);

  // 4s polling, paused while the tab/document is hidden.
  useEffect(() => {
    let intervalId: number | null = null;

    const start = () => {
      if (intervalId !== null) return;
      intervalId = window.setInterval(() => {
        void refresh();
      }, POLL_INTERVAL_MS);
    };
    const stop = () => {
      if (intervalId === null) return;
      window.clearInterval(intervalId);
      intervalId = null;
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        stop();
      } else {
        void refresh();
        start();
      }
    };

    start();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refresh]);

  // 10s ticker so elapsed-time labels stay fresh without rerendering more
  // than necessary.
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), TICKER_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const enableSound = useCallback(() => {
    soundEnabledRef.current = true;
    setSoundEnabled(true);
    playOrderTone();
  }, []);

  const onAccept = useCallback(
    async (orderId: string) => {
      const previous = orders;
      optimisticIdsRef.current.add(orderId);
      setOrders((curr) =>
        curr.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: "preparing",
                statusEnteredAt: new Date().toISOString(),
              }
            : o,
        ),
      );
      const result = await kitchenAcceptOrder(orderId);
      optimisticIdsRef.current.delete(orderId);
      if (result.status === "error") {
        setOrders(previous);
        showToast(result.message);
        return;
      }
      setOrders((curr) =>
        curr.map((o) => (o.id === orderId ? result.order : o)),
      );
    },
    [orders, showToast],
  );

  const onMarkReady = useCallback(
    async (orderId: string) => {
      const previous = orders;
      optimisticIdsRef.current.add(orderId);
      setOrders((curr) =>
        curr.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: "ready",
                statusEnteredAt: new Date().toISOString(),
              }
            : o,
        ),
      );
      const result = await kitchenMarkReady(orderId);
      optimisticIdsRef.current.delete(orderId);
      if (result.status === "error") {
        setOrders(previous);
        showToast(result.message);
        return;
      }
      setOrders((curr) =>
        curr.map((o) => (o.id === orderId ? result.order : o)),
      );
    },
    [orders, showToast],
  );

  const now = useNowMs(tick, lastFetchAt);
  const bucketed = useMemo(() => bucketOrders(orders), [orders]);

  return (
    <>
      <KitchenHeader
        businessName={businessName}
        soundEnabled={soundEnabled}
        onEnableSound={enableSound}
        lastFetchAt={lastFetchAt}
        showDashboardLink={showDashboardLink}
      />

      <div className="flex-1 flex md:grid md:grid-cols-3 overflow-x-auto md:overflow-x-visible snap-x snap-mandatory md:snap-none no-scrollbar">
        {KITCHEN_COLUMN_ORDER.map((column, index) => (
          <KitchenColumnView
            key={column}
            column={column}
            orders={bucketed[column]}
            now={now}
            isLast={index === KITCHEN_COLUMN_ORDER.length - 1}
            onAccept={onAccept}
            onMarkReady={onMarkReady}
          />
        ))}
      </div>

      {toast ? <KitchenToast message={toast.message} /> : null}
    </>
  );
}

function KitchenHeader({
  businessName,
  soundEnabled,
  onEnableSound,
  lastFetchAt,
  showDashboardLink,
}: {
  businessName: string;
  soundEnabled: boolean;
  onEnableSound: () => void;
  lastFetchAt: string;
  showDashboardLink: boolean;
}) {
  return (
    <header className="px-6 md:px-10 py-6 border-b-2 border-ink flex items-center justify-between gap-6 bg-base">
      <div className="flex items-baseline gap-4 min-w-0">
        <h1 className="font-mono font-bold text-2xl md:text-3xl uppercase tracking-tighter leading-none">
          Cuisine
        </h1>
        <span className="font-mono text-[11px] uppercase tracking-widest text-ink/50 truncate hidden sm:inline">
          {businessName}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <PollPulse lastFetchAt={lastFetchAt} />
        {soundEnabled ? (
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink/40">
            Son activé
          </span>
        ) : (
          <button
            type="button"
            onClick={onEnableSound}
            className="font-mono text-[10px] uppercase tracking-widest font-bold border border-ink px-3 py-2 hover:bg-ink hover:text-base transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20"
          >
            Activer le son
          </button>
        )}
        {showDashboardLink ? (
          <a
            href="/home"
            className="hidden sm:inline font-mono text-[10px] uppercase tracking-widest font-bold text-ink/50 hover:text-ink transition-colors"
          >
            Quitter →
          </a>
        ) : null}
      </div>
    </header>
  );
}

function PollPulse({ lastFetchAt }: { lastFetchAt: string }) {
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    setPulse(true);
    const id = window.setTimeout(() => setPulse(false), 500);
    return () => window.clearTimeout(id);
  }, [lastFetchAt]);
  return (
    <span
      aria-hidden
      className={cn(
        "w-2 h-2 bg-ink transition-opacity",
        pulse ? "opacity-100" : "opacity-20",
      )}
    />
  );
}

function KitchenColumnView({
  column,
  orders,
  now,
  isLast,
  onAccept,
  onMarkReady,
}: {
  column: KitchenColumn;
  orders: KitchenOrder[];
  now: number;
  isLast: boolean;
  onAccept: (id: string) => void;
  onMarkReady: (id: string) => void;
}) {
  const lingerCutoff = now - READY_LINGER_MS;

  const expanded: KitchenOrder[] = [];
  const collapsed: KitchenOrder[] = [];
  if (column === "ready") {
    for (const order of orders) {
      const enteredAt = new Date(order.statusEnteredAt).getTime();
      if (enteredAt > lingerCutoff) expanded.push(order);
      else collapsed.push(order);
    }
  } else {
    expanded.push(...orders);
  }

  return (
    <section
      className={cn(
        "flex-shrink-0 w-full md:w-auto snap-start flex flex-col bg-base",
        !isLast && "md:border-r-2 md:border-ink",
      )}
    >
      <header className="px-6 md:px-8 py-5 border-b-2 border-ink flex items-baseline justify-between bg-base sticky top-0 z-10">
        <h2 className="font-mono font-bold text-xs md:text-sm uppercase tracking-widest text-ink">
          {KITCHEN_COLUMN_LABELS[column]}
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-widest text-ink/50 font-bold">
          {orders.length.toString().padStart(2, "0")}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto">
        {expanded.length === 0 && collapsed.length === 0 ? (
          <EmptyColumn column={column} />
        ) : (
          <ul className="flex flex-col">
            {expanded.map((order) => (
              <KitchenCard
                key={order.id}
                order={order}
                column={column}
                now={now}
                onAccept={onAccept}
                onMarkReady={onMarkReady}
              />
            ))}
          </ul>
        )}

        {collapsed.length > 0 ? (
          <div className="border-t-2 border-ink px-6 md:px-8 py-4 flex flex-wrap gap-2 bg-black/[0.02]">
            {collapsed.map((order) => (
              <ReadyPill key={order.id} order={order} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function EmptyColumn({ column }: { column: KitchenColumn }) {
  return (
    <div className="px-6 md:px-8 py-16 flex flex-col items-center text-center gap-4">
      <div
        aria-hidden
        className="w-10 h-10 border-2 border-ink/30 flex items-center justify-center"
      >
        <span className="w-2 h-2 bg-ink/30" />
      </div>
      <p className="font-sans text-[14px] text-ink/55 leading-snug max-w-[260px]">
        {KITCHEN_COLUMN_EMPTY_COPY[column]}
      </p>
    </div>
  );
}

function KitchenCard({
  order,
  column,
  now,
  onAccept,
  onMarkReady,
}: {
  order: KitchenOrder;
  column: KitchenColumn;
  now: number;
  onAccept: (id: string) => void;
  onMarkReady: (id: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const createdAt = new Date(order.createdAt).getTime();
  const elapsed = formatElapsedFr(now - createdAt);
  const isDineIn = order.type === "dine_in";
  const tableLabel = isDineIn ? order.tableNumber ?? "—" : "À emporter";

  const isRedemption = shouldShowRedemptionPill(order);

  return (
    <li className="border-b-2 border-ink last:border-b-0 px-6 md:px-8 py-5 flex flex-col gap-4">
      {isRedemption ? (
        <span
          className="self-start font-mono text-[10px] uppercase tracking-widest font-bold text-ink border border-ink px-2 py-1"
          aria-label="Commande payée en crédits"
        >
          Récompense
        </span>
      ) : null}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink/45 font-bold">
            {isDineIn ? "Table" : "Type"}
          </span>
          <span
            className={cn(
              "font-mono font-bold leading-none tracking-tighter",
              isDineIn
                ? "text-[56px] md:text-[64px]"
                : "text-[28px] md:text-[32px]",
            )}
          >
            {tableLabel}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink/45 font-bold">
            Depuis
          </span>
          <span className="font-mono text-[20px] md:text-[24px] font-bold leading-none tabular-nums">
            {elapsed}
          </span>
        </div>
      </div>

      <ul className="flex flex-col">
        {order.items.map((item) => (
          <CardLineItem key={item.id} item={item} />
        ))}
      </ul>

      {order.notes ? (
        <div className="border-l-[3px] border-accent bg-accent/[0.06] px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-accent font-bold mb-1">
            Note
          </p>
          <p className="font-sans text-[14px] text-ink leading-snug">
            {order.notes}
          </p>
        </div>
      ) : null}

      {column === "to_prepare" ? (
        <button
          type="button"
          onClick={() => startTransition(() => onAccept(order.id))}
          disabled={pending}
          className="w-full min-h-[56px] px-6 py-4 font-mono font-bold uppercase tracking-widest text-[14px] border-2 border-ink bg-ink text-base hover:bg-accent hover:border-accent transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? "…" : "Accepter"}
        </button>
      ) : null}

      {column === "in_progress" ? (
        <button
          type="button"
          onClick={() => startTransition(() => onMarkReady(order.id))}
          disabled={pending}
          className="w-full min-h-[56px] px-6 py-4 font-mono font-bold uppercase tracking-widest text-[14px] border-2 border-accent bg-base text-accent hover:bg-accent hover:text-base transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? "…" : "Prêt"}
        </button>
      ) : null}

      {column === "ready" ? (
        <div className="border-2 border-ink px-4 py-3 flex items-center justify-between bg-ink text-base">
          <span className="font-mono text-[11px] uppercase tracking-widest font-bold">
            Prêt
          </span>
          <span className="font-mono text-[11px] uppercase tracking-widest text-base/70">
            En attente du service
          </span>
        </div>
      ) : null}
    </li>
  );
}

function CardLineItem({ item }: { item: KitchenOrder["items"][number] }) {
  return (
    <li className="border-t border-outline first:border-t-0 py-2">
      <div className="flex justify-between gap-4 items-baseline">
        <span className="font-sans text-[16px] font-bold leading-tight min-w-0">
          {item.productName}
        </span>
        <span className="font-mono text-[16px] font-bold leading-none tabular-nums">
          ×{item.quantity}
        </span>
      </div>
      {item.optionLines.length > 0 ? (
        <ul className="pl-4 mt-1 flex flex-col gap-0.5">
          {item.optionLines.map((line) => (
            <li
              key={line}
              className="font-mono text-[11px] uppercase tracking-widest text-ink/60"
            >
              {line.trim()}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function ReadyPill({ order }: { order: KitchenOrder }) {
  const label = order.type === "dine_in"
    ? `T${order.tableNumber ?? "?"}`
    : "Emp.";
  return (
    <span className="border border-ink px-3 py-2 font-mono text-[11px] uppercase tracking-widest font-bold leading-none bg-base">
      {label}
    </span>
  );
}

function KitchenToast({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 border-2 border-accent bg-base px-5 py-3 max-w-[420px] w-[calc(100%-32px)]"
    >
      <p className="font-mono text-[12px] uppercase tracking-widest font-bold text-accent">
        {message}
      </p>
    </div>
  );
}

function bucketOrders(orders: KitchenOrder[]): Record<KitchenColumn, KitchenOrder[]> {
  const out: Record<KitchenColumn, KitchenOrder[]> = {
    to_prepare: [],
    in_progress: [],
    ready: [],
  };
  for (const order of orders) {
    const bucket = bucketOrderByStatus(order.status);
    if (bucket) out[bucket].push(order);
  }
  // Older first within a column — kitchen needs to clear the queue head-first.
  for (const key of Object.keys(out) as KitchenColumn[]) {
    out[key].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }
  return out;
}

function useNowMs(tick: number, lastFetchAt: string): number {
  // Recompute each tick or whenever a fresh server snapshot lands so card
  // timers + ready-linger collapse stay in sync.
  return useMemo(() => Date.now(), [tick, lastFetchAt]);
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
