"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { FormInput } from "@/components/ui/form-input";
import { claimGoogleReviewCredits } from "@/lib/loyalty/actions";
import { loyaltyErrorMessage } from "@/lib/loyalty/error-messages";
import {
  readPhoneFromLocalStorage,
  resolveCustomerPhone,
  writePhoneToLocalStorage,
} from "@/lib/ordering/credit-cart-store";

type Props = {
  locale: string;
  businessSlug: string;
  businessName: string;
  creditLabel: string;
  creditsPerReview: number;
  googlePlaceId: string;
  initialPhone: string | null;
  fromOrder: boolean;
  orderToken: string | null;
};

type ClaimResult =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; balance: number; granted: number }
  | { kind: "error"; code: string; message: string };

export function ReviewClaimForm({
  locale,
  businessSlug,
  businessName,
  creditLabel,
  creditsPerReview,
  googlePlaceId,
  initialPhone,
  fromOrder,
  orderToken,
}: Props) {
  const [hydrated, setHydrated] = useState(false);
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [googleName, setGoogleName] = useState("");
  const [result, setResult] = useState<ClaimResult>({ kind: "idle" });
  const [, startTransition] = useTransition();

  useEffect(() => {
    setHydrated(true);
    if (!initialPhone) {
      const stored = readPhoneFromLocalStorage();
      const resolved = resolveCustomerPhone({
        fromUrl: initialPhone,
        fromStorage: stored,
      });
      if (resolved) setPhone(resolved);
    }
  }, [initialPhone]);

  const googleReviewUrl = `https://search.google.com/local/writereview?placeid=${encodeURIComponent(
    googlePlaceId,
  )}`;

  const submit = (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    setResult({ kind: "submitting" });
    startTransition(async () => {
      try {
        const response = await claimGoogleReviewCredits({
          businessSlug,
          phoneRaw: phone,
          googleDisplayName: googleName,
        });
        if (response.status === "success") {
          writePhoneToLocalStorage(phone.trim());
          setResult({
            kind: "success",
            balance: response.data.balance,
            granted: creditsPerReview,
          });
        } else {
          setResult({
            kind: "error",
            code: response.code,
            message: loyaltyErrorMessage(response.code, response.message),
          });
        }
      } catch {
        setResult({
          kind: "error",
          code: "NETWORK_ERROR",
          message: loyaltyErrorMessage("NETWORK_ERROR"),
        });
      }
    });
  };

  if (result.kind === "success") {
    const rewardsHref = `/${locale}/${businessSlug}/recompenses${
      phone.trim() ? `?phone=${encodeURIComponent(phone.trim())}` : ""
    }`;
    return (
      <section className="px-6 py-12 flex flex-col gap-10">
        <div className="flex flex-col gap-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45 font-bold">
            Crédits ajoutés
          </p>
          <span className="font-mono font-bold tabular-nums leading-[0.9] tracking-tighter text-[72px] md:text-[88px] text-accent">
            +{result.granted}
          </span>
          <p className="font-mono text-[14px] uppercase tracking-widest text-ink/70">
            {creditLabel}
          </p>
        </div>
        <div className="border-t-2 border-ink pt-6 flex flex-col gap-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45 font-bold">
            Nouveau solde
          </p>
          <p className="font-mono font-bold tabular-nums text-[32px] leading-none">
            {result.balance}{" "}
            <span className="font-mono text-[12px] uppercase tracking-widest text-ink/55 align-middle">
              {creditLabel}
            </span>
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <Link
            href={rewardsHref}
            className="w-full min-h-[56px] bg-accent text-base px-5 py-4 flex items-center justify-between gap-3 hover:bg-ink transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20"
          >
            <span className="font-mono text-[13px] uppercase tracking-widest font-bold">
              Voir les récompenses
            </span>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="square"
              strokeLinejoin="miter"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          {fromOrder && orderToken ? (
            <Link
              href={`/${locale}/o/${encodeURIComponent(orderToken)}`}
              className="font-mono text-[11px] uppercase tracking-widest text-ink/55 hover:text-ink transition-colors"
            >
              ← Retour à ma commande
            </Link>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col"
    >
      <section className="px-6 py-8 border-b border-outline flex flex-col gap-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45 font-bold">
          Étape 1
        </p>
        <h2 className="font-mono font-bold uppercase tracking-tight text-[22px] leading-tight">
          Laissez votre avis sur Google
        </h2>
        <a
          href={googleReviewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full min-h-[56px] bg-ink text-base px-5 py-4 flex items-center justify-between gap-3 hover:bg-accent transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20"
        >
          <span className="font-mono text-[13px] uppercase tracking-widest font-bold">
            Ouvrir Google Maps
          </span>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="square"
            strokeLinejoin="miter"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>
        <p className="font-sans text-[13px] text-ink/55 leading-snug">
          Une fois votre avis publié, revenez ici pour récupérer vos{" "}
          {creditLabel}.
        </p>
      </section>

      <section className="px-6 py-8 flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45 font-bold">
            Étape 2
          </p>
          <h2 className="font-mono font-bold uppercase tracking-tight text-[22px] leading-tight">
            Récupérez vos {creditLabel}
          </h2>
        </div>
        <FormInput
          label="Téléphone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          placeholder="06 12 34 56 78"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <FormInput
          label="Nom Google"
          name="google_name"
          type="text"
          required
          placeholder="Yasmine B."
          hint="Comme dans votre avis"
          value={googleName}
          onChange={(e) => setGoogleName(e.target.value)}
        />
        <button
          type="submit"
          disabled={
            result.kind === "submitting" ||
            !hydrated ||
            phone.trim().length === 0 ||
            googleName.trim().length === 0
          }
          className="w-full min-h-[56px] bg-accent text-base px-5 py-4 flex items-center justify-center gap-3 hover:bg-ink transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20 disabled:bg-outline disabled:text-ink/40 disabled:cursor-not-allowed"
        >
          <span className="font-mono text-[13px] uppercase tracking-widest font-bold">
            {result.kind === "submitting"
              ? "Vérification en cours…"
              : "Vérifier mon avis"}
          </span>
        </button>

        {result.kind === "error" ? (
          <div className="border-2 border-accent px-4 py-4 flex flex-col gap-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-accent font-bold">
              {labelForCode(result.code, businessName)}
            </p>
            <p className="font-sans text-[14px] text-ink leading-snug">
              {result.message}
            </p>
            {canRetryAfterError(result.code) ? (
              <button
                type="button"
                onClick={() => submit()}
                className="self-start min-h-[44px] border-2 border-ink px-4 py-2 hover:bg-ink hover:text-base transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20"
              >
                <span className="font-mono text-[12px] uppercase tracking-widest font-bold">
                  Réessayer
                </span>
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </form>
  );
}

function labelForCode(code: string, businessName: string): string {
  switch (code) {
    case "REVIEW_REWARD_DISABLED":
      return `Récompense indisponible chez ${businessName}`;
    case "REVIEW_NOT_FOUND":
      return "Avis introuvable pour le moment";
    case "REVIEW_ALREADY_CLAIMED":
      return "Avis déjà crédité";
    case "RATE_LIMITED":
      return "Trop de tentatives";
    default:
      return "Erreur";
  }
}

function canRetryAfterError(code: string): boolean {
  // Sterile end-states; the user has no useful retry. Disabled-rewards and
  // already-claimed reviews are settled — the form keeps the user's input
  // visible, but a retry button would be misleading.
  return code !== "REVIEW_REWARD_DISABLED" && code !== "REVIEW_ALREADY_CLAIMED";
}
