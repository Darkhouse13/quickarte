"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import {
  createRedemptionListing,
  deleteRedemptionListing,
  reorderRedemptionListings,
  setRedemptionListingActive,
  updateRedemptionListing,
} from "@/lib/loyalty/actions";
import type { RedemptionListingWithProduct, AddableProduct } from "@/lib/loyalty/credits-queries";
import { cn } from "@/lib/utils/cn";
import {
  LiveTextInput,
  LoyaltyToast,
  ToggleRow,
  useLiveSave,
} from "./live-save";
import { loyaltyErrorMessage } from "@/lib/loyalty/error-messages";

const REORDER_DEBOUNCE_MS = 300;

export function RecompensesTab({
  businessId,
  listings,
  addable,
}: {
  businessId: string;
  listings: RedemptionListingWithProduct[];
  addable: AddableProduct[];
}) {
  const router = useRouter();
  const [localListings, setLocalListings] = useState(listings);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RedemptionListingWithProduct | null>(null);
  const reorderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { commit, toast, savedKey, isPending, showToast } = useLiveSave();

  useEffect(() => setLocalListings(listings), [listings]);
  useEffect(() => {
    return () => {
      if (reorderTimer.current) clearTimeout(reorderTimer.current);
    };
  }, []);

  const wasSaved = (field: string) => savedKey?.field === field;

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= localListings.length) return;
    const next = [...localListings];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    setLocalListings(next);
    if (reorderTimer.current) clearTimeout(reorderTimer.current);
    reorderTimer.current = setTimeout(() => {
      commit({
        field: `reorder`,
        action: () =>
          reorderRedemptionListings({
            businessId,
            orderedListingIds: next.map((l) => l.id),
          }),
      });
    }, REORDER_DEBOUNCE_MS);
  };

  const updatePrice = (listing: RedemptionListingWithProduct, raw: string) => {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      showToast("Le prix en crédits doit être un entier positif.");
      return;
    }
    const snapshot = localListings;
    commit({
      field: listing.id,
      optimistic: () =>
        setLocalListings((ls) =>
          ls.map((l) => (l.id === listing.id ? { ...l, creditPrice: parsed } : l)),
        ),
      rollback: () => setLocalListings(snapshot),
      action: () => updateRedemptionListing({ listingId: listing.id, creditPrice: parsed }),
    });
  };

  const toggleActive = (listing: RedemptionListingWithProduct, next: boolean) => {
    const snapshot = localListings;
    commit({
      field: listing.id,
      optimistic: () =>
        setLocalListings((ls) =>
          ls.map((l) => (l.id === listing.id ? { ...l, active: next } : l)),
        ),
      rollback: () => setLocalListings(snapshot),
      action: () => setRedemptionListingActive({ listingId: listing.id, active: next }),
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    commit({
      field: "delete",
      optimistic: () => setLocalListings((ls) => ls.filter((l) => l.id !== target.id)),
      action: () => deleteRedemptionListing({ listingId: target.id }),
    });
  };

  return (
    <section className="px-6 py-6 flex flex-col gap-5">
      <div>
        <h2 className="font-mono font-bold text-[11px] uppercase tracking-widest text-ink/40">
          Articles offerts en crédits
        </h2>
        <p className="mt-2 font-sans text-[13px] text-ink/65 leading-snug">
          Choisissez les articles de votre catalogue que vos clients pourront
          obtenir avec leurs crédits.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="w-full sm:w-auto sm:self-start min-h-[56px] border-2 border-ink bg-base text-ink font-mono font-bold text-[11px] uppercase tracking-widest hover:bg-ink hover:text-base transition-colors px-5 focus:outline-none focus:ring-4 focus:ring-accent/20"
      >
        + Ajouter un article aux récompenses
      </button>

      {localListings.length === 0 ? (
        <p className="font-sans text-[13px] text-ink/55 leading-snug border border-outline px-4 py-4">
          Aucune récompense pour le moment. Ajoutez vos premiers articles ci-dessus.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {localListings.map((listing, index) => (
            <li key={listing.id}>
              <ListingCard
                listing={listing}
                first={index === 0}
                last={index === localListings.length - 1}
                pending={isPending}
                saved={wasSaved(listing.id)}
                onMove={(d) => move(index, d)}
                onPriceCommit={(raw) => updatePrice(listing, raw)}
                onActive={(v) => toggleActive(listing, v)}
                onDelete={() => setDeleteTarget(listing)}
              />
            </li>
          ))}
        </ul>
      )}

      {pickerOpen ? (
        <ProductPicker
          businessId={businessId}
          addable={addable}
          onClose={() => setPickerOpen(false)}
          onCreated={() => {
            setPickerOpen(false);
            router.refresh();
          }}
          onError={(msg) => showToast(msg)}
        />
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-6">
          <div className="bg-base border-2 border-ink w-full max-w-[360px] p-5 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <p className="font-sans text-sm text-ink leading-snug">
                Retirer «&nbsp;{deleteTarget.productName}&nbsp;» des récompenses ?
              </p>
              <p className="font-sans text-[12px] text-ink/55 leading-snug">
                L&apos;article reste dans votre catalogue principal. Vous pourrez le
                rajouter aux récompenses plus tard.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 border-2 border-outline px-4 py-3 font-mono font-bold uppercase tracking-widest text-[11px] text-ink/60 hover:border-ink hover:text-ink transition-colors focus:outline-none"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 bg-accent text-base px-4 py-3 font-mono font-bold uppercase tracking-widest text-[11px] hover:bg-ink transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20"
              >
                Retirer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <LoyaltyToast toast={toast} />
    </section>
  );
}

function ListingCard({
  listing,
  first,
  last,
  pending,
  saved,
  onMove,
  onPriceCommit,
  onActive,
  onDelete,
}: {
  listing: RedemptionListingWithProduct;
  first: boolean;
  last: boolean;
  pending: boolean;
  saved: boolean;
  onMove: (direction: -1 | 1) => void;
  onPriceCommit: (raw: string) => void;
  onActive: (next: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <div className={cn("border-2 border-ink", !listing.active && "opacity-60")}>
      <div className="flex items-stretch">
        <div className="flex-1 min-w-0 p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex flex-col gap-1">
              <p className={cn("font-sans text-[16px] font-bold text-ink leading-tight", !listing.active && "line-through")}>
                {listing.productName}
              </p>
              <p className="font-mono text-[11px] tabular-nums text-ink/45">
                Prix catalogue : {listing.productPriceMad.toFixed(2)} MAD
              </p>
            </div>
            {saved ? (
              <span className="qk-saved-flash shrink-0 font-mono text-[9px] uppercase tracking-widest text-accent">
                Enregistré
              </span>
            ) : null}
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1 flex flex-col gap-1">
              <label className="font-mono text-[10px] uppercase tracking-widest text-ink/55">
                Prix en crédits
              </label>
              <LiveTextInput
                ariaLabel="Prix en crédits"
                numeric
                step="1"
                min={1}
                value={String(listing.creditPrice)}
                onCommit={onPriceCommit}
              />
            </div>
            <span className="font-mono text-[11px] uppercase tracking-widest text-ink/55 pb-3">
              crédits
            </span>
          </div>

          <ToggleRow
            label="Disponible"
            checked={listing.active}
            disabled={pending}
            onChange={onActive}
          />

          <button
            type="button"
            onClick={onDelete}
            className="self-start font-mono text-[10px] uppercase tracking-widest text-ink/50 hover:text-accent transition-colors focus:outline-none"
          >
            Supprimer
          </button>
        </div>

        <div className="shrink-0 flex flex-col border-l-2 border-ink">
          <button
            type="button"
            aria-label="Monter"
            disabled={pending || first}
            onClick={() => onMove(-1)}
            className="flex-1 w-11 min-h-[44px] flex items-center justify-center text-ink hover:text-accent disabled:opacity-25 disabled:hover:text-ink transition-colors focus:outline-none focus:bg-accent/10"
          >
            <ArrowUp className="w-4 h-4" strokeWidth={2} strokeLinecap="square" />
          </button>
          <button
            type="button"
            aria-label="Descendre"
            disabled={pending || last}
            onClick={() => onMove(1)}
            className="flex-1 w-11 min-h-[44px] border-t-2 border-ink flex items-center justify-center text-ink hover:text-accent disabled:opacity-25 disabled:hover:text-ink transition-colors focus:outline-none focus:bg-accent/10"
          >
            <ArrowDown className="w-4 h-4" strokeWidth={2} strokeLinecap="square" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductPicker({
  businessId,
  addable,
  onClose,
  onCreated,
  onError,
}: {
  businessId: string;
  addable: AddableProduct[];
  onClose: () => void;
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [chosen, setChosen] = useState<AddableProduct | null>(null);
  const [creditPrice, setCreditPrice] = useState("10");
  const [isSubmitting, startTransition] = useTransition();

  const submit = () => {
    if (!chosen) return;
    const parsed = Number(creditPrice);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      onError("Le prix en crédits doit être un entier positif.");
      return;
    }
    startTransition(async () => {
      const result = await createRedemptionListing({
        businessId,
        productId: chosen.id,
        creditPrice: parsed,
      });
      if (result.status === "error") {
        onError(loyaltyErrorMessage(result.code, result.message));
        return;
      }
      onCreated();
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="bg-base border-2 border-ink w-full max-w-[460px] max-h-[92vh] flex flex-col">
        <div className="px-5 py-4 border-b-2 border-ink flex items-center justify-between gap-3">
          <h3 className="font-mono font-bold text-[13px] uppercase tracking-widest">
            {chosen ? "Définir le prix en crédits" : "Choisir un article"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[11px] uppercase tracking-widest text-ink/55 hover:text-ink"
          >
            Fermer
          </button>
        </div>

        {!chosen ? (
          <div className="flex-1 overflow-y-auto">
            {addable.length === 0 ? (
              <p className="px-5 py-6 font-sans text-[13px] text-ink/55 leading-snug">
                Tous vos articles sont déjà dans les récompenses. Ajoutez d&apos;abord un
                article au catalogue.
              </p>
            ) : (
              <ul className="divide-y divide-outline">
                {addable.map((p) => (
                  <li key={p.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex flex-col">
                      <span className="font-sans text-[14px] text-ink truncate">
                        {p.name}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-ink/45">
                        {p.priceMad.toFixed(2)} MAD
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setChosen(p)}
                      className="shrink-0 border-2 border-ink px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-ink hover:text-base transition-colors focus:outline-none"
                    >
                      Choisir
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="flex-1 px-5 py-5 flex flex-col gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45">
                Article
              </p>
              <p className="font-sans text-[15px] text-ink mt-1">
                {chosen.name}{" "}
                <span className="font-mono text-[11px] text-ink/45">
                  ({chosen.priceMad.toFixed(2)} MAD)
                </span>
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="credit-price"
                className="font-mono text-[11px] uppercase tracking-widest text-ink"
              >
                Prix en crédits
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="credit-price"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step={1}
                  value={creditPrice}
                  onChange={(e) => setCreditPrice(e.target.value)}
                  className="flex-1 border border-outline bg-transparent px-4 py-3 font-mono tabular-nums text-base text-ink focus:outline-none focus:border-ink focus:bg-white transition-colors"
                />
                <span className="font-mono text-[11px] uppercase tracking-widest text-ink/55 shrink-0">
                  crédits
                </span>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setChosen(null)}
                className="flex-1 border-2 border-outline px-4 py-3 font-mono font-bold uppercase tracking-widest text-[11px] text-ink/60 hover:border-ink hover:text-ink transition-colors"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={isSubmitting}
                className="flex-1 bg-ink text-base px-4 py-3 font-mono font-bold uppercase tracking-widest text-[11px] hover:bg-accent transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20 disabled:opacity-50"
              >
                Ajouter
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
