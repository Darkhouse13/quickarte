import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { MERCHANT_BOTTOM_NAV_HEIGHT_PX } from "@/lib/layout/merchant-bottom-nav";

type BottomBarProps = {
  children: ReactNode;
  maxWidth?: 390 | 480;
  className?: string;
  innerClassName?: string;
  clearMerchantNav?: boolean;
};

export function BottomBar({
  children,
  maxWidth = 480,
  className,
  innerClassName,
  clearMerchantNav = true,
}: BottomBarProps) {
  const widthClass = maxWidth === 390 ? "max-w-[390px]" : "max-w-[480px]";
  return (
    <div
      style={
        clearMerchantNav
          ? { bottom: `${MERCHANT_BOTTOM_NAV_HEIGHT_PX}px` }
          : undefined
      }
      className={cn(
        "fixed bottom-0 left-0 w-full z-50 flex justify-center pointer-events-none",
        className,
      )}
    >
      <div
        className={cn(
          "w-full bg-base border-t-2 border-ink p-4 pointer-events-auto shadow-[0_-10px_40px_rgba(0,0,0,0.05)]",
          widthClass,
          innerClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
