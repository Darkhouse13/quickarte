"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";

export type HomeRange = "today" | "7d" | "30d";

type RangeToggleProps = {
  value: HomeRange;
};

const OPTIONS: Array<{ range: HomeRange; label: string }> = [
  { range: "today", label: "Aujourd'hui" },
  { range: "7d", label: "7 jours" },
  { range: "30d", label: "30 jours" },
];

export function RangeToggle({ value }: RangeToggleProps) {
  const pathname = usePathname() ?? "/home";
  const searchParams = useSearchParams();

  function hrefFor(range: HomeRange): string {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (range === "today") {
      params.delete("range");
    } else {
      params.set("range", range);
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <div
      role="tablist"
      aria-label="Période"
      className="flex items-stretch w-full"
    >
      {OPTIONS.map((opt) => {
        const active = opt.range === value;
        return (
          <Link
            key={opt.range}
            href={hrefFor(opt.range)}
            role="tab"
            aria-selected={active}
            scroll={false}
            className={cn(
              "flex-1 font-mono text-[11px] uppercase tracking-widest font-bold px-3 py-2.5 border-2 -ml-[2px] first:ml-0 text-center transition-colors",
              active
                ? "bg-ink text-base border-ink z-10"
                : "border-outline text-ink/60 hover:border-ink hover:text-ink bg-base",
            )}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
