"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  manualCreditAdjustment,
  manualCreditGrant,
} from "@/lib/loyalty/actions";
import { LoyaltyToast, useLiveSave } from "./live-save";
import { loyaltyErrorMessage } from "@/lib/loyalty/error-messages";
import { cn } from "@/lib/utils/cn";

type Mode = "grant" | "adjust" | null;

export function CustomerActionBar({
  businessId,
  phoneNormalized,
  currentBalance,
}: {
  businessId: string;
  phoneNormalized: string;
  currentBalance: number;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { commit, toast, isPending } = useLiveSave();

  const reset = () => {
    setMode(null);
    setAmount("");
    setDescription("");
    setError(null);
  };

  const submit = () => {
    setError(null);
    const amountNum = Number(amount);
    if (!Number.isInteger(amountNum) || amountNum <= 0) {
      setError("Entrez un nombre entier positif.");
      return;
    }
    const trimmedDescription = description.trim();
    if (trimmedDescription.length === 0) {
      setError("La description est requise.");
      return;
    }
    if (mode === "grant") {
      commit({
        field: "manual-grant",
        action: () =>
          manualCreditGrant({
            businessId,
            phoneRaw: phoneNormalized,
            amount: amountNum,
            description: trimmedDescription,
          }).then((result) =>
            result.status === "error"
              ? { status: "error" as const, code: result.code, message: loyaltyErrorMessage(result.code, result.message) }
              : { status: "success" as const, data: result.data },
          ),
        onSuccess: () => {
          reset();
          router.refresh();
        },
      });
    } else if (mode === "adjust") {
      commit({
        field: "manual-adjust",
        action: () =>
          manualCreditAdjustment({
            businessId,
            phoneRaw: phoneNormalized,
            amount: -amountNum,
            description: trimmedDescription,
          }).then((result) =>
            result.status === "error"
              ? { status: "error" as const, code: result.code, message: loyaltyErrorMessage(result.code, result.message) }
              : { status: "success" as const, data: result.data },
          ),
        onSuccess: () => {
          reset();
          router.refresh();
        },
      });
    }
  };

  return (
    <section className="px-6 py-5 border-b border-outline flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "grant" ? null : "grant"));
            setError(null);
            setAmount("");
            setDescription("");
          }}
          className={cn(
            "min-h-[56px] border-2 border-ink font-mono font-bold text-[12px] uppercase tracking-widest transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20",
            mode === "grant"
              ? "bg-ink text-base"
              : "bg-base text-ink hover:bg-ink hover:text-base",
          )}
        >
          + Créditer
        </button>
        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "adjust" ? null : "adjust"));
            setError(null);
            setAmount("");
            setDescription("");
          }}
          className={cn(
            "min-h-[56px] border-2 border-ink font-mono font-bold text-[12px] uppercase tracking-widest transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20",
            mode === "adjust"
              ? "bg-ink text-base"
              : "bg-base text-ink hover:bg-ink hover:text-base",
          )}
        >
          − Ajuster
        </button>
      </div>

      {mode ? (
        <div className="border-2 border-ink p-4 flex flex-col gap-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink/55">
            {mode === "grant" ? "Créditer ce client" : "Retirer des crédits"}
          </p>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-widest text-ink">
              Montant
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="flex-1 border border-outline bg-transparent px-4 py-3 font-mono tabular-nums text-base text-ink placeholder:text-ink/30 focus:outline-none focus:border-ink focus:bg-white transition-colors"
              />
              <span className="font-mono text-[11px] uppercase tracking-widest text-ink/55 shrink-0">
                crédits
              </span>
            </div>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-widest text-ink">
              Description
            </span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                mode === "grant"
                  ? "Geste commercial — café offert"
                  : "Ajustement — erreur de saisie"
              }
              className="border border-outline bg-transparent px-4 py-3 font-sans text-base text-ink placeholder:text-ink/30 focus:outline-none focus:border-ink focus:bg-white transition-colors"
            />
          </label>
          {mode === "adjust" ? (
            <p className="font-sans text-[12px] text-ink/55 leading-snug">
              Le solde ne peut pas descendre sous zéro. Un ajustement supérieur au solde
              ({currentBalance}) sera plafonné.
            </p>
          ) : null}
          {error ? (
            <p className="font-sans text-[12px] text-accent leading-snug">{error}</p>
          ) : null}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={reset}
              className="flex-1 border-2 border-outline px-4 py-3 font-mono font-bold uppercase tracking-widest text-[11px] text-ink/60 hover:border-ink hover:text-ink transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={isPending}
              className="flex-1 bg-ink text-base px-4 py-3 font-mono font-bold uppercase tracking-widest text-[11px] hover:bg-accent transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20 disabled:opacity-50"
            >
              Enregistrer
            </button>
          </div>
        </div>
      ) : null}

      <LoyaltyToast toast={toast} />
    </section>
  );
}
