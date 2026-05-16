"use client";

import { useMemo, useState } from "react";
import { updateCreditProgramSettings } from "@/lib/loyalty/actions";
import type { LoyaltyProgram } from "@/lib/db/schema";
import {
  FieldRow,
  LiveTextInput,
  LoyaltyToast,
  ToggleRow,
  useLiveSave,
} from "./live-save";

type ProgrammeState = {
  enabled: boolean;
  creditLabel: string;
  accrualPerMad: number;
  minOrderForAccrualMad: number;
  reviewRewardEnabled: boolean;
  creditsPerReview: number;
  reviewMaxAgeDays: number;
  redemptionEnabled: boolean;
  minBalanceToRedeem: number;
};

function programToState(program: LoyaltyProgram | null): ProgrammeState {
  return {
    enabled: program?.enabled ?? false,
    creditLabel: program?.creditLabel ?? "Crédits",
    accrualPerMad: program ? Number(program.accrualPerMad) : 0.1,
    minOrderForAccrualMad: program ? Number(program.minOrderForAccrualMad) : 0,
    reviewRewardEnabled: program?.reviewRewardEnabled ?? false,
    creditsPerReview: program?.creditsPerReview ?? 0,
    reviewMaxAgeDays: program?.reviewMaxAgeDays ?? 30,
    redemptionEnabled: program?.redemptionEnabled ?? true,
    minBalanceToRedeem: program?.minBalanceToRedeem ?? 0,
  };
}

export function ProgrammeTab({
  businessId,
  program,
}: {
  businessId: string;
  program: LoyaltyProgram | null;
}) {
  const [state, setState] = useState<ProgrammeState>(() => programToState(program));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { commit, toast, savedKey, isPending } = useLiveSave();

  const dimmed = !state.enabled;

  const persist = (next: ProgrammeState, field: string) => {
    const snapshot = state;
    commit({
      field,
      optimistic: () => setState(next),
      rollback: () => setState(snapshot),
      action: () =>
        updateCreditProgramSettings({
          businessId,
          creditLabel: next.creditLabel.trim() || "Crédits",
          accrualPerMad: next.accrualPerMad,
          minOrderForAccrualMad: next.minOrderForAccrualMad,
          reviewRewardEnabled: next.reviewRewardEnabled,
          creditsPerReview: next.creditsPerReview,
          reviewMaxAgeDays: next.reviewMaxAgeDays,
          redemptionEnabled: next.redemptionEnabled,
          minBalanceToRedeem: next.minBalanceToRedeem,
          enabled: next.enabled,
        }),
    });
  };

  const accrualHelper = useMemo(() => {
    if (state.accrualPerMad <= 0) return "Mettez 0 pour suspendre l'accumulation.";
    if (state.accrualPerMad >= 1) {
      const mad = (1 / state.accrualPerMad).toFixed(2).replace(/\.00$/, "");
      return `Soit 1 MAD pour ${mad} crédit(s) cumulé(s).`;
    }
    const mad = Math.round(1 / state.accrualPerMad);
    return `Soit 1 crédit pour ${mad} MAD dépensés.`;
  }, [state.accrualPerMad]);

  const setField = <K extends keyof ProgrammeState>(key: K, value: ProgrammeState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  const setError = (key: string, msg: string | null) =>
    setErrors((e) => {
      const next = { ...e };
      if (msg) next[key] = msg;
      else delete next[key];
      return next;
    });

  const wasSaved = (field: string) => savedKey?.field === field;

  return (
    <section className="px-6 py-6 flex flex-col gap-6">
      <h2 className="font-mono font-bold text-[11px] uppercase tracking-widest text-ink/40">
        Réglages du programme
      </h2>

      <ToggleRow
        label="Programme de crédits"
        helper="Activez pour que vos clients gagnent et utilisent des crédits."
        checked={state.enabled}
        disabled={isPending}
        saved={wasSaved("enabled")}
        onChange={(next) => persist({ ...state, enabled: next }, "enabled")}
      />

      <FieldRow
        label="Nom des crédits"
        helper="Le mot que vos clients verront. Exemples : Crédits, Étoiles, Points."
        saved={wasSaved("creditLabel")}
        error={errors["creditLabel"]}
        dimmed={dimmed}
      >
        <LiveTextInput
          ariaLabel="Nom des crédits"
          value={state.creditLabel}
          maxLength={32}
          onCommit={(raw) => {
            const trimmed = raw.trim();
            if (trimmed.length === 0) {
              setError("creditLabel", "Donnez un nom à vos crédits.");
              return;
            }
            if (trimmed.length > 32) {
              setError("creditLabel", "Maximum 32 caractères.");
              return;
            }
            setError("creditLabel", null);
            persist({ ...state, creditLabel: trimmed }, "creditLabel");
          }}
        />
      </FieldRow>

      <FieldRow
        label="Taux d'accumulation"
        helper={accrualHelper}
        saved={wasSaved("accrualPerMad")}
        error={errors["accrualPerMad"]}
        dimmed={dimmed}
      >
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <LiveTextInput
              ariaLabel="Crédits par MAD dépensé"
              numeric
              step="0.1"
              min={0}
              max={100}
              value={String(state.accrualPerMad)}
              onCommit={(raw) => {
                const parsed = Number(raw);
                if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
                  setError("accrualPerMad", "Entrez une valeur entre 0 et 100.");
                  return;
                }
                setError("accrualPerMad", null);
                setField("accrualPerMad", parsed);
                persist({ ...state, accrualPerMad: parsed }, "accrualPerMad");
              }}
            />
          </div>
          <span className="font-mono text-[11px] uppercase tracking-widest text-ink/55 shrink-0">
            crédit(s) / 1 MAD dépensé
          </span>
        </div>
      </FieldRow>

      <FieldRow
        label="Montant minimum par commande"
        helper="Les commandes en dessous de ce montant ne créditent rien. Mettez 0 pour tout créditer."
        saved={wasSaved("minOrderForAccrualMad")}
        error={errors["minOrderForAccrualMad"]}
        dimmed={dimmed}
      >
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <LiveTextInput
              ariaLabel="Montant minimum par commande"
              numeric
              step="1"
              min={0}
              max={100000}
              value={String(state.minOrderForAccrualMad)}
              onCommit={(raw) => {
                const parsed = Number(raw);
                if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100000) {
                  setError("minOrderForAccrualMad", "Entrez une valeur entre 0 et 100 000.");
                  return;
                }
                setError("minOrderForAccrualMad", null);
                setField("minOrderForAccrualMad", parsed);
                persist({ ...state, minOrderForAccrualMad: parsed }, "minOrderForAccrualMad");
              }}
            />
          </div>
          <span className="font-mono text-[11px] uppercase tracking-widest text-ink/55 shrink-0">
            MAD
          </span>
        </div>
      </FieldRow>

      <ToggleRow
        label="Permettre l'utilisation des crédits"
        helper="Quand désactivé, l'onglet Récompenses reste configurable mais les clients ne peuvent pas dépenser leurs crédits."
        checked={state.redemptionEnabled}
        disabled={isPending}
        saved={wasSaved("redemptionEnabled")}
        onChange={(next) => persist({ ...state, redemptionEnabled: next }, "redemptionEnabled")}
      />

      <FieldRow
        label="Solde minimum pour utiliser ses crédits"
        helper="Le client doit avoir au moins ce solde pour passer une commande en crédits. Mettez 0 pour ne pas imposer de seuil."
        saved={wasSaved("minBalanceToRedeem")}
        error={errors["minBalanceToRedeem"]}
        dimmed={dimmed}
      >
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <LiveTextInput
              ariaLabel="Solde minimum pour utiliser ses crédits"
              numeric
              step="1"
              min={0}
              max={1000000}
              value={String(state.minBalanceToRedeem)}
              onCommit={(raw) => {
                const parsed = Number(raw);
                if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1000000) {
                  setError("minBalanceToRedeem", "Entrez un entier entre 0 et 1 000 000.");
                  return;
                }
                setError("minBalanceToRedeem", null);
                setField("minBalanceToRedeem", parsed);
                persist({ ...state, minBalanceToRedeem: parsed }, "minBalanceToRedeem");
              }}
            />
          </div>
          <span className="font-mono text-[11px] uppercase tracking-widest text-ink/55 shrink-0">
            crédits
          </span>
        </div>
      </FieldRow>

      <LoyaltyToast toast={toast} />
    </section>
  );
}
