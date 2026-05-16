"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { loyaltyErrorMessage } from "@/lib/loyalty/error-messages";

const SAVED_FLASH_MS = 1_500;
const TOAST_MS = 4_000;

export type LoyaltyActionResult<T = unknown> =
  | { status: "success"; data: T }
  | { status: "error"; code?: string; message: string };

type ToastState = { id: number; message: string } | null;

export function useLiveSave() {
  const router = useRouter();
  const [toast, setToast] = useState<ToastState>(null);
  const [savedKey, setSavedKey] = useState<{ field: string; nonce: number } | null>(null);
  const [isPending, startTransition] = useTransition();
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const showToast = useCallback((message: string) => {
    setToast({ id: Date.now(), message });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  const flashSaved = useCallback((field: string) => {
    setSavedKey({ field, nonce: Date.now() });
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setSavedKey(null), SAVED_FLASH_MS);
  }, []);

  const commit = useCallback(
    <T,>(opts: {
      field: string;
      optimistic?: () => void;
      rollback?: () => void;
      action: () => Promise<LoyaltyActionResult<T>>;
      onSuccess?: (data: T) => void;
    }) => {
      opts.optimistic?.();
      startTransition(async () => {
        const result = await opts.action();
        if (result.status === "error") {
          opts.rollback?.();
          showToast(loyaltyErrorMessage(result.code, result.message));
          router.refresh();
          return;
        }
        opts.onSuccess?.(result.data);
        flashSaved(opts.field);
        router.refresh();
      });
    },
    [router, showToast, flashSaved],
  );

  return { commit, toast, savedKey, isPending, showToast } as const;
}

export function SavedFlash({ visible, nonce }: { visible: boolean; nonce: number }) {
  if (!visible) return null;
  return (
    <span
      key={nonce}
      className="qk-saved-flash font-mono text-[9px] uppercase tracking-widest text-accent"
    >
      Enregistré
    </span>
  );
}

export function LoyaltyToast({ toast }: { toast: ToastState }) {
  if (!toast) return null;
  return (
    <div
      role="status"
      key={toast.id}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 border-2 border-accent bg-base px-5 py-3 max-w-[420px] w-[calc(100%-32px)]"
    >
      <p className="font-sans text-sm text-ink leading-snug">{toast.message}</p>
    </div>
  );
}

export function FieldRow({
  label,
  hint,
  helper,
  error,
  saved,
  children,
  dimmed,
}: {
  label: string;
  hint?: ReactNode;
  helper?: ReactNode;
  error?: string;
  saved?: boolean;
  children: ReactNode;
  dimmed?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-2", dimmed && "opacity-60")}>
      <div className="flex items-baseline justify-between gap-3">
        <label className="font-mono text-[11px] uppercase tracking-widest text-ink">
          {label}
        </label>
        {saved ? (
          <span className="qk-saved-flash font-mono text-[9px] uppercase tracking-widest text-accent">
            Enregistré
          </span>
        ) : hint ? (
          <span className="font-sans text-[11px] text-ink/40">{hint}</span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p className="font-sans text-[12px] text-accent leading-snug">{error}</p>
      ) : helper ? (
        <p className="font-sans text-[12px] text-ink/55 leading-snug">{helper}</p>
      ) : null}
    </div>
  );
}

export function ToggleRow({
  label,
  helper,
  checked,
  disabled,
  onChange,
  saved,
  disabledReason,
}: {
  label: string;
  helper?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  saved?: boolean;
  disabledReason?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] uppercase tracking-widest text-ink">
          {label}
        </span>
        <div className="flex items-center gap-3">
          {saved ? (
            <span className="qk-saved-flash font-mono text-[9px] uppercase tracking-widest text-accent">
              Enregistré
            </span>
          ) : null}
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            title={disabled && disabledReason ? disabledReason : undefined}
            onClick={() => !disabled && onChange(!checked)}
            className={cn(
              "w-12 h-6 border-2 border-ink p-[2px] flex items-center transition-all focus:outline-none focus:ring-2 focus:ring-accent/30",
              checked ? "bg-ink justify-end" : "bg-base justify-start",
              disabled && "opacity-40 cursor-not-allowed",
            )}
          >
            <div className="w-4 h-4 bg-base border border-ink" />
          </button>
        </div>
      </div>
      {helper ? (
        <p className="font-sans text-[12px] text-ink/55 leading-snug">{helper}</p>
      ) : null}
    </div>
  );
}

export function LiveTextInput({
  value,
  onCommit,
  numeric,
  step,
  min,
  max,
  maxLength,
  placeholder,
  ariaLabel,
  className,
  disabled,
}: {
  value: string;
  onCommit: (raw: string) => void;
  numeric?: boolean;
  step?: string;
  min?: number;
  max?: number;
  maxLength?: number;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      aria-label={ariaLabel}
      type={numeric ? "number" : "text"}
      inputMode={numeric ? "decimal" : undefined}
      step={numeric ? (step ?? "1") : undefined}
      min={numeric && min !== undefined ? min : undefined}
      max={numeric && max !== undefined ? max : undefined}
      maxLength={maxLength}
      value={draft}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft === value) return;
        onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className={cn(
        "w-full bg-transparent border border-outline px-4 py-3 text-base text-ink placeholder:text-ink/30 focus:outline-none focus:border-ink focus:bg-white transition-colors",
        numeric && "font-mono tabular-nums",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    />
  );
}
