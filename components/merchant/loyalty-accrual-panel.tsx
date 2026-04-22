"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormInput } from "@/components/ui/form-input";
import { cn } from "@/lib/utils/cn";
import {
  recordAccrualAction,
  recordRedemptionAction,
} from "@/app/[locale]/(merchant)/loyalty/actions";

type Props = {
  accrualType: "per_visit" | "per_euro";
  threshold: number;
  rewardDescription: string;
};

type AccrualFeedback = {
  customerId: string;
  phoneDisplay: string;
  name: string | null;
  delta: number;
  newBalance: number;
  rewardReady: boolean;
};

function formatPhoneAsType(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  return digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

export function LoyaltyAccrualPanel({
  accrualType,
  threshold,
  rewardDescription,
}: Props) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [feedback, setFeedback] = useState<AccrualFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [redeeming, startRedeem] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await recordAccrualAction({
        phone,
        name: name.trim() ? name.trim() : null,
        amountSpent:
          accrualType === "per_euro"
            ? Number(amount.replace(",", "."))
            : undefined,
      });
      if (res.status === "error") {
        setError(res.message);
        return;
      }
      setFeedback(res.feedback);
      setPhone("");
      setName("");
      setAmount("");
      router.refresh();
    });
  };

  const handleRedeem = () => {
    if (!feedback) return;
    startRedeem(async () => {
      const res = await recordRedemptionAction({
        customerId: feedback.customerId,
      });
      if (res.status === "error") {
        setError(res.message);
        return;
      }
      setFeedback({
        ...feedback,
        newBalance: res.newBalance,
        rewardReady: res.newBalance >= threshold,
      });
      router.refresh();
    });
  };

  const remaining = feedback
    ? Math.max(threshold - feedback.newBalance, 0)
    : null;

  const unitLabel = accrualType === "per_visit" ? "tampon" : "point";
  const unitLabelPlural = accrualType === "per_visit" ? "tampons" : "points";

  return (
    <section className="border-b-4 border-outline">
      <div className="px-6 py-6 border-b border-outline bg-base/50 flex items-center justify-between">
        <h2 className="font-mono font-bold text-lg uppercase tracking-widest text-ink/40">
          01 / Ajouter un passage
        </h2>
      </div>
      <form onSubmit={handleSubmit} className="px-6 py-6 flex flex-col gap-5">
        <FormInput
          label="Téléphone"
          name="phone"
          type="tel"
          inputMode="numeric"
          placeholder="06 12 34 56 78"
          value={phone}
          onChange={(e) => setPhone(formatPhoneAsType(e.target.value))}
          autoComplete="off"
          required
        />
        <FormInput
          label="Nom"
          name="name"
          placeholder="ex: Camille"
          value={name}
          onChange={(e) => setName(e.target.value)}
          hint="Optionnel"
          autoComplete="off"
        />
        {accrualType === "per_euro" ? (
          <FormInput
            label="Montant"
            name="amount"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            suffix="€"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        ) : null}

        {error ? (
          <p className="font-mono text-[11px] uppercase tracking-widest text-accent border border-accent px-4 py-3">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className={cn(
            "self-start bg-ink text-base px-6 py-3 font-mono font-bold uppercase tracking-widest text-[12px] hover:bg-accent transition-colors border-2 border-ink focus:outline-none focus:ring-4 focus:ring-accent/20",
            isPending && "opacity-60 cursor-wait",
          )}
        >
          {isPending ? "…" : "Valider"}
        </button>
      </form>

      {feedback ? (
        <div className="mx-6 mb-6 border-2 border-ink bg-base p-5 flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-4">
            <div className="flex flex-col gap-1 min-w-0">
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink/50">
                Passage enregistré
              </span>
              <span className="font-bold text-[15px] truncate">
                {feedback.name ?? feedback.phoneDisplay}
              </span>
              <span className="font-mono text-[11px] text-ink/60">
                {feedback.phoneDisplay} · +{feedback.delta.toFixed(2).replace(".", ",")}{" "}
                {feedback.delta === 1 ? unitLabel : unitLabelPlural}
              </span>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="font-mono text-[10px] uppercase tracking-widest text-ink/50">
                Solde
              </div>
              <div className="font-mono text-2xl font-bold tracking-tighter">
                {feedback.newBalance.toFixed(
                  feedback.newBalance % 1 === 0 ? 0 : 2,
                ).replace(".", ",")}
                <span className="text-xs text-ink/50 ml-1">
                  / {threshold.toFixed(threshold % 1 === 0 ? 0 : 2).replace(".", ",")}
                </span>
              </div>
            </div>
          </div>

          {feedback.rewardReady ? (
            <div className="flex flex-col gap-3 border-t-2 border-accent pt-4">
              <p className="font-mono text-[12px] uppercase tracking-widest font-bold text-accent">
                🎉 Récompense disponible
              </p>
              <p className="text-[14px] leading-snug text-ink">
                {rewardDescription}
              </p>
              <button
                type="button"
                onClick={handleRedeem}
                disabled={redeeming}
                className={cn(
                  "self-start bg-accent text-base px-5 py-3 font-mono font-bold uppercase tracking-widest text-[12px] hover:bg-ink transition-colors border-2 border-transparent focus:outline-none focus:ring-4 focus:ring-accent/20",
                  redeeming && "opacity-60 cursor-wait",
                )}
              >
                {redeeming ? "…" : "Marquer comme utilisée"}
              </button>
            </div>
          ) : remaining !== null && remaining > 0 ? (
            <p className="font-mono text-[11px] uppercase tracking-widest text-ink/60 border-t border-outline pt-4">
              Encore {remaining.toFixed(remaining % 1 === 0 ? 0 : 2).replace(".", ",")}{" "}
              {remaining === 1 ? unitLabel : unitLabelPlural} avant la récompense
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
