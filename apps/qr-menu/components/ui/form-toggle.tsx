"use client";

import { useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils/cn";

type FormToggleProps = {
  label: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
};

export function FormToggle({
  label,
  checked,
  defaultChecked = false,
  onCheckedChange,
  className,
  disabled = false,
}: FormToggleProps) {
  const [internal, setInternal] = useState(defaultChecked);
  const isControlled = checked !== undefined;
  const value = isControlled ? (checked as boolean) : internal;

  const toggle = () => {
    if (disabled) return;
    const next = !value;
    if (!isControlled) setInternal(next);
    onCheckedChange?.(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between py-2 mt-2",
        className,
      )}
    >
      <label
        className="font-mono text-[11px] uppercase tracking-widest text-ink cursor-pointer"
        onClick={toggle}
      >
        {label}
      </label>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={toggle}
        onKeyDown={onKeyDown}
        className={cn(
          "w-12 h-6 border-2 border-ink p-[2px] flex items-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 focus:ring-offset-2 focus:ring-offset-base transition-all",
          value ? "bg-ink justify-end" : "bg-base justify-start",
          disabled && "opacity-60 cursor-not-allowed",
        )}
      >
        <div className="w-4 h-4 bg-base border border-ink" />
      </button>
    </div>
  );
}
