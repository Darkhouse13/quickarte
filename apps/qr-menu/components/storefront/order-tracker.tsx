"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { formatAmount } from "@/lib/utils/currency";
import {
  customerStatusContext,
  customerStatusLabel,
  formatElapsedSinceFr,
  type WhatsappLink,
} from "@/lib/ordering/customer-view";
import { createStatusPoller } from "@/lib/ordering/customer-poll";
import { balanceJumpDelta } from "@/lib/loyalty/balance-jump";

type TrackerItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  optionLines: string[];
};

export type TrackerLoyalty = {
  creditLabel: string;
  balance: number;
  accrualPerMad: number;
  reviewReward: {
    enabled: boolean;
    creditsPerReview: number;
    googlePlaceId: string;
  } | null;
  canClaimReview: boolean;
};

type Props = {
  token: string;
  locale: string;
  initialStatus: string;
  initialLatestEventAt: string;
  type: string;
  businessName: string;
  businessSlug: string;
  tableNumber: string | null;
  items: TrackerItem[];
  total: number;
  notes: string | null;
  postOrderMessage: string | null;
  whatsapp: WhatsappLink | null;
  shortOrderId: string;
  // null for non-loyalty orders — the rest of the tracker still renders as
  // before. customerPhone is server-side only (never echoed in the response);
  // we pass the normalized phone separately so we can build /avis and
  // /recompenses deep links without a roundtrip.
  loyalty: TrackerLoyalty | null;
  customerPhone: string | null;
};

const POLL_INTERVAL_MS = 10_000;
// Calmer than the kitchen view's 10s ticker — a relaxed customer, not a cook.
const ELAPSED_TICK_MS = 30_000;

export function OrderTracker({
  token,
  locale,
  initialStatus,
  initialLatestEventAt,
  type,
  businessName,
  businessSlug,
  tableNumber,
  items,
  total,
  notes,
  postOrderMessage,
  whatsapp,
  shortOrderId,
  loyalty,
  customerPhone,
}: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [latestEventAt, setLatestEventAt] = useState(initialLatestEventAt);
  const [revoked, setRevoked] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [balance, setBalance] = useState<number | null>(
    loyalty?.balance ?? null,
  );
  const [delta, setDelta] = useState<number | null>(null);

  useEffect(() => {
    const poller = createStatusPoller(
      { initialStatus, intervalMs: POLL_INTERVAL_MS },
      {
        fetchStatus: async () => {
          try {
            const res = await fetch(`/api/orders/${token}/status`, {
              cache: "no-store",
            });
            if (res.status === 404) return { kind: "revoked" as const };
            if (!res.ok) return { kind: "error" as const };
            const body = (await res.json()) as {
              status: string;
              latestEventAt: string;
              balance: number | null;
            };
            return {
              kind: "ok" as const,
              snapshot: {
                status: body.status,
                latestEventAt: body.latestEventAt,
                balance: body.balance,
              },
            };
          } catch {
            return { kind: "error" as const };
          }
        },
        onSnapshot: (snapshot) => {
          setStatus(snapshot.status);
          setLatestEventAt(snapshot.latestEventAt);
          if (snapshot.balance !== undefined && snapshot.balance !== null) {
            setBalance((prev) => {
              const jump = balanceJumpDelta(prev, snapshot.balance ?? null);
              if (jump !== null) setDelta(jump);
              return snapshot.balance ?? prev;
            });
          }
        },
        onRevoked: () => setRevoked(true),
      },
    );

    poller.start();

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        poller.stop();
      } else {
        poller.resume();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      poller.dispose();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [token, initialStatus]);

  useEffect(() => {
    const id = window.setInterval(
      () => setNowMs(Date.now()),
      ELAPSED_TICK_MS,
    );
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (delta === null) return;
    // 2s window matches the brief — the new balance number stays, only the
    // delta badge fades. Single-shot timeout cleaned on unmount or re-jump.
    const id = window.setTimeout(() => setDelta(null), 2000);
    return () => window.clearTimeout(id);
  }, [delta]);

  const isCancelled = status === "cancelled";
  const elapsedLabel = useMemo(
    () => formatElapsedSinceFr(nowMs - new Date(latestEventAt).getTime()),
    [nowMs, latestEventAt],
  );

  const contactRegion = (
    <ContactRegion whatsapp={whatsapp} revoked={revoked} />
  );

  return (
    <>
      <section
        className={cn(
          "px-6 md:px-10 py-10 md:py-14",
          isCancelled
            ? "border-2 border-accent"
            : "border-b border-outline",
        )}
      >
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45 font-bold mb-3">
          {isCancelled ? "Commande" : "Votre commande"}
        </p>
        <span
          key={status}
          className="order-status-fade block font-mono font-bold uppercase tracking-tighter leading-[0.95] text-[48px] md:text-[72px]"
        >
          {customerStatusLabel(status)}
        </span>
        <p className="font-sans text-[15px] md:text-[17px] text-ink/70 leading-snug mt-4 max-w-[420px]">
          {customerStatusContext(status, type)}
        </p>
        <p className="font-mono text-[11px] uppercase tracking-widest text-ink/40 mt-4">
          {elapsedLabel}
        </p>
      </section>

      {isCancelled ? contactRegion : null}

      <LoyaltyRegion
        loyalty={loyalty}
        balance={balance}
        delta={delta}
        businessName={businessName}
        businessSlug={businessSlug}
        locale={locale}
        status={status}
        customerPhone={customerPhone}
        token={token}
      />

      <DestinationBlock
        type={type}
        tableNumber={tableNumber}
        businessName={businessName}
      />

      <ReceiptBlock items={items} total={total} notes={notes} />

      {postOrderMessage ? (
        <section className="px-6 md:px-10 py-8 border-b border-outline">
          <p className="font-sans text-[15px] text-ink/80 leading-relaxed">
            {postOrderMessage}
          </p>
        </section>
      ) : null}

      {isCancelled ? null : contactRegion}

      <footer className="px-6 md:px-10 py-8 mt-auto flex flex-col gap-2">
        <p className="font-mono text-[11px] uppercase tracking-widest text-ink/45 font-bold">
          Réf. {shortOrderId}
        </p>
        <p className="font-sans text-[13px] text-ink/50 leading-snug">
          Mettez cette page en favori pour suivre votre commande.
        </p>
      </footer>
    </>
  );
}

function DestinationBlock({
  type,
  tableNumber,
  businessName,
}: {
  type: string;
  tableNumber: string | null;
  businessName: string;
}) {
  if (type === "dine_in") {
    return (
      <section className="px-6 md:px-10 py-8 border-b border-outline">
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45 font-bold mb-2">
          Table
        </p>
        <span className="font-mono font-bold leading-none tracking-tighter text-[40px] md:text-[56px]">
          N° {tableNumber ?? "—"}
        </span>
      </section>
    );
  }

  return (
    <section className="px-6 md:px-10 py-8 border-b border-outline">
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45 font-bold mb-2">
        Retrait
      </p>
      <p className="font-mono font-bold uppercase tracking-tight text-[20px] md:text-[24px]">
        {type === "takeaway"
          ? "À emporter."
          : `À retirer chez ${businessName}.`}
      </p>
    </section>
  );
}

function ReceiptBlock({
  items,
  total,
  notes,
}: {
  items: TrackerItem[];
  total: number;
  notes: string | null;
}) {
  return (
    <section className="px-6 md:px-10 py-8 border-b border-outline">
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45 font-bold mb-5">
        Reçu
      </p>
      <ul className="flex flex-col">
        {items.map((item, index) => (
          <li
            key={index}
            className="py-3 first:pt-0 border-b border-outline last:border-b-0 flex justify-between gap-4"
          >
            <div className="min-w-0">
              <p className="font-sans text-[15px] font-bold leading-tight">
                {item.name}{" "}
                <span className="font-mono text-ink/50">
                  ×{item.quantity}
                </span>
              </p>
              {item.optionLines.length > 0 ? (
                <ul className="pl-3 mt-1 flex flex-col gap-0.5">
                  {item.optionLines.map((line, optionIndex) => (
                    <li
                      key={optionIndex}
                      className="font-mono text-[11px] uppercase tracking-widest text-ink/55"
                    >
                      {line.trim()}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <span className="font-mono text-[14px] font-bold tabular-nums whitespace-nowrap">
              {formatAmount(item.unitPrice * item.quantity)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-5 pt-4 border-t-2 border-ink flex justify-between items-baseline">
        <span className="font-mono text-[12px] uppercase tracking-widest font-bold">
          Total
        </span>
        <span className="font-mono font-bold text-2xl tracking-tight tabular-nums">
          {formatAmount(total)}
        </span>
      </div>

      {notes ? (
        <div className="mt-5 border-l-[3px] border-accent bg-accent/[0.06] px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-accent font-bold mb-1">
            Votre note
          </p>
          <p className="font-sans text-[14px] text-ink leading-snug">
            {notes}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function LoyaltyRegion({
  loyalty,
  balance,
  delta,
  businessName,
  businessSlug,
  locale,
  status,
  customerPhone,
  token,
}: {
  loyalty: TrackerLoyalty | null;
  balance: number | null;
  delta: number | null;
  businessName: string;
  businessSlug: string;
  locale: string;
  status: string;
  customerPhone: string | null;
  token: string;
}) {
  if (!loyalty) return null;
  const phoneQuery = customerPhone
    ? `?phone=${encodeURIComponent(customerPhone)}`
    : "";
  const rewardsHref = `/${locale}/${businessSlug}/recompenses${phoneQuery}`;
  const claimHref = `/${locale}/${businessSlug}/avis${
    phoneQuery
      ? `${phoneQuery}&from=order&order=${encodeURIComponent(token)}`
      : `?from=order&order=${encodeURIComponent(token)}`
  }`;
  const currentBalance = balance ?? loyalty.balance;
  const canSurfaceReview =
    loyalty.reviewReward?.enabled &&
    loyalty.canClaimReview &&
    (status === "ready" || status === "completed");
  const canShowBalanceLink = currentBalance > 0;
  const earnHint =
    currentBalance === 0 && loyalty.accrualPerMad > 0
      ? `Gagnez des ${loyalty.creditLabel} en commandant chez ${businessName}.`
      : null;

  return (
    <section className="px-6 md:px-10 py-8 border-b border-outline flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45 font-bold">
          Vos {loyalty.creditLabel}
        </p>
        <div className="flex items-baseline gap-3">
          <span className="font-mono font-bold tabular-nums leading-none tracking-tight text-[40px] md:text-[56px]">
            {currentBalance}
          </span>
          <span className="font-mono text-[12px] uppercase tracking-widest text-ink/55 font-bold">
            {loyalty.creditLabel}
          </span>
          {delta !== null ? (
            <span
              key={delta}
              className="loyalty-delta font-mono font-bold tabular-nums text-accent text-[24px] md:text-[28px] leading-none"
              aria-live="polite"
            >
              +{delta}
            </span>
          ) : null}
        </div>
        {canShowBalanceLink ? (
          <a
            href={rewardsHref}
            className="font-mono text-[11px] uppercase tracking-widest text-accent font-bold inline-flex items-center gap-2 hover:text-ink transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20"
          >
            Voir les récompenses →
          </a>
        ) : earnHint ? (
          <p className="font-sans text-[14px] text-ink/65 leading-snug">
            {earnHint}
          </p>
        ) : null}
      </div>

      {canSurfaceReview ? (
        <div className="border border-ink px-5 py-5 flex flex-col gap-4">
          <p className="font-sans text-[15px] text-ink leading-snug">
            Vous avez aimé ? Laissez un avis Google et gagnez{" "}
            <span className="font-mono font-bold tabular-nums">
              {loyalty.reviewReward!.creditsPerReview}
            </span>{" "}
            {loyalty.creditLabel}.
          </p>
          <a
            href={claimHref}
            className="w-full min-h-[56px] bg-ink text-base px-5 py-4 flex items-center justify-between gap-3 hover:bg-accent transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20"
          >
            <span className="font-mono text-[13px] uppercase tracking-widest font-bold">
              Laisser un avis et récupérer mes {loyalty.creditLabel}
            </span>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="square"
              strokeLinejoin="miter"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      ) : null}
    </section>
  );
}

function ContactRegion({
  whatsapp,
  revoked,
}: {
  whatsapp: WhatsappLink | null;
  revoked: boolean;
}) {
  if (!whatsapp && !revoked) return null;

  return (
    <section className="px-6 md:px-10 py-8 border-b border-outline flex flex-col gap-4">
      {revoked ? (
        <p className="font-mono text-[11px] uppercase tracking-widest text-ink/50 leading-relaxed">
          Le lien de suivi n&apos;est plus actif.
        </p>
      ) : null}
      {whatsapp ? (
        <a
          href={whatsapp.url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full min-h-[56px] border-2 border-ink px-5 py-4 flex flex-col gap-1 justify-center hover:bg-ink hover:text-base transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20"
        >
          <span className="font-mono text-[13px] uppercase tracking-widest font-bold">
            Écrire au restaurant sur WhatsApp
          </span>
          <span className="font-mono text-[12px] tracking-wide opacity-55">
            {whatsapp.display}
          </span>
        </a>
      ) : null}
    </section>
  );
}
