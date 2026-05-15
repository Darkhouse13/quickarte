"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { getCreditCustomers } from "@/lib/loyalty/actions";
import { formatPhoneForDisplay } from "@/lib/utils/phone";
import { formatRelativeFr } from "@/lib/loyalty/format";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

type CustomerRow = {
  id: string;
  customerPhoneNormalized: string;
  balance: number;
  lastActivityAt: Date;
};

export function ClientsTab({
  businessId,
  initialRows,
  initialHasMore,
}: {
  businessId: string;
  initialRows: CustomerRow[];
  initialHasMore: boolean;
}) {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<CustomerRow[]>(initialRows);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [searching, startSearchTransition] = useTransition();
  const [loadingMore, startLoadMoreTransition] = useTransition();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, []);

  const runSearch = (value: string) => {
    const my = ++requestId.current;
    startSearchTransition(async () => {
      const result = await getCreditCustomers(businessId, {
        search: value.trim() || undefined,
        limit: PAGE_SIZE + 1,
        offset: 0,
      });
      if (my !== requestId.current) return;
      const more = result.length > PAGE_SIZE;
      setRows(
        (more ? result.slice(0, PAGE_SIZE) : result).map((r) => ({
          id: r.id,
          customerPhoneNormalized: r.customerPhoneNormalized,
          balance: r.balance,
          lastActivityAt: r.lastActivityAt,
        })),
      );
      setHasMore(more);
    });
  };

  const onSearchChange = (value: string) => {
    setSearch(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => runSearch(value), SEARCH_DEBOUNCE_MS);
  };

  const loadMore = () => {
    startLoadMoreTransition(async () => {
      const result = await getCreditCustomers(businessId, {
        search: search.trim() || undefined,
        limit: PAGE_SIZE + 1,
        offset: rows.length,
      });
      const more = result.length > PAGE_SIZE;
      const newRows = (more ? result.slice(0, PAGE_SIZE) : result).map((r) => ({
        id: r.id,
        customerPhoneNormalized: r.customerPhoneNormalized,
        balance: r.balance,
        lastActivityAt: r.lastActivityAt,
      }));
      setRows((prev) => [...prev, ...newRows]);
      setHasMore(more);
    });
  };

  const isInitiallyEmpty = rows.length === 0 && search.length === 0 && !searching;

  return (
    <section className="px-6 py-6 flex flex-col gap-5">
      <h2 className="font-mono font-bold text-[11px] uppercase tracking-widest text-ink/40">
        Habitués
      </h2>

      <input
        type="search"
        aria-label="Rechercher par téléphone"
        placeholder="Rechercher par téléphone"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full border border-outline bg-transparent px-4 py-3 font-mono tabular-nums text-[14px] text-ink placeholder:text-ink/30 focus:outline-none focus:border-ink focus:bg-white transition-colors"
      />

      {isInitiallyEmpty ? (
        <p className="font-sans text-[13px] text-ink/55 leading-snug border border-outline px-4 py-4">
          Aucun client n&apos;a encore gagné de crédits. Une fois le programme actif,
          vos clients apparaîtront ici au fur et à mesure.
        </p>
      ) : rows.length === 0 ? (
        <p className="font-sans text-[13px] text-ink/55 leading-snug">
          Aucun résultat pour «&nbsp;{search}&nbsp;».
        </p>
      ) : (
        <div>
          <table className="w-full border-y-2 border-ink font-mono text-[13px]">
            <thead>
              <tr className="border-b border-outline text-[10px] uppercase tracking-widest text-ink/40">
                <th scope="col" className="py-2 px-2 text-left font-bold">
                  Téléphone
                </th>
                <th scope="col" className="py-2 px-2 text-right font-bold">
                  Solde
                </th>
                <th scope="col" className="py-2 px-2 text-right font-bold">
                  Dernière activité
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 px-2 align-middle tabular-nums whitespace-nowrap">
                    <Link
                      href={`/loyalty/clients/${encodeURIComponent(r.customerPhoneNormalized)}`}
                      className="hover:text-accent underline-offset-4 hover:underline"
                    >
                      {formatPhoneForDisplay(r.customerPhoneNormalized)}
                    </Link>
                  </td>
                  <td className="py-2 px-2 align-middle text-right tabular-nums">
                    {r.balance}
                  </td>
                  <td className="py-2 px-2 align-middle text-right text-ink/55 tabular-nums whitespace-nowrap">
                    {formatRelativeFr(r.lastActivityAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasMore ? (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-4 w-full sm:w-auto sm:self-start border-2 border-ink px-5 py-3 font-mono text-[11px] font-bold uppercase tracking-widest hover:bg-ink hover:text-base transition-colors disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-accent/20"
            >
              Voir plus
            </button>
          ) : null}
        </div>
      )}

      {searching ? (
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink/40">
          Recherche…
        </p>
      ) : null}
    </section>
  );
}
