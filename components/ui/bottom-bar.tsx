import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type BottomBarProps = {
  children: ReactNode;
  maxWidth?: 390 | 480;
  className?: string;
  innerClassName?: string;
};

export function BottomBar({
  children,
  maxWidth = 480,
  className,
  innerClassName,
}: BottomBarProps) {
  const widthClass = maxWidth === 390 ? "max-w-[390px]" : "max-w-[480px]";
  return (
    <div
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
