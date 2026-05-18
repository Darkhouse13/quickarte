"use client";

import React, { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type ProductCustomizationOptionValue = {
  id: string;
  name: string;
  priceAddition: string;
  available: boolean;
  position: number;
};

export function ValueRow({
  value,
  first,
  last,
  pending,
  saved,
  savedKey,
  registerName,
  onCommitName,
  onCommitPrice,
  onAvailability,
  onMove,
  onDelete,
}: {
  value: ProductCustomizationOptionValue;
  first: boolean;
  last: boolean;
  pending: boolean;
  saved: boolean;
  savedKey: number;
  registerName: (el: HTMLInputElement | null) => void;
  onCommitName: (raw: string) => boolean;
  onCommitPrice: (raw: string) => boolean;
  onAvailability: (available: boolean) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  const free = Number(value.priceAddition) === 0;
  return (
    <div
      data-testid="value-row"
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-outline px-3 py-3 last:border-b-0",
        !value.available && "opacity-55",
      )}
    >
        <div
          data-testid="value-row-info"
          className="min-w-0 flex flex-col gap-1"
        >
          <div className="flex items-center gap-2">
            <InlineText
              ariaLabel="Nom de la valeur"
              value={value.name}
              placeholder="Nom"
              inputRef={registerName}
              className={cn(
                "flex-1 min-w-0 font-sans font-semibold text-sm px-0 py-0 hover:border-transparent focus:px-2 focus:py-2",
                !value.available && "line-through",
              )}
              onCommit={onCommitName}
            />
            {saved ? <SavedFlash key={savedKey} /> : null}
          </div>
          <div className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-ink/50">
            <span>+</span>
            <InlineText
              ariaLabel="Supplément de prix"
              numeric
              value={free ? "" : Number(value.priceAddition).toString()}
              placeholder="Gratuit"
              className="w-20 px-0 py-0 font-mono text-[10px] uppercase tracking-widest hover:border-transparent focus:px-2 focus:py-2"
              onCommit={onCommitPrice}
            />
            {!free ? <span>MAD</span> : null}
          </div>
        </div>

        <div
          data-testid="value-row-toggle"
          className="flex items-center justify-center"
        >
          <button
            type="button"
            role="switch"
            aria-checked={value.available}
            aria-label="Disponible"
            disabled={pending}
            onClick={() => onAvailability(!value.available)}
            data-testid="value-row-toggle-button"
            className={cn(
              "w-11 min-h-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-accent/30",
              pending && "opacity-60 cursor-not-allowed",
            )}
          >
            <span
              className={cn(
                "w-9 h-5 p-[2px] flex items-center transition-all",
                value.available ? "bg-ink justify-end" : "bg-outline justify-start",
              )}
            >
              <span className="w-4 h-4 bg-base" />
            </span>
          </button>
        </div>

        <div data-testid="value-row-arrows" className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Monter"
            disabled={pending || first}
            onClick={() => onMove(-1)}
            className="flex min-h-[44px] w-8 items-center justify-center text-ink disabled:text-ink/25 focus:outline-none"
          >
            <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.5} strokeLinecap="square" />
          </button>
          <button
            type="button"
            aria-label="Descendre"
            disabled={pending || last}
            onClick={() => onMove(1)}
            className="flex min-h-[44px] w-8 items-center justify-center text-ink disabled:text-ink/25 focus:outline-none"
          >
            <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.5} strokeLinecap="square" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            data-testid="value-row-delete"
            aria-label="Supprimer"
            className="flex min-h-[44px] w-8 items-center justify-center text-ink/45 hover:text-accent transition-colors focus:outline-none"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} strokeLinecap="square" />
          </button>
        </div>
    </div>
  );
}

export function InlineText({
  value,
  onCommit,
  ariaLabel,
  placeholder,
  numeric = false,
  className,
  inputRef,
}: {
  value: string;
  onCommit: (next: string) => boolean | void;
  ariaLabel: string;
  placeholder?: string;
  numeric?: boolean;
  className?: string;
  inputRef?: (el: HTMLInputElement | null) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    if (draft === value) return;
    const accepted = onCommit(draft);
    if (accepted === false) setDraft(value);
  };

  return (
    <input
      ref={inputRef}
      aria-label={ariaLabel}
      type={numeric ? "number" : "text"}
      inputMode={numeric ? "decimal" : undefined}
      step={numeric ? "0.01" : undefined}
      min={numeric ? "0" : undefined}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className={cn(
        "border border-transparent px-2 py-2 bg-transparent text-sm text-ink placeholder:text-ink/35 hover:border-outline focus:outline-none focus:border-ink focus:bg-white transition-colors",
        className,
      )}
    />
  );
}

export function ReorderColumn({
  first,
  last,
  pending,
  onMove,
  small = false,
  dataTestId,
}: {
  first: boolean;
  last: boolean;
  pending: boolean;
  onMove: (direction: -1 | 1) => void;
  small?: boolean;
  dataTestId?: string;
}) {
  return (
    <div
      data-testid={dataTestId}
      className={cn(
        "shrink-0 flex flex-col",
        small ? "border-l border-outline" : "border-l-2 border-ink",
      )}
    >
      <button
        type="button"
        aria-label="Monter"
        disabled={pending || first}
        onClick={() => onMove(-1)}
        className={cn(
          "w-11 min-h-[44px] flex-1 flex items-center justify-center text-ink hover:text-accent disabled:opacity-25 disabled:hover:text-ink transition-colors focus:outline-none focus:bg-accent/10",
        )}
      >
        <ArrowUp
          className={small ? "w-3.5 h-3.5" : "w-4 h-4"}
          strokeWidth={2}
          strokeLinecap="square"
        />
      </button>
      <button
        type="button"
        aria-label="Descendre"
        disabled={pending || last}
        onClick={() => onMove(1)}
        className={cn(
          "w-11 min-h-[44px] flex-1 flex items-center justify-center text-ink hover:text-accent disabled:opacity-25 disabled:hover:text-ink transition-colors focus:outline-none focus:bg-accent/10",
          small ? "border-t border-outline" : "border-t-2 border-ink",
        )}
      >
        <ArrowDown
          className={small ? "w-3.5 h-3.5" : "w-4 h-4"}
          strokeWidth={2}
          strokeLinecap="square"
        />
      </button>
    </div>
  );
}

export function SavedFlash() {
  return (
    <span className="qk-saved-flash shrink-0 font-mono text-[9px] uppercase tracking-widest text-accent">
      Enregistré
    </span>
  );
}
