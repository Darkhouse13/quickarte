"use client";

import React, { useEffect, useRef } from "react";
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
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeId) return;
    const activeButton = scrollerRef.current?.querySelector<HTMLElement>(
      `[data-category-id="${CSS.escape(activeId)}"]`,
    );
    activeButton?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [activeId]);

  return (
    <div className={cn("bg-base border-b border-outline", className)}>
      <div className="relative">
        <div
          ref={scrollerRef}
          className="category-scrollbar flex overflow-x-auto py-4 px-6 gap-3 snap-x snap-mandatory"
          aria-label="Filtres de catégories"
        >
          {categories.map((c) => {
            const active = c.id === activeId;
            return (
              <button
                key={c.id}
                type="button"
                data-category-id={c.id}
                aria-current={active ? "true" : undefined}
                onClick={() => onSelect?.(c.id)}
                className={cn(
                  "shrink-0 snap-start px-5 py-2.5 text-sm font-bold uppercase tracking-wider whitespace-nowrap transition-colors border",
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
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-base to-transparent" />
      </div>
    </div>
  );
}
