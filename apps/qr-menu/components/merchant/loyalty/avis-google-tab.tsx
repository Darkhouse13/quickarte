"use client";

import { useState } from "react";
import {
  updateCreditProgramSettings,
  updateGooglePlaceId,
} from "@/lib/loyalty/actions";
import type { GoogleReviewGrant, LoyaltyProgram } from "@quickarte/db-schema";
import { formatPhoneForDisplay } from "@/lib/utils/phone";
import {
  FieldRow,
  LiveTextInput,
  LoyaltyToast,
  ToggleRow,
  useLiveSave,
} from "./live-save";

const TZ = "Africa/Casablanca";

function formatGrantDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(date);
}

type State = {
  googlePlaceId: string;
  reviewRewardEnabled: boolean;
  creditsPerReview: number;
  reviewMaxAgeDays: number;
};

export function AvisGoogleTab({
  businessId,
  program,
  googlePlaceId,
  grants,
}: {
  businessId: string;
  program: LoyaltyProgram | null;
  googlePlaceId: string | null;
  grants: GoogleReviewGrant[];
}) {
  const [state, setState] = useState<State>({
    googlePlaceId: googlePlaceId ?? "",
    reviewRewardEnabled: program?.reviewRewardEnabled ?? false,
    creditsPerReview: program?.creditsPerReview ?? 0,
    reviewMaxAgeDays: program?.reviewMaxAgeDays ?? 30,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [helpOpen, setHelpOpen] = useState(false);
  const { commit, toast, savedKey, isPending } = useLiveSave();

  const wasSaved = (field: string) => savedKey?.field === field;
  const placeIdMissing = state.googlePlaceId.trim().length === 0;

  const persistProgram = (next: State, field: string) => {
    const snapshot = state;
    commit({
      field,
      optimistic: () => setState(next),
      rollback: () => setState(snapshot),
      action: () =>
        updateCreditProgramSettings({
          businessId,
          creditLabel: program?.creditLabel ?? "Crédits",
          accrualPerMad: program ? Number(program.accrualPerMad) : 0,
          minOrderForAccrualMad: program ? Number(program.minOrderForAccrualMad) : 0,
          reviewRewardEnabled: next.reviewRewardEnabled,
          creditsPerReview: next.creditsPerReview,
          reviewMaxAgeDays: next.reviewMaxAgeDays,
          redemptionEnabled: program?.redemptionEnabled ?? true,
          minBalanceToRedeem: program?.minBalanceToRedeem ?? 0,
          enabled: program?.enabled ?? true,
        }),
    });
  };

  const setError = (key: string, msg: string | null) =>
    setErrors((e) => {
      const next = { ...e };
      if (msg) next[key] = msg;
      else delete next[key];
      return next;
    });

  return (
    <section className="px-6 py-6 flex flex-col gap-6">
      <h2 className="font-mono font-bold text-[11px] uppercase tracking-widest text-ink/40">
        Récompense pour avis Google
      </h2>

      <FieldRow
        label="Google Place ID"
        helper="L'identifiant unique de votre établissement chez Google."
        saved={wasSaved("googlePlaceId")}
        error={errors["googlePlaceId"]}
      >
        <LiveTextInput
          ariaLabel="Google Place ID"
          value={state.googlePlaceId}
          placeholder="ChIJ..."
          onCommit={(raw) => {
            const trimmed = raw.trim();
            const snapshot = state;
            commit({
              field: "googlePlaceId",
              optimistic: () => setState((s) => ({ ...s, googlePlaceId: trimmed })),
              rollback: () => setState(snapshot),
              action: () =>
                updateGooglePlaceId({
                  businessId,
                  googlePlaceId: trimmed.length > 0 ? trimmed : null,
                }),
            });
          }}
        />
        <button
          type="button"
          onClick={() => setHelpOpen((v) => !v)}
          aria-expanded={helpOpen}
          className="self-start font-mono text-[11px] uppercase tracking-widest text-accent hover:text-ink transition-colors mt-1"
        >
          {helpOpen ? "Fermer l'aide" : "Comment trouver mon Place ID ?"}
        </button>
        {helpOpen ? (
          <div className="mt-2 border border-outline px-4 py-3 font-sans text-[12px] text-ink/70 leading-relaxed">
            <p>
              1. Allez sur Google Maps et cherchez votre établissement.
              <br />
              2. Copiez l&apos;URL de la page de votre établissement.
              <br />
              3. Le Place ID s&apos;y trouve.
            </p>
            <p className="mt-2">
              Ou utilisez l&apos;outil officiel :
              {" "}
              <span className="font-mono break-all">place-id-finder.glitch.me</span>
              {" "}ou{" "}
              <span className="font-mono break-all">
                developers.google.com/maps/documentation/places/web-service/place-id
              </span>
              .
            </p>
          </div>
        ) : null}
      </FieldRow>

      <ToggleRow
        label="Récompense pour avis activée"
        helper={
          placeIdMissing
            ? "Configurez d'abord votre Google Place ID."
            : "Crédite automatiquement les clients qui laissent un avis Google vérifié."
        }
        checked={state.reviewRewardEnabled}
        disabled={isPending || placeIdMissing}
        disabledReason="Configurez d'abord votre Google Place ID."
        saved={wasSaved("reviewRewardEnabled")}
        onChange={(next) =>
          persistProgram({ ...state, reviewRewardEnabled: next }, "reviewRewardEnabled")
        }
      />

      <FieldRow
        label="Crédits par avis vérifié"
        helper="Le nombre de crédits accordés à un client qui laisse un avis."
        saved={wasSaved("creditsPerReview")}
        error={errors["creditsPerReview"]}
      >
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <LiveTextInput
              ariaLabel="Crédits par avis vérifié"
              numeric
              step="1"
              min={0}
              max={10000}
              value={String(state.creditsPerReview)}
              onCommit={(raw) => {
                const parsed = Number(raw);
                if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10000) {
                  setError("creditsPerReview", "Entrez un entier entre 0 et 10 000.");
                  return;
                }
                setError("creditsPerReview", null);
                persistProgram({ ...state, creditsPerReview: parsed }, "creditsPerReview");
              }}
            />
          </div>
          <span className="font-mono text-[11px] uppercase tracking-widest text-ink/55 shrink-0">
            crédits
          </span>
        </div>
      </FieldRow>

      <FieldRow
        label="Ancienneté maximale des avis"
        helper="Au-delà de cette ancienneté, un avis ne génère plus de crédits. Maximum 365 jours."
        saved={wasSaved("reviewMaxAgeDays")}
        error={errors["reviewMaxAgeDays"]}
      >
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <LiveTextInput
              ariaLabel="Ancienneté maximale des avis (en jours)"
              numeric
              step="1"
              min={1}
              max={365}
              value={String(state.reviewMaxAgeDays)}
              onCommit={(raw) => {
                const parsed = Number(raw);
                if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
                  setError("reviewMaxAgeDays", "Entrez un entier entre 1 et 365.");
                  return;
                }
                setError("reviewMaxAgeDays", null);
                persistProgram({ ...state, reviewMaxAgeDays: parsed }, "reviewMaxAgeDays");
              }}
            />
          </div>
          <span className="font-mono text-[11px] uppercase tracking-widest text-ink/55 shrink-0">
            jours
          </span>
        </div>
      </FieldRow>

      <div className="pt-2">
        <h3 className="font-mono font-bold text-[11px] uppercase tracking-widest text-ink/40 mb-3">
          Avis crédités récents
        </h3>
        {grants.length === 0 ? (
          <p className="font-sans text-[13px] text-ink/55 leading-snug border border-outline px-4 py-4">
            Aucun avis vérifié pour le moment. Une fois la fonctionnalité activée,
            les clients qui laissent un avis Google verront leurs crédits crédités
            automatiquement.
          </p>
        ) : (
          <table className="w-full border-y-2 border-ink font-mono text-[12px]">
            <thead>
              <tr className="border-b border-outline text-[10px] uppercase tracking-widest text-ink/40">
                <th scope="col" className="py-2 px-2 text-left font-bold">
                  Date
                </th>
                <th scope="col" className="py-2 px-2 text-left font-bold">
                  Nom Google
                </th>
                <th scope="col" className="py-2 px-2 text-left font-bold">
                  Téléphone
                </th>
                <th scope="col" className="py-2 px-2 text-left font-bold">
                  Note
                </th>
                <th scope="col" className="py-2 px-2 text-right font-bold">
                  Crédits
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline">
              {grants.map((g) => (
                <tr key={g.id}>
                  <td className="py-2 px-2 align-top tabular-nums whitespace-nowrap">
                    {formatGrantDate(g.createdAt)}
                  </td>
                  <td className="py-2 px-2 align-top">
                    {g.googleAuthorDisplayName}
                  </td>
                  <td className="py-2 px-2 align-top tabular-nums whitespace-nowrap">
                    {formatPhoneForDisplay(g.customerPhoneNormalized)}
                  </td>
                  <td className="py-2 px-2 align-top whitespace-nowrap">
                    {g.googleReviewRating != null ? `${g.googleReviewRating}★` : "—"}
                  </td>
                  <td className="py-2 px-2 align-top text-right tabular-nums">
                    +{program?.creditsPerReview ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <LoyaltyToast toast={toast} />
    </section>
  );
}
