import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type StatCardProps = {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: "default" | "accent";
  indicator?: boolean;
  valueClassName?: string;
  className?: string;
};

export function StatCard({
  label,
  value,
  unit,
  tone = "default",
  indicator = false,
  valueClassName,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "p-5 flex flex-col gap-3",
        tone === "accent" && "bg-accent/[0.02]",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink/60">
          {label}
          {unit ? <span className="text-[8px] ml-1">{unit}</span> : null}
        </span>
        {indicator ? <div className="w-2 h-2 bg-accent" /> : null}
      </div>
      <span
        className={cn(
          "font-mono text-3xl font-bold tracking-tighter",
          tone === "accent" ? "text-accent" : "text-ink",
          valueClassName,
        )}
      >
        {value}
      </span>
    </div>
  );
}
