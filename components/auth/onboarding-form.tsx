"use client";

import { useEffect, useState, useTransition } from "react";
import { FormInput } from "@/components/ui/form-input";
import { SectionHeader } from "@/components/ui/section-header";
import { slugify, isValidSlug } from "@/lib/utils/slug";
import {
  createBusinessAction,
  type CreateBusinessInput,
} from "@/lib/business/actions";
import { cn } from "@/lib/utils/cn";

type BusinessType = "restaurant" | "cafe" | "hotel" | "other";

const TYPE_OPTIONS: { value: BusinessType; label: string }[] = [
  { value: "restaurant", label: "Restaurant" },
  { value: "cafe", label: "Café" },
  { value: "hotel", label: "Hôtel" },
  { value: "other", label: "Autre" },
];

type SlugCheck =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "ok" }
  | { state: "taken" }
  | { state: "invalid" };

export function OnboardingForm() {
  const [name, setName] = useState("");
  const [type, setType] = useState<BusinessType>("restaurant");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugCheck, setSlugCheck] = useState<SlugCheck>({ state: "idle" });
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!slugTouched) {
      setSlug(slugify(name));
    }
  }, [name, slugTouched]);

  const runSlugCheck = async (value: string) => {
    if (!value) {
      setSlugCheck({ state: "idle" });
      return;
    }
    if (!isValidSlug(value)) {
      setSlugCheck({ state: "invalid" });
      return;
    }
    setSlugCheck({ state: "checking" });
    try {
      const res = await fetch(
        `/api/check-slug?slug=${encodeURIComponent(value)}`,
      );
      const data = (await res.json()) as {
        available: boolean;
        reason: string;
      };
      setSlugCheck({
        state: data.available
          ? "ok"
          : data.reason === "invalid"
            ? "invalid"
            : "taken",
      });
    } catch {
      setSlugCheck({ state: "idle" });
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const payload: CreateBusinessInput = {
      name: name.trim(),
      type,
      city: city.trim(),
      address: address.trim().length > 0 ? address.trim() : undefined,
      slug: slug.trim(),
    };

    startTransition(async () => {
      const result = await createBusinessAction(payload);
      if (result && result.status === "error") {
        setFormError(result.message);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      }
    });
  };

  const fieldError = (n: string) => fieldErrors[n]?.[0];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col min-h-screen">
      <header className="pt-12 px-6 pb-8 flex flex-col gap-2 border-b-4 border-outline">
        <h1 className="font-mono font-bold text-2xl tracking-tighter uppercase leading-none">
          Bienvenue
        </h1>
        <p className="font-mono text-xs text-ink/60 uppercase tracking-widest">
          Créez votre établissement
        </p>
      </header>

      <section className="border-b-4 border-outline">
        <SectionHeader index={1} title="Votre établissement" />
        <div className="px-6 py-6 flex flex-col gap-5">
          <div>
            <FormInput
              label="Nom de l'établissement"
              name="name"
              placeholder="Café des Arts"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <FieldError message={fieldError("name")} />
          </div>

          <div>
            <label className="block font-mono text-[11px] uppercase tracking-widest text-ink mb-2">
              Type
            </label>
            <div className="grid grid-cols-2 gap-0 border-2 border-ink">
              {TYPE_OPTIONS.map((opt, i) => (
                <TypeButton
                  key={opt.value}
                  label={opt.label}
                  active={type === opt.value}
                  onClick={() => setType(opt.value)}
                  rowBottomBorder={i < 2}
                  colLeftBorder={i % 2 === 1}
                />
              ))}
            </div>
            <FieldError message={fieldError("type")} />
          </div>

          <div>
            <FormInput
              label="Ville"
              name="city"
              placeholder="Casablanca"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            />
            <FieldError message={fieldError("city")} />
          </div>

          <div>
            <FormInput
              label="Adresse"
              name="address"
              placeholder="12 rue des Artistes"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              hint="Optionnel"
            />
            <FieldError message={fieldError("address")} />
          </div>
        </div>
      </section>

      <section>
        <SectionHeader index={2} title="Votre identité en ligne" />
        <div className="px-6 py-6 flex flex-col gap-3 pb-32">
          <FormInput
            label="Adresse publique"
            name="slug"
            placeholder="cafe-des-arts"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
              setSlugCheck({ state: "idle" });
            }}
            onBlur={(e) => runSlugCheck(e.target.value)}
            required
          />
          <p className="font-mono text-[11px] text-ink/50">
            quickarte.app/
            <span className="text-ink font-bold">{slug || "—"}</span>
          </p>
          <SlugStatus check={slugCheck} />
          <FieldError message={fieldError("slug")} />
        </div>
      </section>

      {formError ? (
        <div className="fixed bottom-[88px] left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
          <div className="w-full max-w-[390px] bg-ink text-base border-2 border-ink px-4 py-3 pointer-events-auto">
            <p className="font-mono text-[11px] uppercase tracking-widest">
              {formError}
            </p>
          </div>
        </div>
      ) : null}

      <div className="fixed bottom-0 left-0 w-full z-50 flex justify-center pointer-events-none">
        <div className="w-full max-w-[390px] bg-base border-t-2 border-ink p-4 pointer-events-auto shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          <button
            type="submit"
            disabled={
              isPending ||
              slugCheck.state === "taken" ||
              slugCheck.state === "invalid"
            }
            className={cn(
              "w-full px-6 py-4 font-mono font-bold uppercase tracking-widest text-sm transition-colors border-2 border-transparent focus:outline-none focus:ring-4 focus:ring-accent/20",
              isPending
                ? "bg-ink/70 text-base cursor-wait"
                : "bg-ink text-base hover:bg-accent disabled:opacity-60 disabled:cursor-not-allowed",
            )}
          >
            {isPending ? "…" : "Créer mon établissement"}
          </button>
        </div>
      </div>
    </form>
  );
}

function TypeButton({
  label,
  active,
  onClick,
  rowBottomBorder,
  colLeftBorder,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  rowBottomBorder: boolean;
  colLeftBorder: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "py-4 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent/40",
        active ? "bg-ink text-base" : "bg-base text-ink hover:bg-black/[0.03]",
        colLeftBorder && "border-l-2 border-ink",
        rowBottomBorder && "border-b-2 border-ink",
      )}
    >
      <span className="font-bold uppercase tracking-widest text-[13px]">
        {label}
      </span>
    </button>
  );
}

function SlugStatus({ check }: { check: SlugCheck }) {
  if (check.state === "idle") return null;
  const styles: Record<Exclude<SlugCheck["state"], "idle">, string> = {
    checking: "text-ink/50",
    ok: "text-accent",
    taken: "text-accent",
    invalid: "text-accent",
  };
  const label: Record<Exclude<SlugCheck["state"], "idle">, string> = {
    checking: "Vérification…",
    ok: "Disponible ✓",
    taken: "Déjà utilisé",
    invalid: "Format invalide",
  };
  return (
    <p
      className={cn(
        "font-mono text-[11px] uppercase tracking-widest",
        styles[check.state],
      )}
    >
      {label[check.state]}
    </p>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mt-2 font-sans text-xs text-accent leading-snug"
    >
      {message}
    </p>
  );
}
