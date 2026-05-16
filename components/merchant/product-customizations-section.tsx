"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import {
  createOption,
  createOptionValue,
  createVariant,
  deleteOption,
  deleteOptionValue,
  deleteVariant,
  reorderOptions,
  reorderOptionValues,
  reorderVariants,
  setDefaultVariant,
  setOptionValueAvailability,
  setVariantAvailability,
  updateOption,
  updateOptionValue,
  updateVariant,
  type CustomizationActionResult,
} from "@/lib/catalog/customizations";
import {
  multiSelectControlsVisible,
  optionConfigIncomplete,
  reorder,
  validateOptionMinMax,
} from "@/lib/catalog/option-editor-logic";
import { cn } from "@/lib/utils/cn";
import {
  InlineText,
  ReorderColumn,
  SavedFlash,
  ValueRow,
  type ProductCustomizationOptionValue,
} from "./product-customizations-value-row";

export type { ProductCustomizationOptionValue } from "./product-customizations-value-row";

export type ProductCustomizationVariant = {
  id: string;
  name: string;
  priceOverride: string | null;
  isDefault: boolean;
  available: boolean;
  position: number;
};

export type ProductCustomizationOption = {
  id: string;
  name: string;
  type: "single_select" | "multi_select";
  required: boolean;
  minSelect: number;
  maxSelections: number | null;
  available: boolean;
  position: number;
  values: ProductCustomizationOptionValue[];
};

type Props = {
  productId?: string;
  businessSlug?: string;
  variants: ProductCustomizationVariant[];
  options: ProductCustomizationOption[];
};

type DeleteTarget = {
  kind: "variant" | "option" | "value";
  id: string;
  name: string;
};

type FocusTarget =
  | { kind: "variant" }
  | { kind: "option" }
  | { kind: "value"; optionId: string };

const REORDER_DEBOUNCE_MS = 300;
const SAVED_FLASH_MS = 1_500;
const TOAST_MS = 4_000;

function errorText(result: {
  message: string;
  fieldErrors?: Record<string, string[]>;
}): string {
  if (result.fieldErrors) {
    const first = Object.values(result.fieldErrors)[0]?.[0];
    if (first) return first;
  }
  return result.message;
}

export function ProductCustomizationsSection({
  productId,
  businessSlug,
  variants,
  options,
}: Props) {
  const router = useRouter();
  const [localVariants, setLocalVariants] = useState(variants);
  const [localOptions, setLocalOptions] = useState(options);
  const [open, setOpen] = useState(
    variants.length > 0 || options.length > 0,
  );
  const [toast, setToast] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [minMaxErrors, setMinMaxErrors] = useState<Record<string, string>>({});
  const [focusNext, setFocusNext] = useState<FocusTarget | null>(null);
  const [isPending, startTransition] = useTransition();

  const nameRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reorderTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const prevCounts = useRef<{
    variants: number;
    options: number;
    values: Record<string, number>;
  }>({ variants: variants.length, options: options.length, values: {} });

  useEffect(() => setLocalVariants(variants), [variants]);
  useEffect(() => setLocalOptions(options), [options]);

  // Focus the name field of a freshly created row. The guard waits until the
  // row count actually grows (after router.refresh resolves) so we don't focus
  // the wrong row on the intermediate render.
  useEffect(() => {
    const prev = prevCounts.current;
    if (focusNext) {
      if (focusNext.kind === "variant" && localVariants.length > prev.variants) {
        const last = localVariants[localVariants.length - 1];
        if (last) nameRefs.current.get(`variant:${last.id}`)?.focus();
        setFocusNext(null);
      } else if (
        focusNext.kind === "option" &&
        localOptions.length > prev.options
      ) {
        const last = localOptions[localOptions.length - 1];
        if (last) nameRefs.current.get(`option:${last.id}`)?.focus();
        setFocusNext(null);
      } else if (focusNext.kind === "value") {
        const option = localOptions.find((o) => o.id === focusNext.optionId);
        if (
          option &&
          option.values.length > (prev.values[option.id] ?? 0)
        ) {
          const last = option.values[option.values.length - 1];
          if (last) nameRefs.current.get(`value:${last.id}`)?.focus();
          setFocusNext(null);
        }
      }
    }
    prevCounts.current = {
      variants: localVariants.length,
      options: localOptions.length,
      values: Object.fromEntries(
        localOptions.map((o) => [o.id, o.values.length]),
      ),
    };
  }, [focusNext, localVariants, localOptions]);

  useEffect(() => {
    const timers = reorderTimers.current;
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  const register = (key: string) => (el: HTMLInputElement | null) => {
    if (el) nameRefs.current.set(key, el);
    else nameRefs.current.delete(key);
  };

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  };

  const flashSaved = (id: string) => {
    setSavedId(id);
    setSavedKey((k) => k + 1);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedId(null), SAVED_FLASH_MS);
  };

  const commit = (opts: {
    optimistic?: () => void;
    rollback?: () => void;
    action: () => Promise<CustomizationActionResult>;
    savedId?: string;
  }) => {
    opts.optimistic?.();
    startTransition(async () => {
      const result = await opts.action();
      if (result.status === "error") {
        opts.rollback?.();
        showToast(errorText(result));
        router.refresh();
        return;
      }
      if (opts.savedId) flashSaved(opts.savedId);
      router.refresh();
    });
  };

  const scheduleReorder = (
    key: string,
    action: () => Promise<CustomizationActionResult>,
  ) => {
    const timers = reorderTimers.current;
    const existing = timers.get(key);
    if (existing) clearTimeout(existing);
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        startTransition(async () => {
          const result = await action();
          if (result.status === "error") showToast(errorText(result));
          router.refresh();
        });
      }, REORDER_DEBOUNCE_MS),
    );
  };

  // ----- variant handlers -------------------------------------------------

  const commitVariantName = (
    variant: ProductCustomizationVariant,
    raw: string,
  ): boolean => {
    const name = raw.trim();
    if (name.length === 0) {
      showToast("Le nom de la taille est requis.");
      return false;
    }
    const snapshot = localVariants;
    commit({
      optimistic: () =>
        setLocalVariants((vs) =>
          vs.map((v) => (v.id === variant.id ? { ...v, name } : v)),
        ),
      rollback: () => setLocalVariants(snapshot),
      action: () => updateVariant(variant.id, { name }),
      savedId: variant.id,
    });
    return true;
  };

  const commitVariantPrice = (
    variant: ProductCustomizationVariant,
    raw: string,
  ): boolean => {
    const trimmed = raw.trim();
    const price = trimmed === "" ? null : Number(trimmed);
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      showToast("Prix invalide.");
      return false;
    }
    const snapshot = localVariants;
    commit({
      optimistic: () =>
        setLocalVariants((vs) =>
          vs.map((v) =>
            v.id === variant.id
              ? { ...v, priceOverride: price === null ? null : price.toFixed(2) }
              : v,
          ),
        ),
      rollback: () => setLocalVariants(snapshot),
      action: () => updateVariant(variant.id, { price_override: price }),
      savedId: variant.id,
    });
    return true;
  };

  const handleSetDefault = (variant: ProductCustomizationVariant) => {
    if (variant.isDefault || !variant.available || !productId) return;
    const snapshot = localVariants;
    commit({
      optimistic: () =>
        setLocalVariants((vs) =>
          vs.map((v) => ({ ...v, isDefault: v.id === variant.id })),
        ),
      rollback: () => setLocalVariants(snapshot),
      action: () => setDefaultVariant(productId, variant.id),
      savedId: variant.id,
    });
  };

  const handleVariantAvailability = (
    variant: ProductCustomizationVariant,
    available: boolean,
  ) => {
    const snapshot = localVariants;
    commit({
      optimistic: () =>
        setLocalVariants((vs) =>
          vs.map((v) => (v.id === variant.id ? { ...v, available } : v)),
        ),
      rollback: () => setLocalVariants(snapshot),
      action: () => setVariantAvailability(variant.id, available),
      savedId: variant.id,
    });
  };

  const handleMoveVariant = (index: number, direction: -1 | 1) => {
    if (!productId) return;
    const next = reorder(localVariants, index, direction);
    if (!next) return;
    setLocalVariants(next);
    scheduleReorder("variants", () =>
      reorderVariants(
        productId,
        next.map((v) => v.id),
      ),
    );
  };

  const handleAddVariant = () => {
    if (!productId) return;
    startTransition(async () => {
      const result = await createVariant(productId, { name: "Nouvelle taille" });
      if (result.status === "error") {
        showToast(errorText(result));
        return;
      }
      setFocusNext({ kind: "variant" });
      setOpen(true);
      router.refresh();
    });
  };

  // ----- option handlers --------------------------------------------------

  const commitOptionName = (
    option: ProductCustomizationOption,
    raw: string,
  ): boolean => {
    const name = raw.trim();
    if (name.length === 0) {
      showToast("Le nom de l'option est requis.");
      return false;
    }
    const snapshot = localOptions;
    commit({
      optimistic: () =>
        setLocalOptions((os) =>
          os.map((o) => (o.id === option.id ? { ...o, name } : o)),
        ),
      rollback: () => setLocalOptions(snapshot),
      action: () => updateOption(option.id, { name }),
      savedId: option.id,
    });
    return true;
  };

  const clearMinMaxErrors = (optionId: string) =>
    setMinMaxErrors((prev) => {
      const next = { ...prev };
      delete next[`${optionId}:min`];
      delete next[`${optionId}:max`];
      return next;
    });

  const toggleOptionType = (option: ProductCustomizationOption) => {
    const nextType =
      option.type === "single_select" ? "multi_select" : "single_select";
    const snapshot = localOptions;
    clearMinMaxErrors(option.id);
    commit({
      optimistic: () =>
        setLocalOptions((os) =>
          os.map((o) =>
            o.id === option.id
              ? {
                  ...o,
                  type: nextType,
                  ...(nextType === "single_select"
                    ? { minSelect: 0, maxSelections: null }
                    : {}),
                }
              : o,
          ),
        ),
      rollback: () => setLocalOptions(snapshot),
      action: () => updateOption(option.id, { type: nextType }),
      savedId: option.id,
    });
  };

  const handleOptionRequired = (
    option: ProductCustomizationOption,
    required: boolean,
  ) => {
    const snapshot = localOptions;
    commit({
      optimistic: () =>
        setLocalOptions((os) =>
          os.map((o) => (o.id === option.id ? { ...o, required } : o)),
        ),
      rollback: () => setLocalOptions(snapshot),
      action: () => updateOption(option.id, { required }),
      savedId: option.id,
    });
  };

  const commitOptionMin = (
    option: ProductCustomizationOption,
    raw: string,
  ) => {
    const trimmed = raw.trim();
    const min = trimmed === "" ? 0 : Number(trimmed);
    const validation = validateOptionMinMax(min, option.maxSelections);
    if (!validation.valid) {
      setMinMaxErrors((prev) => ({
        ...prev,
        [`${option.id}:min`]: validation.message,
      }));
      return;
    }
    clearMinMaxErrors(option.id);
    const snapshot = localOptions;
    commit({
      optimistic: () =>
        setLocalOptions((os) =>
          os.map((o) => (o.id === option.id ? { ...o, minSelect: min } : o)),
        ),
      rollback: () => setLocalOptions(snapshot),
      action: () => updateOption(option.id, { min_select: min }),
      savedId: option.id,
    });
  };

  const commitOptionMax = (
    option: ProductCustomizationOption,
    raw: string,
  ) => {
    const trimmed = raw.trim();
    const max = trimmed === "" ? null : Number(trimmed);
    const validation = validateOptionMinMax(option.minSelect, max);
    if (!validation.valid) {
      setMinMaxErrors((prev) => ({
        ...prev,
        [`${option.id}:max`]: validation.message,
      }));
      return;
    }
    clearMinMaxErrors(option.id);
    const snapshot = localOptions;
    commit({
      optimistic: () =>
        setLocalOptions((os) =>
          os.map((o) =>
            o.id === option.id ? { ...o, maxSelections: max } : o,
          ),
        ),
      rollback: () => setLocalOptions(snapshot),
      action: () => updateOption(option.id, { max_select: max }),
      savedId: option.id,
    });
  };

  const handleMoveOption = (index: number, direction: -1 | 1) => {
    if (!productId) return;
    const next = reorder(localOptions, index, direction);
    if (!next) return;
    setLocalOptions(next);
    scheduleReorder("options", () =>
      reorderOptions(
        productId,
        next.map((o) => o.id),
      ),
    );
  };

  const handleAddOption = () => {
    if (!productId) return;
    startTransition(async () => {
      const result = await createOption(productId, {
        name: "Nouvelle option",
        type: "single_select",
        required: false,
      });
      if (result.status === "error") {
        showToast(errorText(result));
        return;
      }
      setFocusNext({ kind: "option" });
      setOpen(true);
      router.refresh();
    });
  };

  // ----- value handlers ---------------------------------------------------

  const updateLocalValue = (
    optionId: string,
    valueId: string,
    patch: Partial<ProductCustomizationOptionValue>,
  ) =>
    setLocalOptions((os) =>
      os.map((o) =>
        o.id === optionId
          ? {
              ...o,
              values: o.values.map((v) =>
                v.id === valueId ? { ...v, ...patch } : v,
              ),
            }
          : o,
      ),
    );

  const commitValueName = (
    optionId: string,
    value: ProductCustomizationOptionValue,
    raw: string,
  ): boolean => {
    const name = raw.trim();
    if (name.length === 0) {
      showToast("Le nom de la valeur est requis.");
      return false;
    }
    const snapshot = localOptions;
    commit({
      optimistic: () => updateLocalValue(optionId, value.id, { name }),
      rollback: () => setLocalOptions(snapshot),
      action: () => updateOptionValue(value.id, { name }),
      savedId: value.id,
    });
    return true;
  };

  const commitValuePrice = (
    optionId: string,
    value: ProductCustomizationOptionValue,
    raw: string,
  ): boolean => {
    const trimmed = raw.trim();
    const price = trimmed === "" ? 0 : Number(trimmed);
    if (!Number.isFinite(price)) {
      showToast("Prix invalide.");
      return false;
    }
    const snapshot = localOptions;
    commit({
      optimistic: () =>
        updateLocalValue(optionId, value.id, {
          priceAddition: price.toFixed(2),
        }),
      rollback: () => setLocalOptions(snapshot),
      action: () => updateOptionValue(value.id, { price_addition: price }),
      savedId: value.id,
    });
    return true;
  };

  const handleValueAvailability = (
    optionId: string,
    value: ProductCustomizationOptionValue,
    available: boolean,
  ) => {
    const snapshot = localOptions;
    commit({
      optimistic: () => updateLocalValue(optionId, value.id, { available }),
      rollback: () => setLocalOptions(snapshot),
      action: () => setOptionValueAvailability(value.id, available),
      savedId: value.id,
    });
  };

  const handleMoveValue = (
    option: ProductCustomizationOption,
    index: number,
    direction: -1 | 1,
  ) => {
    const nextValues = reorder(option.values, index, direction);
    if (!nextValues) return;
    setLocalOptions((os) =>
      os.map((o) =>
        o.id === option.id ? { ...o, values: nextValues } : o,
      ),
    );
    scheduleReorder(`values:${option.id}`, () =>
      reorderOptionValues(
        option.id,
        nextValues.map((v) => v.id),
      ),
    );
  };

  const handleAddValue = (option: ProductCustomizationOption) => {
    startTransition(async () => {
      const result = await createOptionValue(option.id, {
        name: "Nouvelle valeur",
        price_addition: 0,
      });
      if (result.status === "error") {
        showToast(errorText(result));
        return;
      }
      setFocusNext({ kind: "value", optionId: option.id });
      router.refresh();
    });
  };

  // ----- delete -----------------------------------------------------------

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    startTransition(async () => {
      const result =
        target.kind === "variant"
          ? await deleteVariant(target.id)
          : target.kind === "option"
            ? await deleteOption(target.id)
            : await deleteOptionValue(target.id);
      if (result.status === "error") {
        // Includes the "used in past orders" fallback: the row was disabled
        // instead of deleted. refresh() reflects the new availability state.
        showToast(result.message);
      }
      router.refresh();
    });
  };

  // ----- render -----------------------------------------------------------

  if (!productId) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="font-mono font-bold text-sm uppercase tracking-widest text-ink/40">
          Choix à la commande
        </h2>
        <div className="border-2 border-ink p-4">
          <p className="font-sans text-sm text-ink/60 leading-snug">
            Enregistrez d&apos;abord l&apos;article pour configurer les tailles
            et les options.
          </p>
        </div>
      </div>
    );
  }

  const isEmpty = localVariants.length === 0 && localOptions.length === 0;

  return (
    <div className="border-y border-outline -mx-6 px-6">
      <div className="flex items-center justify-between gap-3 py-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex-1 flex items-center justify-between gap-2 group focus:outline-none"
        >
          <span className="flex flex-col gap-1 text-left">
            <span className="font-mono text-sm font-bold uppercase tracking-widest text-ink/80 group-hover:text-ink transition-colors">
              Choix à la commande
            </span>
            <span className="font-sans text-xs text-ink/50">
              Tailles, options, suppléments…
            </span>
          </span>
          {open ? (
            <Minus
              className="w-6 h-6 text-ink/40 group-hover:text-accent transition-colors shrink-0"
              strokeWidth={2}
              strokeLinecap="square"
            />
          ) : (
            <Plus
              className="w-6 h-6 text-ink/40 group-hover:text-accent transition-colors shrink-0"
              strokeWidth={2}
              strokeLinecap="square"
            />
          )}
        </button>
      </div>

      {open ? (
        <div className="pb-5 flex flex-col gap-6">
          {businessSlug ? (
            <a
              href={`/${businessSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Voir l'article sur la boutique en ligne (nouvel onglet)"
              className="self-start font-mono text-[11px] uppercase tracking-widest text-accent hover:text-ink transition-colors"
            >
              Voir comme un client →
            </a>
          ) : null}

          {isEmpty ? (
            <div className="border-2 border-ink p-5 flex flex-col gap-4">
              <p className="font-sans text-sm text-ink/60 leading-snug">
                Cet article n&apos;a pas de choix à faire. Ajoutez une taille ou
                une option pour permettre la personnalisation.
              </p>
              <div className="flex flex-col gap-2">
                <AddButton
                  label="+ Ajouter une taille"
                  onClick={handleAddVariant}
                  disabled={isPending}
                />
                <AddButton
                  label="+ Ajouter une option"
                  onClick={handleAddOption}
                  disabled={isPending}
                />
              </div>
            </div>
          ) : (
            <>
              <section className="flex flex-col gap-3">
                <SubHeader>Tailles ou formats</SubHeader>
                {localVariants.length === 0 ? (
                  <EmptyLine text="Aucune taille définie." />
                ) : (
                  localVariants.map((variant, index) => (
                    <VariantCard
                      key={variant.id}
                      variant={variant}
                      index={index}
                      first={index === 0}
                      last={index === localVariants.length - 1}
                      pending={isPending}
                      saved={savedId === variant.id}
                      savedKey={savedKey}
                      registerName={register(`variant:${variant.id}`)}
                      onCommitName={(raw) => commitVariantName(variant, raw)}
                      onCommitPrice={(raw) => commitVariantPrice(variant, raw)}
                      onSetDefault={() => handleSetDefault(variant)}
                      onAvailability={(a) =>
                        handleVariantAvailability(variant, a)
                      }
                      onMove={(d) => handleMoveVariant(index, d)}
                      onDelete={() =>
                        setDeleteTarget({
                          kind: "variant",
                          id: variant.id,
                          name: variant.name,
                        })
                      }
                    />
                  ))
                )}
                <AddButton
                  label="+ Ajouter une taille"
                  onClick={handleAddVariant}
                  disabled={isPending}
                />
              </section>

              <section className="flex flex-col gap-3">
                <SubHeader>Options à choisir</SubHeader>
                {localOptions.length === 0 ? (
                  <EmptyLine text="Aucune option définie." />
                ) : (
                  localOptions.map((option, index) => (
                    <OptionCard
                      key={option.id}
                      option={option}
                      first={index === 0}
                      last={index === localOptions.length - 1}
                      pending={isPending}
                      savedId={savedId}
                      savedKey={savedKey}
                      minError={minMaxErrors[`${option.id}:min`]}
                      maxError={minMaxErrors[`${option.id}:max`]}
                      registerName={register(`option:${option.id}`)}
                      registerValueName={(valueId) =>
                        register(`value:${valueId}`)
                      }
                      onCommitName={(raw) => commitOptionName(option, raw)}
                      onToggleType={() => toggleOptionType(option)}
                      onRequired={(r) => handleOptionRequired(option, r)}
                      onCommitMin={(raw) => commitOptionMin(option, raw)}
                      onCommitMax={(raw) => commitOptionMax(option, raw)}
                      onMove={(d) => handleMoveOption(index, d)}
                      onDelete={() =>
                        setDeleteTarget({
                          kind: "option",
                          id: option.id,
                          name: option.name,
                        })
                      }
                      onAddValue={() => handleAddValue(option)}
                      onCommitValueName={(value, raw) =>
                        commitValueName(option.id, value, raw)
                      }
                      onCommitValuePrice={(value, raw) =>
                        commitValuePrice(option.id, value, raw)
                      }
                      onValueAvailability={(value, a) =>
                        handleValueAvailability(option.id, value, a)
                      }
                      onMoveValue={(vi, d) => handleMoveValue(option, vi, d)}
                      onDeleteValue={(value) =>
                        setDeleteTarget({
                          kind: "value",
                          id: value.id,
                          name: value.name,
                        })
                      }
                    />
                  ))
                )}
                <AddButton
                  label="+ Ajouter une option"
                  onClick={handleAddOption}
                  disabled={isPending}
                />
              </section>
            </>
          )}
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-6">
          <div className="bg-base border-2 border-ink w-full max-w-[320px] p-5 flex flex-col gap-5">
            <p className="font-sans text-sm text-ink leading-snug">
              {deleteTarget.kind === "variant"
                ? `Supprimer la taille « ${deleteTarget.name} » ?`
                : deleteTarget.kind === "option"
                  ? `Supprimer l'option « ${deleteTarget.name} » ?`
                  : `Supprimer la valeur « ${deleteTarget.name} » ?`}
            </p>
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
                Supprimer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 border-2 border-accent bg-base px-5 py-3 max-w-[420px] w-[calc(100%-32px)]"
        >
          <p className="font-sans text-sm text-ink leading-snug">{toast}</p>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function VariantCard({
  variant,
  first,
  last,
  pending,
  saved,
  savedKey,
  registerName,
  onCommitName,
  onCommitPrice,
  onSetDefault,
  onAvailability,
  onMove,
  onDelete,
}: {
  variant: ProductCustomizationVariant;
  index: number;
  first: boolean;
  last: boolean;
  pending: boolean;
  saved: boolean;
  savedKey: number;
  registerName: (el: HTMLInputElement | null) => void;
  onCommitName: (raw: string) => boolean;
  onCommitPrice: (raw: string) => boolean;
  onSetDefault: () => void;
  onAvailability: (available: boolean) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "border-2 border-ink",
        !variant.available && "opacity-55",
      )}
    >
      <div className="flex items-stretch">
        <div className="flex-1 min-w-0 p-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <InlineText
              ariaLabel="Nom de la taille"
              value={variant.name}
              placeholder="Nom"
              inputRef={registerName}
              className={cn(
                "flex-1 min-w-0 font-bold",
                !variant.available && "line-through",
              )}
              onCommit={onCommitName}
            />
            {saved ? <SavedFlash key={savedKey} /> : null}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <InlineText
                ariaLabel="Prix de la taille"
                numeric
                value={
                  variant.priceOverride
                    ? Number(variant.priceOverride).toString()
                    : ""
                }
                placeholder="Prix de base"
                className="w-28 font-mono"
                onCommit={onCommitPrice}
              />
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink/50">
                MAD
              </span>
            </div>
            {!variant.available ? <Pill>Indisponible</Pill> : null}
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              role="radio"
              aria-checked={variant.isDefault}
              aria-label="Définir comme taille par défaut"
              disabled={pending || !variant.available}
              onClick={onSetDefault}
              className="flex items-center gap-2 focus:outline-none disabled:opacity-40 group"
            >
              <span
                className={cn(
                  "w-4 h-4 border-2 border-ink flex items-center justify-center shrink-0",
                  variant.isDefault ? "bg-base" : "bg-base",
                )}
              >
                {variant.isDefault ? (
                  <span className="w-2 h-2 bg-ink" />
                ) : null}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink group-hover:text-accent transition-colors">
                Par défaut
              </span>
            </button>
            <InlineToggle
              label="Disponible"
              checked={variant.available}
              disabled={pending}
              onChange={onAvailability}
            />
          </div>

          <button
            type="button"
            onClick={onDelete}
            className="self-start font-mono text-[10px] uppercase tracking-widest text-ink/50 hover:text-accent transition-colors focus:outline-none"
          >
            Supprimer
          </button>
        </div>

        <ReorderColumn
          first={first}
          last={last}
          pending={pending}
          onMove={onMove}
        />
      </div>
    </div>
  );
}

function OptionCard({
  option,
  first,
  last,
  pending,
  savedId,
  savedKey,
  minError,
  maxError,
  registerName,
  registerValueName,
  onCommitName,
  onToggleType,
  onRequired,
  onCommitMin,
  onCommitMax,
  onMove,
  onDelete,
  onAddValue,
  onCommitValueName,
  onCommitValuePrice,
  onValueAvailability,
  onMoveValue,
  onDeleteValue,
}: {
  option: ProductCustomizationOption;
  first: boolean;
  last: boolean;
  pending: boolean;
  savedId: string | null;
  savedKey: number;
  minError?: string;
  maxError?: string;
  registerName: (el: HTMLInputElement | null) => void;
  registerValueName: (valueId: string) => (el: HTMLInputElement | null) => void;
  onCommitName: (raw: string) => boolean;
  onToggleType: () => void;
  onRequired: (required: boolean) => void;
  onCommitMin: (raw: string) => void;
  onCommitMax: (raw: string) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
  onAddValue: () => void;
  onCommitValueName: (
    value: ProductCustomizationOptionValue,
    raw: string,
  ) => boolean;
  onCommitValuePrice: (
    value: ProductCustomizationOptionValue,
    raw: string,
  ) => boolean;
  onValueAvailability: (
    value: ProductCustomizationOptionValue,
    available: boolean,
  ) => void;
  onMoveValue: (index: number, direction: -1 | 1) => void;
  onDeleteValue: (value: ProductCustomizationOptionValue) => void;
}) {
  const incomplete = optionConfigIncomplete(option);
  const showMinMax = multiSelectControlsVisible(option.type);

  return (
    <div
      className={cn("border-2 border-ink", !option.available && "opacity-55")}
    >
      <div className="flex items-stretch">
        <div className="flex-1 min-w-0 p-3 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <InlineText
              ariaLabel="Nom de l'option"
              value={option.name}
              placeholder="Nom"
              inputRef={registerName}
              className={cn(
                "flex-1 min-w-0 font-bold",
                !option.available && "line-through",
              )}
              onCommit={onCommitName}
            />
            {savedId === option.id ? <SavedFlash key={savedKey} /> : null}
            <button
              type="button"
              onClick={onToggleType}
              disabled={pending}
              aria-label="Changer le type de choix"
              className="shrink-0 border-2 border-ink px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-ink bg-base hover:bg-ink hover:text-base transition-colors disabled:opacity-50 focus:outline-none"
            >
              {option.type === "single_select"
                ? "Choix unique"
                : "Choix multiples"}
            </button>
          </div>

          {!option.available ? <Pill>Indisponible</Pill> : null}

          <InlineToggle
            label="Obligatoire"
            checked={option.required}
            disabled={pending}
            onChange={onRequired}
          />

          {showMinMax ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink">
                    Min
                  </span>
                  <InlineText
                    ariaLabel="Nombre minimum de choix"
                    numeric
                    value={String(option.minSelect)}
                    className="w-16 font-mono"
                    onCommit={(raw) => {
                      onCommitMin(raw);
                    }}
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink">
                    Max
                  </span>
                  <InlineText
                    ariaLabel="Nombre maximum de choix"
                    numeric
                    value={
                      option.maxSelections != null
                        ? String(option.maxSelections)
                        : ""
                    }
                    placeholder="Illimité"
                    className="w-16 font-mono"
                    onCommit={(raw) => {
                      onCommitMax(raw);
                    }}
                  />
                </label>
              </div>
              {minError || maxError ? (
                <p className="font-sans text-sm text-accent leading-snug">
                  {minError ?? maxError}
                </p>
              ) : null}
            </div>
          ) : null}

          {incomplete ? (
            <p className="font-sans text-sm text-accent leading-snug border border-accent px-3 py-2">
              Configuration incomplète : ajoutez au moins une valeur.
            </p>
          ) : null}

          <div className="pl-6 flex flex-col gap-2">
            {option.values.length === 0 ? (
              <p className="font-sans text-sm text-ink/50 leading-snug">
                Aucune valeur. Ajoutez au moins une valeur pour cette option.
              </p>
            ) : (
              option.values.map((value, index) => (
                <ValueRow
                  key={value.id}
                  value={value}
                  first={index === 0}
                  last={index === option.values.length - 1}
                  pending={pending}
                  saved={savedId === value.id}
                  savedKey={savedKey}
                  registerName={registerValueName(value.id)}
                  onCommitName={(raw) => onCommitValueName(value, raw)}
                  onCommitPrice={(raw) => onCommitValuePrice(value, raw)}
                  onAvailability={(a) => onValueAvailability(value, a)}
                  onMove={(d) => onMoveValue(index, d)}
                  onDelete={() => onDeleteValue(value)}
                />
              ))
            )}
            <AddButton
              label="+ Ajouter une valeur"
              onClick={onAddValue}
              disabled={pending}
              small
            />
          </div>

          <button
            type="button"
            onClick={onDelete}
            className="self-start font-mono text-[10px] uppercase tracking-widest text-ink/50 hover:text-accent transition-colors focus:outline-none"
          >
            Supprimer
          </button>
        </div>

        <ReorderColumn
          first={first}
          last={last}
          pending={pending}
          onMove={onMove}
        />
      </div>
    </div>
  );
}

function InlineToggle({
  label,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-widest text-ink">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "w-12 h-6 border-2 border-ink p-[2px] flex items-center transition-all focus:outline-none focus:ring-2 focus:ring-accent/30",
          checked ? "bg-ink justify-end" : "bg-base justify-start",
          disabled && "opacity-60 cursor-not-allowed",
        )}
      >
        <div className="w-4 h-4 bg-base border border-ink" />
      </button>
    </div>
  );
}

function AddButton({
  label,
  onClick,
  disabled = false,
  small = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full border-2 border-ink bg-base text-ink font-mono font-bold uppercase tracking-widest hover:bg-ink hover:text-base transition-colors disabled:opacity-50 disabled:hover:bg-base disabled:hover:text-ink flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-accent/20",
        small ? "min-h-[44px] text-[10px]" : "min-h-[56px] text-[11px]",
      )}
    >
      {label}
    </button>
  );
}

function SubHeader({ children }: { children: ReactNode }) {
  return (
    <h3 className="font-mono text-[11px] font-bold uppercase tracking-widest text-ink/40">
      {children}
    </h3>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="font-sans text-sm text-ink/50 leading-snug">{text}</p>;
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="self-start border border-ink px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-ink">
      {children}
    </span>
  );
}

