"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";

export type LoyaltyCustomerRow = {
  id: string;
  phoneDisplay: string;
  name: string | null;
  balance: number;
  threshold: number;
  lastVisitLabel: string;
};

type Props = {
  customers: LoyaltyCustomerRow[];
  total: number;
  pageSize: number;
  currentPage: number;
  initialSearch: string;
};

export function LoyaltyCustomerList({
  customers,
  total,
  pageSize,
  currentPage,
  initialSearch,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const applySearch = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (search.trim().length > 0) params.set("q", search.trim());
      else params.delete("q");
      params.delete("page");
      router.push(`/loyalty?${params.toString()}`);
    });
  };

  const goToPage = (page: number) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (page <= 1) params.delete("page");
      else params.set("page", String(page));
      router.push(`/loyalty?${params.toString()}`);
    });
  };

  return (
    <section>
      <div className="px-6 py-6 border-b border-outline bg-base/50 flex items-center justify-between">
        <h2 className="font-mono font-bold text-lg uppercase tracking-widest text-ink/40">
          02 / Mes clients fidèles
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink/50 font-bold">
          {total}
        </span>
      </div>

      <form onSubmit={applySearch} className="px-6 py-5 border-b border-outline">
        <div className="relative flex items-center">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou téléphone…"
            className="w-full bg-transparent border border-outline px-4 py-3 font-sans text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:border-ink focus:bg-white transition-colors"
          />
          <button
            type="submit"
            disabled={isPending}
            className="ml-3 bg-ink text-base px-4 py-3 font-mono font-bold uppercase tracking-widest text-[11px] hover:bg-accent transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20 disabled:opacity-60"
          >
            {isPending ? "…" : "OK"}
          </button>
        </div>
      </form>

      {customers.length === 0 ? (
        <p className="px-6 py-10 text-center font-sans text-sm text-ink/50">
          Aucun client fidèle pour le moment
        </p>
      ) : (
        <ul className="flex flex-col">
          {customers.map((c) => (
            <li
              key={c.id}
              className="p-5 px-6 flex justify-between items-center gap-4 border-b border-outline"
            >
              <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                <span className="font-bold text-[15px] leading-none truncate">
                  {c.name ?? c.phoneDisplay}
                </span>
                <span className="font-mono text-[12px] text-ink/50 leading-none">
                  {c.phoneDisplay}
                  {c.name ? "" : ""}
                </span>
                <span className="font-mono text-[11px] text-ink/40 leading-none mt-1">
                  {c.lastVisitLabel}
                </span>
              </div>
              <div className="text-right flex-shrink-0">
                <div
                  className={cn(
                    "font-mono text-lg font-bold tracking-tight leading-none",
                    c.balance >= c.threshold ? "text-accent" : "text-ink",
                  )}
                >
                  {c.balance.toFixed(c.balance % 1 === 0 ? 0 : 2).replace(".", ",")}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-ink/40 mt-1">
                  / {c.threshold.toFixed(c.threshold % 1 === 0 ? 0 : 2).replace(".", ",")}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <div className="px-6 py-5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1 || isPending}
            className="font-mono text-[11px] uppercase tracking-widest text-ink hover:text-accent disabled:text-ink/30 disabled:cursor-not-allowed"
          >
            ← Précédent
          </button>
          <span className="font-mono text-[11px] text-ink/50">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages || isPending}
            className="font-mono text-[11px] uppercase tracking-widest text-ink hover:text-accent disabled:text-ink/30 disabled:cursor-not-allowed"
          >
            Suivant →
          </button>
        </div>
      ) : null}
    </section>
  );
}
