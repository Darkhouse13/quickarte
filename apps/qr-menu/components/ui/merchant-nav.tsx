"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  ChefHat,
  ClipboardCheck,
  House,
  ReceiptText,
  Star,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  getMerchantTabs,
  type MerchantTabId,
} from "@/lib/navigation/merchant-tabs";

type MerchantTab = {
  id: MerchantTabId;
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
  showKitchen?: boolean;
  showClose?: boolean;
};

export function MerchantNav({
  className,
  pendingOrders = 0,
  showOrders = true,
  showLoyalty = true,
  showKitchen = false,
  showClose = false,
}: MerchantNavProps) {
  const pathname = usePathname();

  const icons: Record<MerchantTabId, LucideIcon> = {
    home: House,
    catalog: BookOpen,
    orders: ReceiptText,
    kitchen: ChefHat,
    cloture: ClipboardCheck,
    loyalty: Star,
  };
  const tabs: MerchantTab[] = getMerchantTabs(pendingOrders).map((tab) => ({
    ...tab,
    icon: icons[tab.id],
  })).filter((tab) => {
    if (tab.id === "orders") return showOrders;
    if (tab.id === "loyalty") return showLoyalty;
    if (tab.id === "kitchen") return showKitchen;
    if (tab.id === "cloture") return showClose;
    return true;
  });

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
