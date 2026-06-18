"use client";

/**
 * Storefront product configurator sheet.
 *
 * Opens when a customer taps `+ Ajouter` on a product with `hasConfiguration`.
 * Walks her through size + option groups, shows a running total, and emits a
 * canonical `OrderItemOptions` cart line. The server still re-validates and
 * re-snapshots — this sheet is UX only.
 *
 * Variant price labels are shown as a delta against the product base price:
 *   override > base  → "+10,00 MAD"
 *   override < base  → "−5,00 MAD"
 *   override == base / null → "Prix de base"
 * The delta is the clearest read for a customer who already saw one base price
 * on the menu card.
 *
 * Design: brutalist — 2px frame, no rounded corners, no shadow, flat scrim.
 */

import React, { useEffect, useMemo, useState } from "react";
import { X, Check } from "lucide-react";
import type {
  MenuItem,
  MenuItemOption,
  MenuItemOptionValue,
  MenuItemVariant,
} from "@/lib/catalog/fixtures";
import type { ConfiguredAddItem } from "@/lib/ordering/cart-store";
import {
  getDisplayableOptions,
  getEffectiveMaxSelections,
} from "@/lib/catalog/option-guards";
import {
  buildOrderItemOptions,
  computeConfiguratorTotal,
  effectiveMinSelections,
  hasUnorderableRequiredOption,
  isConfiguratorValid,
  isValueDisabledByCap,
  optionValidationHint,
  type ConfiguratorSelection,
  type QuantityMap,
} from "@/lib/ordering/configurator";
import { formatAmount } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";

type Props = {
  item: MenuItem;
  onClose: () => void;
  onAdd: (line: ConfiguredAddItem) => void;
};

const ACK_MS = 120;

export function ProductConfiguratorSheet({ item, onClose, onAdd }: Props) {
  const variants = item.variants ?? [];
  const hasVariantSelector = variants.length > 1;
  const rawOptions = item.options ?? [];
  const options = useMemo(
    () => getDisplayableOptions(rawOptions),
    [rawOptions],
  );

  const defaultVariant = useMemo<MenuItemVariant | null>(() => {
    if (variants.length === 0) return null;
    return (
      variants.find((v) => v.isDefault && v.available !== false) ??
      variants.find((v) => v.available !== false) ??
      variants[0] ??
      null
    );
  }, [variants]);

  const [variantId, setVariantId] = useState<string | null>(
    defaultVariant?.id ?? null,
  );
  const [selected, setSelected] = useState<ConfiguratorSelection>({});
  const [optionQuantities, setOptionQuantities] = useState<QuantityMap>({});
  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [entered, setEntered] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const selectedVariant =
    variants.find((v) => v.id === variantId) ?? defaultVariant;
  // Only products with a real choice of size snapshot a variant — matches the
  // server's `snapshotVariant = variants.length > 1` rule.
  const snapshotVariant = hasVariantSelector ? selectedVariant : null;

  // Mount animation + body scroll lock + Escape.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const scrollY = window.scrollY;
    const { body } = document;
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    return () => {
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const unorderable = hasUnorderableRequiredOption(options);

  const selectedValues = options.flatMap((option) =>
    option.values.filter((value) =>
      (selected[option.id] ?? []).includes(value.id),
    ),
  );
  // Pre-multiply priceAddition by option quantity so the running total reflects ×N.
  const effectivePricedValues = selectedValues.map((value) => ({
    priceAddition: value.priceAddition * (optionQuantities[value.id] ?? 1),
  }));
  const unitPrice = computeConfiguratorTotal(
    selectedVariant?.priceOverride ?? null,
    item.price,
    effectivePricedValues,
    1,
  );
  const total = computeConfiguratorTotal(
    selectedVariant?.priceOverride ?? null,
    item.price,
    effectivePricedValues,
    quantity,
  );

  const variantOk =
    !hasVariantSelector ||
    (selectedVariant != null && selectedVariant.available !== false);
  const valid =
    !unorderable &&
    variantOk &&
    isConfiguratorValid(options, selected, selectedVariant);

  const handleQuantityChange = (valueId: string, qty: number) => {
    setOptionQuantities((prev) => ({ ...prev, [valueId]: Math.max(1, qty) }));
  };

  const toggleValue = (option: MenuItemOption, value: MenuItemOptionValue) => {
    const current = selected[option.id] ?? [];
    if (option.type === "single_select") {
      setSelected((prev) => ({ ...prev, [option.id]: [value.id] }));
      return;
    }
    if (current.includes(value.id)) {
      setSelected((prev) => ({
        ...prev,
        [option.id]: current.filter((id) => id !== value.id),
      }));
      setOptionQuantities((prev) => {
        const next = { ...prev };
        delete next[value.id];
        return next;
      });
      return;
    }
    if (isValueDisabledByCap(option, current, value.id, selectedVariant)) {
      return;
    }
    setSelected((prev) => ({ ...prev, [option.id]: [...current, value.id] }));
  };

  const handleAdd = () => {
    if (!valid || acknowledged || !item.productId) return;
    setAcknowledged(true);
    const line: ConfiguredAddItem = {
      product_id: item.productId,
      product_name: item.name,
      quantity,
      variant_id: snapshotVariant?.id ?? null,
      variant_name: snapshotVariant?.name ?? null,
      selected_option_values: selectedValues.map((value) => ({
        id: value.id,
        quantity: optionQuantities[value.id] ?? 1,
      })),
      options_json: buildOrderItemOptions(
        snapshotVariant,
        options,
        selected,
        optionQuantities,
      ),
      notes: notes.trim().length > 0 ? notes.trim() : null,
      unit_price: unitPrice,
      image: item.image?.src,
    };
    window.setTimeout(() => onAdd(line), ACK_MS);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-center bg-ink/40 md:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "mt-auto flex w-full max-h-[90vh] flex-col border-2 border-ink bg-base",
          "md:m-auto md:max-w-[520px]",
          "transition-transform duration-300 ease-out",
          entered ? "translate-y-0" : "translate-y-full md:translate-y-0",
        )}
      >
        {/* Drag indicator — thin 2px line, mobile only. */}
        <div className="flex justify-center pt-2 md:hidden">
          <div className="h-0.5 w-10 bg-ink/25" />
        </div>

        <header className="flex items-start justify-between gap-4 border-b-2 border-ink px-6 py-5">
          <div className="min-w-0">
            <h2 className="font-sans text-xl font-black leading-tight text-ink">
              {item.name}
            </h2>
            {item.description ? (
              <p className="mt-1 font-sans text-[14px] leading-snug text-ink/60">
                {item.description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-11 w-11 shrink-0 items-center justify-center border border-outline text-ink hover:border-ink hover:text-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-7 overflow-y-auto px-6 py-6">
          {unorderable ? (
            <p className="border-l-[3px] border-accent bg-accent/[0.04] px-4 py-3 font-sans text-[14px] leading-snug text-ink/70">
              Configuration indisponible. Veuillez contacter le restaurant.
            </p>
          ) : null}

          {hasVariantSelector ? (
            <section>
              <OptionHeader title="Taille" hint="Obligatoire" />
              <div className="mt-3 border border-outline">
                {variants.map((variant, index) => {
                  const unavailable = variant.available === false;
                  return (
                    <ChoiceRow
                      key={variant.id}
                      type="radio"
                      checked={variantId === variant.id}
                      disabled={unavailable}
                      unavailable={unavailable}
                      label={variant.name}
                      priceLabel={variantPriceLabel(variant, item.price)}
                      last={index === variants.length - 1}
                      onSelect={() => {
                        if (!unavailable) setVariantId(variant.id);
                      }}
                    />
                  );
                })}
              </div>
            </section>
          ) : null}

          {options.map((option) => {
            const selectedIds = selected[option.id] ?? [];
            const hint = unorderable
              ? null
              : optionValidationHint(option, selectedIds.length);
            return (
              <section key={option.id}>
                <OptionHeader
                  title={option.name}
                  hint={optionBoundsHint(option, selectedVariant)}
                />
                {hint ? (
                  <p
                    role="alert"
                    className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-accent"
                  >
                    {hint}
                  </p>
                ) : null}
                <div className="mt-3 border border-outline">
                  {option.values.map((value, index) => {
                    const checked = selectedIds.includes(value.id);
                    const unavailable = value.available === false;
                    const capped = isValueDisabledByCap(
                      option,
                      selectedIds,
                      value.id,
                      selectedVariant,
                    );
                    const showQtyRow =
                      checked &&
                      option.type === "multi_select" &&
                      value.allowQuantity;
                    const qty = optionQuantities[value.id] ?? 1;
                    const isActuallyLast = index === option.values.length - 1;
                    return (
                      <React.Fragment key={value.id}>
                        <ChoiceRow
                          type={
                            option.type === "single_select"
                              ? "radio"
                              : "checkbox"
                          }
                          checked={checked}
                          disabled={unavailable || capped}
                          unavailable={unavailable}
                          label={value.name}
                          priceLabel={
                            value.priceAddition > 0
                              ? `+${formatAmount(value.priceAddition)}`
                              : undefined
                          }
                          last={isActuallyLast && !showQtyRow}
                          onSelect={() => toggleValue(option, value)}
                        />
                        {showQtyRow ? (
                          <div
                            className={cn(
                              "flex items-center justify-between gap-3 bg-black/[0.02] px-4 py-2",
                              !isActuallyLast && "border-b border-outline",
                            )}
                          >
                            <span className="font-mono text-[10px] uppercase tracking-widest text-ink/50">
                              Quantité
                            </span>
                            <div className="flex items-stretch border border-ink">
                              <button
                                type="button"
                                aria-label="Réduire"
                                disabled={qty <= 1}
                                onClick={() =>
                                  handleQuantityChange(value.id, qty - 1)
                                }
                                className="flex h-7 w-7 items-center justify-center font-mono font-bold hover:bg-ink hover:text-base disabled:opacity-30"
                              >
                                −
                              </button>
                              <span className="flex h-7 w-8 items-center justify-center border-x border-ink font-mono font-bold tabular-nums text-sm">
                                {qty}
                              </span>
                              <button
                                type="button"
                                aria-label="Augmenter"
                                disabled={
                                  value.maxQuantity != null &&
                                  qty >= value.maxQuantity
                                }
                                onClick={() =>
                                  handleQuantityChange(
                                    value.id,
                                    value.maxQuantity != null
                                      ? Math.min(value.maxQuantity, qty + 1)
                                      : qty + 1,
                                  )
                                }
                                className="flex h-7 w-7 items-center justify-center font-mono font-bold hover:bg-ink hover:text-base disabled:opacity-30"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </div>
              </section>
            );
          })}

          <section>
            <OptionHeader title="Note" hint="Facultatif" />
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Une remarque pour le restaurant ?"
              className="mt-3 w-full border border-outline bg-base px-4 py-3 font-sans text-sm text-ink placeholder:text-ink/40 focus:border-ink focus:outline-none"
            />
          </section>
        </div>

        <div className="flex items-stretch gap-3 border-t-2 border-ink p-4">
          <div className="flex items-stretch border-2 border-ink">
            <button
              type="button"
              aria-label="Diminuer la quantité"
              disabled={quantity <= 1}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-11 w-11 items-center justify-center font-mono text-lg font-bold hover:bg-ink hover:text-base disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink"
            >
              −
            </button>
            <span className="flex h-11 w-11 items-center justify-center border-x-2 border-ink font-mono font-bold tabular-nums">
              {quantity}
            </span>
            <button
              type="button"
              aria-label="Augmenter la quantité"
              onClick={() => setQuantity((q) => q + 1)}
              className="flex h-11 w-11 items-center justify-center font-mono text-lg font-bold hover:bg-ink hover:text-base"
            >
              +
            </button>
          </div>
          <button
            type="button"
            disabled={!valid || acknowledged}
            onClick={handleAdd}
            className={cn(
              "flex min-h-[56px] flex-1 items-center justify-center gap-2 border-2 border-transparent bg-accent px-4 text-base transition-colors",
              "hover:bg-ink hover:border-base focus:outline-none focus:ring-4 focus:ring-accent/20",
              "disabled:opacity-40 disabled:hover:bg-accent disabled:hover:border-transparent",
            )}
          >
            {acknowledged ? (
              <span className="font-bold uppercase tracking-widest text-sm">
                Ajouté ✓
              </span>
            ) : (
              <>
                <span className="font-bold uppercase tracking-widest text-sm">
                  Ajouter
                </span>
                <span className="font-mono text-sm opacity-70">—</span>
                <span className="font-mono text-base font-bold tabular-nums">
                  {formatAmount(total)}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function OptionHeader({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="font-sans text-[15px] font-bold text-ink">{title}</h3>
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-ink/50">
        {hint}
      </span>
    </div>
  );
}

function ChoiceRow({
  type,
  checked,
  disabled,
  unavailable,
  label,
  priceLabel,
  last,
  onSelect,
}: {
  type: "radio" | "checkbox";
  checked: boolean;
  disabled: boolean;
  unavailable: boolean;
  label: string;
  priceLabel?: string;
  last: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={checked}
      onClick={onSelect}
      className={cn(
        "flex min-h-[48px] w-full items-center justify-between gap-3 px-4 py-3 text-left",
        last ? "" : "border-b border-outline",
        disabled ? "opacity-40" : "hover:bg-black/[0.02]",
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <ChoiceIndicator type={type} checked={checked} />
        <span className="truncate font-sans text-sm font-bold text-ink">
          {label}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {priceLabel ? (
          <span className="font-mono text-[12px] tabular-nums text-ink/60">
            {priceLabel}
          </span>
        ) : null}
        {unavailable ? (
          <span className="border-[1.5px] border-ink px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-ink">
            Indisponible
          </span>
        ) : null}
      </span>
    </button>
  );
}

function ChoiceIndicator({
  type,
  checked,
}: {
  type: "radio" | "checkbox";
  checked: boolean;
}) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center border-2 border-ink bg-base">
      {checked && type === "radio" ? (
        <span className="h-2.5 w-2.5 bg-ink" />
      ) : null}
      {checked && type === "checkbox" ? (
        <Check className="h-3.5 w-3.5 stroke-[3] text-ink" />
      ) : null}
    </span>
  );
}

function variantPriceLabel(
  variant: MenuItemVariant,
  basePrice: number,
): string {
  if (variant.priceOverride == null) return "Prix de base";
  const delta = variant.priceOverride - basePrice;
  if (delta === 0) return "Prix de base";
  if (delta > 0) return `+${formatAmount(delta)}`;
  return `−${formatAmount(Math.abs(delta))}`;
}

function optionBoundsHint(
  option: MenuItemOption,
  variant: MenuItemVariant | null,
): string {
  const max = getEffectiveMaxSelections(option, variant);
  const hasMax = Number.isFinite(max);

  if (option.type === "single_select") {
    return option.required ? "Obligatoire" : "Facultatif";
  }

  const min = effectiveMinSelections(option);
  if (option.required) {
    return hasMax
      ? `Choisissez ${min} à ${max}`
      : `Choisissez ${min} ou plus`;
  }
  return hasMax ? `Jusqu'à ${max}` : "Plusieurs choix possibles";
}
