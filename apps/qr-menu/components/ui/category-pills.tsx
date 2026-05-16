"use client";

import { cn } from "@/lib/utils/cn";

export type CategoryPill = {
  id: string;
  label: string;
};

type CategoryPillsProps = {
  categories: CategoryPill[];
  activeId: string;
  onSelect?: (id: string) => void;
  className?: string;
};

export function CategoryPills({
  categories,
  activeId,
  onSelect,
  className,
}: CategoryPillsProps) {
  return (
    <div className={cn("bg-base border-b border-outline", className)}>
      <div className="flex overflow-x-auto no-scrollbar py-4 px-6 gap-3">
        {categories.map((c) => {
          const active = c.id === activeId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect?.(c.id)}
              className={cn(
                "px-5 py-2.5 text-sm font-bold uppercase tracking-wider whitespace-nowrap transition-colors border",
                active
                  ? "bg-ink text-base border-ink"
                  : "bg-base text-ink border-outline hover:border-ink",
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
