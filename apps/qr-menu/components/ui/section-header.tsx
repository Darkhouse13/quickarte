import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type SectionHeaderProps = {
  index: number;
  title: string;
  trailing?: ReactNode;
  className?: string;
};

export function SectionHeader({
  index,
  title,
  trailing,
  className,
}: SectionHeaderProps) {
  const padded = String(index).padStart(2, "0");
  return (
    <div
      className={cn(
        "px-6 py-6 border-b border-outline bg-base/50 flex items-center justify-between",
        className,
      )}
    >
      <h2 className="font-mono font-bold text-lg uppercase tracking-widest text-ink/40">
        {padded} / {title}
      </h2>
      {trailing}
    </div>
  );
}
