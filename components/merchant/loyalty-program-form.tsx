"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormInput } from "@/components/ui/form-input";
import { BottomBar } from "@/components/ui/bottom-bar";
import { cn } from "@/lib/utils/cn";
import { upsertProgramAction } from "@/app/[locale]/(merchant)/loyalty/actions";

type ProgramFormProps = {
  initial?: {
    name: string | null;
    accrualType: "per_visit" | "per_euro";
    accrualRate: string;
    rewardThreshold: string;
    rewardDescription: string;
  } | null;
};

export function LoyaltyProgramForm({ initial }: ProgramFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [accrualType, setAccrualType] = useState<"per_visit" | "per_euro">(
    initial?.accrualType ?? "per_visit",
  );
  const [accrualRate, setAccrualRate] = useState(
    initial?.accrualRate ?? (initial?.accrualType === "per_euro" ? "1" : "1"),
  );
  const [rewardThreshold, setRewardThreshold] = useState(
    initial?.rewardThreshold ?? "10",
  );
  const [rewardDescription, setRewardDescription] = useState(
    initial?.rewardDescription ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isEdit = Boolean(initial);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await upsertProgramAction({
        name: name.trim(),
        accrualType,
        accrualRate: Number(accrualRate.replace(",", ".")),
        rewardThreshold: Number(rewardThreshold.replace(",", ".")),
        rewardDescription: rewardDescription.trim(),
      });
      if (res?.status === "error") {
        setError(res.message);
        return;
      }
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 pb-32">
      <section className="px-6 py-6 border-b-4 border-outline">
        <h2 className="font-mono font-bold text-sm uppercase tracking-widest text-ink/40 mb-6">
          01 / Programme
        </h2>
        <div className="flex flex-col gap-5">
          <FormInput
            label="Nom du programme"
            name="name"
            placeholder="Fidélité Café des Arts"
            value={name}
            onChange={(e) => setName(e.target.value)}
            hint="Optionnel"
          />
        </div>
      </section>

      <section className="px-6 py-6 border-b-4 border-outline">
        <h2 className="font-mono font-bold text-sm uppercase tracking-widest text-ink/40 mb-6">
          02 / Accumulation
        </h2>
        <div className="flex flex-col gap-5">
          <label className="block font-mono text-[11px] uppercase tracking-widest text-ink">
            Type
          </label>
          <div className="grid grid-cols-1 gap-0 border-2 border-ink">
            <AccrualOption
              active={accrualType === "per_visit"}
              label="Une visite = un tampon"
              sub="Simple, comme une carte à tampons"
              onClick={() => setAccrualType("per_visit")}
            />
            <AccrualOption
              active={accrualType === "per_euro"}
              label="1 € dépensé = X points"
              sub="Points proportionnels au montant"
              onClick={() => setAccrualType("per_euro")}
              bordered
            />
          </div>

          <FormInput
            label={
              accrualType === "per_visit"
                ? "Tampons par visite"
                : "Points par euro dépensé"
            }
            name="accrualRate"
            type="text"
            inputMode="decimal"
            placeholder="1"
            value={accrualRate}
            onChange={(e) => setAccrualRate(e.target.value)}
            required
          />
        </div>
      </section>

      <section className="px-6 py-6">
        <h2 className="font-mono font-bold text-sm uppercase tracking-widest text-ink/40 mb-6">
          03 / Récompense
        </h2>
        <div className="flex flex-col gap-5">
          <FormInput
            label={
              accrualType === "per_visit"
                ? "Tampons requis"
                : "Points requis"
            }
            name="rewardThreshold"
            type="text"
            inputMode="decimal"
            placeholder="10"
            value={rewardThreshold}
            onChange={(e) => setRewardThreshold(e.target.value)}
            required
          />
          <FormInput
            label="Description"
            name="rewardDescription"
            placeholder="1 café offert"
            value={rewardDescription}
            onChange={(e) => setRewardDescription(e.target.value)}
            required
          />
        </div>

        {error ? (
          <p className="mt-6 font-mono text-[11px] uppercase tracking-widest text-accent border border-accent px-4 py-3">
            {error}
          </p>
        ) : null}
      </section>

      <BottomBar maxWidth={480}>
        <button
          type="submit"
          disabled={isPending}
          className={cn(
            "w-full px-6 py-4 font-mono font-bold uppercase tracking-widest text-sm transition-colors border-2 border-transparent focus:outline-none focus:ring-4 focus:ring-accent/20",
            isPending
              ? "bg-ink/70 text-base cursor-wait"
              : "bg-ink text-base hover:bg-accent disabled:opacity-60 disabled:cursor-not-allowed",
          )}
        >
          {isPending
            ? "…"
            : isEdit
              ? "Enregistrer les modifications"
              : "Activer le programme"}
        </button>
      </BottomBar>
    </form>
  );
}

function AccrualOption({
  active,
  label,
  sub,
  onClick,
  bordered,
}: {
  active: boolean;
  label: string;
  sub: string;
  onClick: () => void;
  bordered?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "py-4 px-5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent/40",
        active ? "bg-ink text-base" : "bg-base text-ink hover:bg-black/[0.03]",
        bordered && "border-t-2 border-ink",
      )}
    >
      <div className="flex flex-col gap-1">
        <span className="font-bold uppercase tracking-widest text-[13px]">
          {label}
        </span>
        <span
          className={cn(
            "font-mono text-[10px] uppercase tracking-widest",
            active ? "text-base/60" : "text-ink/40",
          )}
        >
          {sub}
        </span>
      </div>
    </button>
  );
}
