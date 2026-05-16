"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

type CopyButtonProps = {
  value: string;
  label?: string;
  className?: string;
};

export function CopyButton({ value, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }, [value]);

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label ?? `Copier ${value}`}
      className={cn(
        "w-full flex items-center justify-between gap-3 border border-outline hover:border-ink px-4 py-3 text-left bg-base transition-colors group focus:outline-none focus:ring-4 focus:ring-accent/20",
        className,
      )}
    >
      <span
        className={cn(
          "font-mono text-sm truncate",
          copied ? "text-accent" : "text-ink",
        )}
      >
        {copied ? "Copié !" : value}
      </span>
      <span
        className={cn(
          "font-mono text-[10px] uppercase tracking-widest flex-shrink-0",
          copied
            ? "text-accent"
            : "text-ink/40 group-hover:text-ink transition-colors",
        )}
      >
        {copied ? "✓" : "Copier"}
      </span>
    </button>
  );
}
