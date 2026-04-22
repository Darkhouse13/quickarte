import type { TopLoyalCustomer } from "@/lib/analytics/types";
import { formatAmountCompact } from "@/lib/utils/currency";

type TopCustomersListProps = {
  customers: TopLoyalCustomer[];
  emptyLabel: string;
};

export function TopCustomersList({
  customers,
  emptyLabel,
}: TopCustomersListProps) {
  if (customers.length === 0) {
    return (
      <p className="px-6 py-6 font-sans text-sm text-ink/50 leading-snug">
        {emptyLabel}
      </p>
    );
  }
  return (
    <ol className="flex flex-col">
      {customers.map((c, i) => {
        const isLast = i === customers.length - 1;
        const name = c.name?.trim() ? c.name : "Client anonyme";
        return (
          <li
            key={c.customerId}
            className={
              "px-6 py-3 flex items-center justify-between gap-3" +
              (isLast ? "" : " border-b border-outline")
            }
          >
            <div className="flex items-baseline gap-3 min-w-0">
              <span className="font-mono text-[11px] text-ink/40 font-bold w-5 flex-shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex flex-col min-w-0">
                <span className="font-sans text-[14px] leading-tight truncate">
                  {name}
                </span>
                <span className="font-mono text-[10px] text-ink/50 leading-tight">
                  {c.phoneDisplay}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
              <span className="font-mono text-[13px] font-bold tracking-tighter leading-none">
                {formatAmountCompact(c.lifetimeEarned)}
                <span className="text-[9px] font-normal text-ink/50 ml-1">
                  total
                </span>
              </span>
              <span className="font-mono text-[10px] text-ink/50 leading-none">
                solde {formatAmountCompact(c.balance)}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
