"use client";

import { useState, useTransition } from "react";
import { updateBusinessProfile } from "@/lib/business/actions";
import { cn } from "@/lib/utils/cn";

type SelectableType = "boulangerie" | "cafe" | "restaurant" | "other";
type StoredType =
  | "boulangerie"
  | "cafe"
  | "restaurant"
  | "hotel"
  | "retail"
  | "other";

const SELECTABLE_OPTIONS: { value: SelectableType; label: string }[] = [
  { value: "boulangerie", label: "Boulangerie" },
  { value: "cafe", label: "Café" },
  { value: "restaurant", label: "Restaurant" },
  { value: "other", label: "Autre" },
];

const TYPE_LABEL: Record<StoredType, string> = {
  boulangerie: "Boulangerie",
  cafe: "Café",
  restaurant: "Restaurant",
  hotel: "Hôtel",
  retail: "Commerce",
  other: "Autre",
};

type Props = {
  name: string;
  type: StoredType;
  slug: string;
  locationLabel: string;
};

export function BusinessProfileSection({
  name,
  type,
  slug,
  locationLabel,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const isSelectable = (t: StoredType): t is SelectableType =>
    t === "boulangerie" || t === "cafe" || t === "restaurant" || t === "other";
  const initialTile: SelectableType | null = isSelectable(type) ? type : null;
  const [selectedTile, setSelectedTile] = useState<SelectableType | null>(
    initialTile,
  );
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const enterEdit = () => {
    setDraftName(name);
    setSelectedTile(initialTile);
    setError(null);
    setNameError(null);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setError(null);
    setNameError(null);
  };

  const save = () => {
    setError(null);
    setNameError(null);
    const trimmed = draftName.trim();
    if (trimmed.length < 2) {
      setNameError("Nom trop court");
      return;
    }
    const nextType: StoredType = selectedTile ?? type;
    startTransition(async () => {
      const res = await updateBusinessProfile({
        name: trimmed,
        type: nextType,
      });
      if (!res.ok) {
        setError(res.error);
        if (res.fieldErrors?.name?.[0]) setNameError(res.fieldErrors.name[0]);
        return;
      }
      setEditing(false);
    });
  };

  const typeLabel = TYPE_LABEL[type] ?? type;
  const showCurrentTypeChip = !isSelectable(type);

  return (
    <dl className="flex flex-col divide-y divide-outline">
      {/* Nom */}
      <div className="flex items-start justify-between gap-4 px-6 py-4">
        <dt className="font-mono text-[11px] uppercase tracking-widest text-ink/50 pt-2">
          Nom
        </dt>
        <dd className="flex-1 flex justify-end">
          {editing ? (
            <div className="w-full max-w-[260px] flex flex-col items-end gap-1">
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                maxLength={80}
                className="w-full border border-outline focus:border-ink bg-white px-3 py-2 font-sans text-[15px] font-bold text-ink focus:outline-none"
                aria-label="Nom"
              />
              {nameError ? (
                <p role="alert" className="font-sans text-xs text-accent">
                  {nameError}
                </p>
              ) : null}
            </div>
          ) : (
            <span className="font-sans text-[15px] font-bold text-ink">
              {name}
            </span>
          )}
        </dd>
      </div>

      {/* Type */}
      <div className="flex items-start justify-between gap-4 px-6 py-4">
        <dt className="font-mono text-[11px] uppercase tracking-widest text-ink/50 pt-2">
          Type
        </dt>
        <dd className="flex-1 flex flex-col items-end gap-2">
          {editing ? (
            <>
              {showCurrentTypeChip ? (
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink/60 border border-outline px-1.5 py-0.5">
                  Type actuel : {typeLabel}
                </span>
              ) : null}
              <div className="w-full max-w-[260px] grid grid-cols-2 gap-0 border-2 border-ink">
                {SELECTABLE_OPTIONS.map((opt, i) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedTile(opt.value)}
                    aria-pressed={selectedTile === opt.value}
                    className={cn(
                      "py-3 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent/40",
                      selectedTile === opt.value
                        ? "bg-ink text-base"
                        : "bg-base text-ink hover:bg-black/[0.03]",
                      i % 2 === 1 && "border-l-2 border-ink",
                      i < 2 && "border-b-2 border-ink",
                    )}
                  >
                    <span className="font-bold uppercase tracking-widest text-[12px]">
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <span className="font-sans text-[15px] font-bold text-ink">
              {typeLabel}
            </span>
          )}
        </dd>
      </div>

      {/* Emplacement (read-only) */}
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <dt className="font-mono text-[11px] uppercase tracking-widest text-ink/50">
          Emplacement
        </dt>
        <dd className="font-sans text-[15px] font-bold text-ink">
          {locationLabel}
        </dd>
      </div>

      {/* Adresse publique (read-only with caption) */}
      <div className="flex flex-col gap-2 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <dt className="font-mono text-[11px] uppercase tracking-widest text-ink/50">
            Adresse publique
          </dt>
          <dd className="font-mono text-sm text-ink">{slug}</dd>
        </div>
        <p className="font-sans text-xs text-ink/50 leading-snug">
          Non modifiable pour le moment — changer l&apos;adresse publique
          invaliderait vos QR codes.
        </p>
      </div>

      {/* Action row */}
      <div className="px-6 py-5 flex flex-col gap-3">
        {editing ? (
          <>
            {error ? (
              <p
                role="alert"
                className="font-mono text-[11px] uppercase tracking-widest text-accent"
              >
                {error}
              </p>
            ) : null}
            <div className="flex items-center gap-0 border-2 border-ink">
              <button
                type="button"
                onClick={cancel}
                disabled={isPending}
                className="flex-1 py-3 bg-base text-ink font-mono font-bold uppercase tracking-widest text-[12px] hover:bg-black/[0.03] border-r-2 border-ink focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent/40 disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={save}
                disabled={isPending}
                className={cn(
                  "flex-1 py-3 font-mono font-bold uppercase tracking-widest text-[12px] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent/40 transition-colors",
                  isPending
                    ? "bg-ink/70 text-base cursor-wait"
                    : "bg-ink text-base hover:bg-accent",
                )}
              >
                {isPending ? "…" : "Enregistrer"}
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={enterEdit}
            className="flex items-center justify-between font-mono text-[11px] uppercase tracking-widest text-ink hover:text-accent transition-colors focus:outline-none"
          >
            <span>Modifier →</span>
          </button>
        )}
      </div>
    </dl>
  );
}
