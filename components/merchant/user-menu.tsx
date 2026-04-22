"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils/cn";

type Props = {
  name: string | null | undefined;
  email: string;
  locale: string;
};

export function UserMenu({ name, email, locale }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  const trimmed = name?.trim();
  const initial = (trimmed?.charAt(0) ?? email.charAt(0)).toUpperCase();
  const displayName = trimmed && trimmed.length > 0 ? trimmed : email;

  useEffect(() => {
    if (!open) return;
    const handleDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const signOut = () => {
    startTransition(async () => {
      await authClient.signOut();
      Sentry.setUser(null);
      router.replace(`/${locale}/login`);
      router.refresh();
    });
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu utilisateur"
        aria-expanded={open}
        className={cn(
          "w-10 h-10 bg-ink text-base flex items-center justify-center flex-shrink-0 font-mono font-bold text-sm uppercase hover:bg-accent transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20",
          open && "bg-accent",
        )}
      >
        {initial}
      </button>

      {open ? (
        <div className="absolute top-[calc(100%+8px)] right-0 z-30 w-[220px] bg-base border-2 border-ink shadow-[0_10px_40px_rgba(0,0,0,0.08)]">
          <div className="px-4 py-3 border-b border-outline">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink/50 mb-1">
              Connecté
            </p>
            <p className="font-sans text-sm font-bold text-ink truncate">
              {displayName}
            </p>
            {trimmed ? (
              <p className="font-mono text-[11px] text-ink/50 truncate mt-0.5">
                {email}
              </p>
            ) : null}
          </div>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block w-full text-left px-4 py-3 font-mono text-[12px] uppercase tracking-widest font-bold text-ink hover:bg-ink hover:text-base transition-colors focus:outline-none focus:bg-ink focus:text-base border-b border-outline"
          >
            Paramètres
          </Link>
          <button
            type="button"
            onClick={signOut}
            disabled={isPending}
            className="w-full text-left px-4 py-3 font-mono text-[12px] uppercase tracking-widest font-bold text-ink hover:bg-ink hover:text-base transition-colors focus:outline-none focus:bg-ink focus:text-base disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPending ? "…" : "Déconnexion"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
