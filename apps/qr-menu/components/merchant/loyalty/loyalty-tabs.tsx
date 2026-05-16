"use client";

import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export type LoyaltyTabId = "programme" | "avis-google" | "recompenses" | "clients";

type TabDef = { id: LoyaltyTabId; slug: string; label: string };

export function LoyaltyTabs({
  active,
  tabs,
}: {
  active: LoyaltyTabId;
  tabs: TabDef[];
}) {
  return (
    <nav
      aria-label="Sections du programme"
      className="border-b-2 border-ink overflow-x-auto"
    >
      <ul className="flex items-stretch min-w-full">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <li key={tab.id} className="shrink-0">
              <Link
                href={`/loyalty?tab=${tab.slug}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "block px-4 py-4 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors",
                  "border-b-[3px] -mb-[2px]",
                  isActive
                    ? "border-accent text-ink"
                    : "border-transparent text-ink/40 hover:text-ink",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
