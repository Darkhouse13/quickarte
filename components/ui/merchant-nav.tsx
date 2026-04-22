"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  BookOpen,
  ReceiptText,
  Star,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

type MerchantTab = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  hasNotification?: boolean;
};

type MerchantNavProps = {
  className?: string;
  pendingOrders?: number;
  showOrders?: boolean;
  showLoyalty?: boolean;
};

export function MerchantNav({
  className,
  pendingOrders = 0,
  showOrders = false,
  showLoyalty = false,
}: MerchantNavProps) {
  const pathname = usePathname();

  const tabs: MerchantTab[] = [
    { id: "home", label: "Accueil", href: "/home", icon: House },
    { id: "catalog", label: "Catalogue", href: "/catalog", icon: BookOpen },
    ...(showOrders
      ? [
          {
            id: "orders",
            label: "Commandes",
            href: "/orders",
            icon: ReceiptText,
            hasNotification: pendingOrders > 0,
          } satisfies MerchantTab,
        ]
      : []),
    ...(showLoyalty
      ? [
          {
            id: "loyalty",
            label: "Fidélité",
            href: "/loyalty",
            icon: Star,
          } satisfies MerchantTab,
        ]
      : []),
  ];

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 w-full z-50 flex justify-center pointer-events-none",
        className,
      )}
    >
      <div className="w-full max-w-[480px] bg-base border-t-2 border-ink pointer-events-auto flex items-stretch shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        {tabs.map((tab, i) => {
          const active = pathname?.includes(tab.href) ?? false;
          const Icon = tab.icon;
          const isLast = i === tabs.length - 1;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                "flex-1 py-4 flex flex-col items-center gap-2 hover:bg-black/[0.02] transition-colors group relative",
                !isLast && "border-r border-outline",
              )}
            >
              <div className="relative">
                <Icon
                  strokeWidth={2}
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                  className={cn(
                    "w-5 h-5 transition-colors",
                    active
                      ? "text-accent"
                      : "text-ink/30 group-hover:text-ink",
                  )}
                />
                {tab.hasNotification ? (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-accent border-[1.5px] border-base" />
                ) : null}
              </div>
              <span
                className={cn(
                  "font-mono text-[9px] uppercase tracking-widest font-bold transition-colors",
                  active
                    ? "text-accent"
                    : "text-ink/40 group-hover:text-ink",
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
