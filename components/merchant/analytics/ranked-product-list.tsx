import type { ProductPerformanceEntry } from "@/lib/analytics/types";

type RankedProductListProps = {
  entries: ProductPerformanceEntry[];
  emptyLabel: string;
};

export function RankedProductList({
  entries,
  emptyLabel,
}: RankedProductListProps) {
  if (entries.length === 0) {
    return (
      <p className="px-6 py-6 font-sans text-sm text-ink/50 leading-snug">
        {emptyLabel}
      </p>
    );
  }
  return (
    <ol className="flex flex-col">
      {entries.map((entry, i) => {
        const isLast = i === entries.length - 1;
        return (
          <li
            key={entry.productId}
            className={
              "px-6 py-3 flex items-center justify-between gap-3" +
              (isLast ? "" : " border-b border-outline")
            }
          >
            <div className="flex items-baseline gap-3 min-w-0">
              <span className="font-mono text-[11px] text-ink/40 font-bold w-5 flex-shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-sans text-[14px] leading-tight truncate">
                {entry.name}
              </span>
            </div>
            <span className="font-mono text-[13px] font-bold tracking-tighter flex-shrink-0">
              {entry.quantity}
              <span className="text-[9px] font-normal text-ink/50 ml-1">
                ×
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
