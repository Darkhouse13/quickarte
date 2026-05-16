"use client";

import { useState, useTransition } from "react";
import { getCustomerLedger } from "@/lib/loyalty/actions";
import type { CreditTransaction } from "@quickarte/db-schema";
import { formatSignedAmount } from "@/lib/loyalty/format";
import { cn } from "@/lib/utils/cn";

const TZ = "Africa/Casablanca";

const SOURCE_LABELS: Record<CreditTransaction["source"], string> = {
  order_spend: "Commande",
  google_review: "Avis Google",
  redemption: "Récompense utilisée",
  manual_grant: "Crédit manuel",
  manual_adjustment: "Ajustement manuel",
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(date);
}

function fallbackDescription(tx: CreditTransaction): string {
  if (tx.description?.trim()) return tx.description.trim();
  if (tx.source === "order_spend" && tx.sourceRef) {
    return `Commande ${tx.sourceRef.slice(0, 6)}`;
  }
  if (tx.source === "redemption" && tx.sourceRef) {
    return `Commande en crédits ${tx.sourceRef.slice(0, 6)}`;
  }
  if (tx.source === "google_review" && tx.sourceRef) {
    return "Avis Google vérifié";
  }
  return SOURCE_LABELS[tx.source];
}

export function TransactionsTable({
  initialRows,
  initialHasMore,
  businessId,
  phoneNormalized,
}: {
  initialRows: CreditTransaction[];
  initialHasMore: boolean;
  businessId: string;
  phoneNormalized: string;
}) {
  const [rows, setRows] = useState(initialRows);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [allLoaded, setAllLoaded] = useState(false);
  const [pending, startTransition] = useTransition();

  const loadMore = () => {
    if (allLoaded) return;
    startTransition(async () => {
      const fetched = await getCustomerLedger(businessId, phoneNormalized);
      setRows(fetched);
      setHasMore(false);
      setAllLoaded(true);
    });
  };

  if (rows.length === 0) {
    return (
      <p className="font-sans text-[13px] text-ink/55 leading-snug border border-outline px-4 py-4">
        Aucun mouvement pour ce client.
      </p>
    );
  }

  return (
    <div>
      <table className="w-full border-y-2 border-ink font-mono text-[12px]">
        <thead>
          <tr className="border-b border-outline text-[10px] uppercase tracking-widest text-ink/40">
            <th scope="col" className="py-2 px-2 text-left font-bold">
              Date
            </th>
            <th scope="col" className="py-2 px-2 text-left font-bold">
              Type
            </th>
            <th scope="col" className="py-2 px-2 text-left font-bold">
              Description
            </th>
            <th scope="col" className="py-2 px-2 text-right font-bold">
              Montant
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline">
          {rows.map((tx) => (
            <tr key={tx.id}>
              <td className="py-2 px-2 align-top tabular-nums whitespace-nowrap">
                {formatDate(tx.createdAt)}
              </td>
              <td className="py-2 px-2 align-top whitespace-nowrap">
                {SOURCE_LABELS[tx.source]}
              </td>
              <td className="py-2 px-2 align-top text-ink/75">
                {fallbackDescription(tx)}
              </td>
              <td
                className={cn(
                  "py-2 px-2 align-top text-right tabular-nums whitespace-nowrap",
                  tx.amount > 0 && "text-ink",
                  tx.amount < 0 && "text-ink",
                  tx.amount > 0 ? "font-normal" : "font-bold",
                )}
              >
                {formatSignedAmount(tx.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {hasMore && !allLoaded ? (
        <button
          type="button"
          onClick={loadMore}
          disabled={pending}
          className="mt-4 border-2 border-ink px-5 py-3 font-mono text-[11px] font-bold uppercase tracking-widest hover:bg-ink hover:text-base transition-colors disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-accent/20"
        >
          Voir plus
        </button>
      ) : null}
    </div>
  );
}
