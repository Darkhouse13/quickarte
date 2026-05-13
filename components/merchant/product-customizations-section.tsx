"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from "lucide-react";
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
  updateOption,
  updateOptionValue,
  updateVariant,
  type CustomizationActionResult,
} from "@/lib/catalog/customizations";
import { optionHasValues } from "@/lib/catalog/option-guards";
import { cn } from "@/lib/utils/cn";

export type ProductCustomizationVariant = {
  id: string;
  name: string;
  priceOverride: string | null;
  position: number;
  optionMaxSelectionsOverrides: Record<string, number>;
};

export type ProductCustomizationOptionValue = {
  id: string;
  name: string;
  priceAddition: string;
  position: number;
};

export type ProductCustomizationOption = {
  id: string;
  name: string;
  type: "single_select" | "multi_select";
  required: boolean;
  maxSelections: number | null;
  position: number;
  values: ProductCustomizationOptionValue[];
};

type Props = {
  productId?: string;
  variants: ProductCustomizationVariant[];
  options: ProductCustomizationOption[];
};

type VariantFormState = {
  name: string;
  priceOverride: string;
  optionMaxSelectionsOverrides: Record<string, string>;
};
type OptionFormState = {
  name: string;
  type: "single_select" | "multi_select";
  required: boolean;
  maxSelections: string;
};
type ValueFormState = { name: string; priceAddition: string };

const emptyVariant: VariantFormState = {
  name: "",
  priceOverride: "",
  optionMaxSelectionsOverrides: {},
};
const emptyOption: OptionFormState = {
  name: "",
  type: "single_select",
  required: false,
  maxSelections: "",
};
const emptyValue: ValueFormState = { name: "", priceAddition: "0" };

export function ProductCustomizationsSection({
  productId,
  variants,
  options,
}: Props) {
  const router = useRouter();
  const [localVariants, setLocalVariants] = useState(variants);
  const [localOptions, setLocalOptions] = useState(options);
  const [addingVariant, setAddingVariant] = useState(false);
  const [addingOption, setAddingOption] = useState(false);
  const [variantDraft, setVariantDraft] = useState(emptyVariant);
  const [optionDraft, setOptionDraft] = useState(emptyOption);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editingValueId, setEditingValueId] = useState<string | null>(null);
  const [addingValueFor, setAddingValueFor] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [valueDraft, setValueDraft] = useState(emptyValue);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => setLocalVariants(variants), [variants]);
  useEffect(() => setLocalOptions(options), [options]);

  const run = (fn: () => Promise<CustomizationActionResult>) => {
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      if (result.status === "error") {
        setMessage(result.message);
        return;
      }
      setAddingVariant(false);
      setAddingOption(false);
      setEditingVariantId(null);
      setEditingOptionId(null);
      setEditingValueId(null);
      setAddingValueFor(null);
      setDeleteTarget(null);
      setVariantDraft(emptyVariant);
      setOptionDraft(emptyOption);
      setValueDraft(emptyValue);
      router.refresh();
    });
  };

  if (!productId) {
    return (
      <div className="border border-outline p-4">
        <p className="font-sans text-sm text-ink/60 leading-snug">
          Enregistrez d'abord l'article pour ajouter des variantes et options.
        </p>
      </div>
    );
  }

  const saveNewVariant = () =>
    run(() =>
      createVariant(productId, {
        name: variantDraft.name,
        price_override:
          variantDraft.priceOverride.trim() === ""
            ? null
            : Number(variantDraft.priceOverride),
        option_max_selections_overrides:
          buildOptionMaxSelectionsOverrides(variantDraft),
      }),
    );

  const saveNewOption = () =>
    run(() =>
      createOption(productId, {
        name: optionDraft.name,
        type: optionDraft.type,
        required: optionDraft.required,
        max_selections:
          optionDraft.type === "multi_select" && optionDraft.maxSelections
            ? Number(optionDraft.maxSelections)
            : null,
      }),
    );

  const moveVariant = (index: number, direction: -1 | 1) => {
    const next = move(localVariants, index, direction);
    if (!next) return;
    setLocalVariants(next);
    run(() => reorderVariants(productId, next.map((v) => v.id)));
  };

  const moveOption = (index: number, direction: -1 | 1) => {
    const next = move(localOptions, index, direction);
    if (!next) return;
    setLocalOptions(next);
    run(() => reorderOptions(productId, next.map((o) => o.id)));
  };

  const moveValue = (
    option: ProductCustomizationOption,
    index: number,
    direction: -1 | 1,
  ) => {
    const nextValues = move(option.values, index, direction);
    if (!nextValues) return;
    setLocalOptions((prev) =>
      prev.map((o) => (o.id === option.id ? { ...o, values: nextValues } : o)),
    );
    run(() => reorderOptionValues(option.id, nextValues.map((v) => v.id)));
  };

  return (
    <div className="flex flex-col gap-6 border border-outline p-4">
      {message ? (
        <p className="font-mono text-[11px] uppercase tracking-widest text-accent border border-accent px-3 py-2">
          {message}
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <SectionTitle title="Variantes" />
        {localVariants.length === 0 ? <EmptyLine text="Aucune variante" /> : null}
        {localVariants.map((variant, index) => (
          <VariantRow
            key={variant.id}
            variant={variant}
            options={localOptions}
            editing={editingVariantId === variant.id}
            pending={isPending}
            first={index === 0}
            last={index === localVariants.length - 1}
            deleteTarget={deleteTarget}
            onEdit={() => setEditingVariantId(variant.id)}
            onCancel={() => setEditingVariantId(null)}
            onMove={(direction) => moveVariant(index, direction)}
            onSave={(draft) =>
              run(() =>
                updateVariant(variant.id, {
                  name: draft.name,
                  price_override:
                    draft.priceOverride.trim() === ""
                      ? null
                      : Number(draft.priceOverride),
                  option_max_selections_overrides:
                    buildOptionMaxSelectionsOverrides(draft),
                }),
              )
            }
            onDelete={() => run(() => deleteVariant(variant.id))}
            onDeleteTarget={setDeleteTarget}
          />
        ))}

        {addingVariant ? (
          <VariantForm
            value={variantDraft}
            options={localOptions}
            pending={isPending}
            onChange={setVariantDraft}
            onCancel={() => {
              setAddingVariant(false);
              setVariantDraft(emptyVariant);
            }}
            onSubmit={saveNewVariant}
          />
        ) : (
          <AddButton
            label="+ Ajouter une variante"
            onClick={() => setAddingVariant(true)}
          />
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-outline pt-5">
        <SectionTitle title="Options" />
        {localOptions.length === 0 ? <EmptyLine text="Aucune option" /> : null}
        {localOptions.map((option, index) => (
          <OptionBlock
            key={option.id}
            option={option}
            editing={editingOptionId === option.id}
            editingValueId={editingValueId}
            addingValue={addingValueFor === option.id}
            pending={isPending}
            first={index === 0}
            last={index === localOptions.length - 1}
            deleteTarget={deleteTarget}
            valueDraft={valueDraft}
            onValueDraftChange={setValueDraft}
            onEdit={() => setEditingOptionId(option.id)}
            onCancelEdit={() => setEditingOptionId(null)}
            onMove={(direction) => moveOption(index, direction)}
            onMoveValue={(valueIndex, direction) =>
              moveValue(option, valueIndex, direction)
            }
            onSave={(draft) =>
              run(() =>
                updateOption(option.id, {
                  name: draft.name,
                  type: draft.type,
                  required: draft.required,
                  max_selections:
                    draft.type === "multi_select" && draft.maxSelections
                      ? Number(draft.maxSelections)
                      : null,
                }),
              )
            }
            onDelete={() => run(() => deleteOption(option.id))}
            onDeleteTarget={setDeleteTarget}
            onAddValue={() => {
              setAddingValueFor(option.id);
              setValueDraft(emptyValue);
            }}
            onCancelValue={() => {
              setAddingValueFor(null);
              setEditingValueId(null);
              setValueDraft(emptyValue);
            }}
            onCreateValue={() =>
              run(() =>
                createOptionValue(option.id, {
                  name: valueDraft.name,
                  price_addition: Number(valueDraft.priceAddition || 0),
                }),
              )
            }
            onEditValue={(value) => {
              setEditingValueId(value.id);
              setValueDraft({
                name: value.name,
                priceAddition: Number(value.priceAddition).toString(),
              });
            }}
            onUpdateValue={(valueId) =>
              run(() =>
                updateOptionValue(valueId, {
                  name: valueDraft.name,
                  price_addition: Number(valueDraft.priceAddition || 0),
                }),
              )
            }
            onDeleteValue={(valueId) =>
              run(() => deleteOptionValue(valueId))
            }
          />
        ))}

        {addingOption ? (
          <OptionForm
            value={optionDraft}
            pending={isPending}
            onChange={setOptionDraft}
            onCancel={() => {
              setAddingOption(false);
              setOptionDraft(emptyOption);
            }}
            onSubmit={saveNewOption}
          />
        ) : (
          <AddButton
            label="+ Ajouter une option"
            onClick={() => setAddingOption(true)}
          />
        )}
      </section>
    </div>
  );
}

function VariantRow({
  variant,
  options,
  editing,
  pending,
  first,
  last,
  deleteTarget,
  onEdit,
  onCancel,
  onMove,
  onSave,
  onDelete,
  onDeleteTarget,
}: {
  variant: ProductCustomizationVariant;
  options: ProductCustomizationOption[];
  editing: boolean;
  pending: boolean;
  first: boolean;
  last: boolean;
  deleteTarget: string | null;
  onEdit: () => void;
  onCancel: () => void;
  onMove: (direction: -1 | 1) => void;
  onSave: (draft: VariantFormState) => void;
  onDelete: () => void;
  onDeleteTarget: (id: string | null) => void;
}) {
  const [draft, setDraft] = useState<VariantFormState>({
    name: variant.name,
    priceOverride: variant.priceOverride
      ? Number(variant.priceOverride).toString()
      : "",
    optionMaxSelectionsOverrides: stringifyOptionMaxSelectionsOverrides(
      variant.optionMaxSelectionsOverrides,
    ),
  });

  useEffect(() => {
    setDraft({
      name: variant.name,
      priceOverride: variant.priceOverride
        ? Number(variant.priceOverride).toString()
        : "",
      optionMaxSelectionsOverrides: stringifyOptionMaxSelectionsOverrides(
        variant.optionMaxSelectionsOverrides,
      ),
    });
  }, [variant]);

  if (editing) {
    return (
      <VariantForm
        value={draft}
        options={options}
        pending={pending}
        onChange={setDraft}
        onCancel={onCancel}
        onSubmit={() => onSave(draft)}
      />
    );
  }

  return (
    <RowShell>
      <div className="min-w-0">
        <p className="font-sans text-sm font-bold text-ink truncate">
          {variant.name}
        </p>
        <p className="font-mono text-[11px] text-ink/50">
          {variant.priceOverride
            ? `${Number(variant.priceOverride).toFixed(2)} MAD`
            : "Prix de base"}
        </p>
      </div>
      <RowActions
        first={first}
        last={last}
        pending={pending}
        deleteOpen={deleteTarget === variant.id}
        onMove={onMove}
        onEdit={onEdit}
        onDelete={() => onDeleteTarget(variant.id)}
        onCancelDelete={() => onDeleteTarget(null)}
        onConfirmDelete={onDelete}
      />
    </RowShell>
  );
}

function OptionBlock({
  option,
  editing,
  editingValueId,
  addingValue,
  pending,
  first,
  last,
  deleteTarget,
  valueDraft,
  onValueDraftChange,
  onEdit,
  onCancelEdit,
  onMove,
  onMoveValue,
  onSave,
  onDelete,
  onDeleteTarget,
  onAddValue,
  onCancelValue,
  onCreateValue,
  onEditValue,
  onUpdateValue,
  onDeleteValue,
}: {
  option: ProductCustomizationOption;
  editing: boolean;
  editingValueId: string | null;
  addingValue: boolean;
  pending: boolean;
  first: boolean;
  last: boolean;
  deleteTarget: string | null;
  valueDraft: ValueFormState;
  onValueDraftChange: (value: ValueFormState) => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onMove: (direction: -1 | 1) => void;
  onMoveValue: (index: number, direction: -1 | 1) => void;
  onSave: (draft: OptionFormState) => void;
  onDelete: () => void;
  onDeleteTarget: (id: string | null) => void;
  onAddValue: () => void;
  onCancelValue: () => void;
  onCreateValue: () => void;
  onEditValue: (value: ProductCustomizationOptionValue) => void;
  onUpdateValue: (valueId: string) => void;
  onDeleteValue: (valueId: string) => void;
}) {
  const [draft, setDraft] = useState<OptionFormState>({
    name: option.name,
    type: option.type,
    required: option.required,
    maxSelections: option.maxSelections?.toString() ?? "",
  });

  useEffect(() => {
    setDraft({
      name: option.name,
      type: option.type,
      required: option.required,
      maxSelections: option.maxSelections?.toString() ?? "",
    });
  }, [option]);

  return (
    <div className="border border-outline">
      {editing ? (
        <div className="p-3">
          <OptionForm
            value={draft}
            pending={pending}
            onChange={setDraft}
            onCancel={onCancelEdit}
            onSubmit={() => onSave(draft)}
            saveDisabled={!optionHasValues(option)}
            saveHint="Ajoutez au moins une valeur."
          />
        </div>
      ) : (
        <RowShell>
          <div className="min-w-0">
            <p className="font-sans text-sm font-bold text-ink truncate">
              {option.name}
            </p>
            <p className="font-mono text-[11px] text-ink/50">
              {option.type === "single_select" ? "Choix unique" : "Choix multiple"}
              {option.required ? " · requis" : " · optionnel"}
              {option.maxSelections ? ` · max ${option.maxSelections}` : ""}
            </p>
          </div>
          <RowActions
            first={first}
            last={last}
            pending={pending}
            deleteOpen={deleteTarget === option.id}
            onMove={onMove}
            onEdit={onEdit}
            onDelete={() => onDeleteTarget(option.id)}
            onCancelDelete={() => onDeleteTarget(null)}
            onConfirmDelete={onDelete}
          />
        </RowShell>
      )}

      <div className="border-t border-outline p-3 flex flex-col gap-2">
        {option.values.length === 0 ? <EmptyLine text="Aucune valeur" /> : null}
        {option.values.map((value, index) =>
          editingValueId === value.id ? (
            <ValueForm
              key={value.id}
              value={valueDraft}
              pending={pending}
              onChange={onValueDraftChange}
              onCancel={onCancelValue}
              onSubmit={() => onUpdateValue(value.id)}
            />
          ) : (
            <RowShell key={value.id} compact>
              <div className="min-w-0">
                <p className="font-sans text-sm font-bold text-ink truncate">
                  {value.name}
                </p>
                <p className="font-mono text-[11px] text-ink/50">
                  +{Number(value.priceAddition).toFixed(2)} MAD
                </p>
              </div>
              <RowActions
                first={index === 0}
                last={index === option.values.length - 1}
                pending={pending}
                deleteOpen={deleteTarget === value.id}
                onMove={(direction) => onMoveValue(index, direction)}
                onEdit={() => onEditValue(value)}
                onDelete={() => onDeleteTarget(value.id)}
                onCancelDelete={() => onDeleteTarget(null)}
                onConfirmDelete={() => onDeleteValue(value.id)}
              />
            </RowShell>
          ),
        )}

        {addingValue ? (
          <ValueForm
            value={valueDraft}
            pending={pending}
            onChange={onValueDraftChange}
            onCancel={onCancelValue}
            onSubmit={onCreateValue}
          />
        ) : (
          <AddButton label="+ Ajouter une valeur" onClick={onAddValue} small />
        )}
      </div>
    </div>
  );
}

function VariantForm({
  value,
  options,
  pending,
  onChange,
  onCancel,
  onSubmit,
}: {
  value: VariantFormState;
  options: ProductCustomizationOption[];
  pending: boolean;
  onChange: (value: VariantFormState) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const multiSelectOptions = options.filter(
    (option) => option.type === "multi_select",
  );

  return (
    <div className="border border-outline p-3 flex flex-col gap-3">
      <TextField
        label="Nom"
        value={value.name}
        onChange={(name) => onChange({ ...value, name })}
      />
      <TextField
        label="Prix"
        type="number"
        value={value.priceOverride}
        onChange={(priceOverride) => onChange({ ...value, priceOverride })}
      />
      {multiSelectOptions.length ? (
        <div className="border border-outline p-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink">
              Limites par option (facultatif)
            </p>
            <p className="font-sans text-sm leading-snug text-ink/60">
              Pour chaque option multi-sélection, vous pouvez plafonner le
              nombre de choix pour cette variante.
            </p>
          </div>
          {multiSelectOptions.map((option) => (
            <div key={option.id} className="flex flex-col gap-2">
              <TextField
                label={`Option «${option.name}» - max pour cette variante`}
                type="number"
                min={1}
                step={1}
                value={value.optionMaxSelectionsOverrides[option.id] ?? ""}
                onChange={(maxSelections) =>
                  onChange({
                    ...value,
                    optionMaxSelectionsOverrides: {
                      ...value.optionMaxSelectionsOverrides,
                      [option.id]: maxSelections,
                    },
                  })
                }
              />
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink/50">
                Par défaut : {option.maxSelections ?? "illimité"}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      <FormButtons pending={pending} onCancel={onCancel} onSubmit={onSubmit} />
    </div>
  );
}

function OptionForm({
  value,
  pending,
  onChange,
  onCancel,
  onSubmit,
  saveDisabled = false,
  saveHint,
}: {
  value: OptionFormState;
  pending: boolean;
  onChange: (value: OptionFormState) => void;
  onCancel: () => void;
  onSubmit: () => void;
  saveDisabled?: boolean;
  saveHint?: string;
}) {
  return (
    <div className="border border-outline p-3 flex flex-col gap-3">
      <TextField
        label="Nom"
        value={value.name}
        onChange={(name) => onChange({ ...value, name })}
      />
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink mb-2">
          Type
        </p>
        <div className="grid grid-cols-2 border border-ink">
          {(["single_select", "multi_select"] as const).map((type, index) => (
            <button
              key={type}
              type="button"
              onClick={() =>
                onChange({
                  ...value,
                  type,
                  maxSelections:
                    type === "single_select" ? "" : value.maxSelections,
                })
              }
              className={cn(
                "py-2.5 font-mono text-[10px] uppercase tracking-widest font-bold",
                index === 1 && "border-l border-ink",
                value.type === type
                  ? "bg-ink text-base"
                  : "bg-base text-ink hover:bg-black/[0.03]",
              )}
            >
              {type === "single_select" ? "Unique" : "Multiple"}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-center justify-between gap-3 border border-outline px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink">
          Requis
        </span>
        <input
          type="checkbox"
          checked={value.required}
          onChange={(e) => onChange({ ...value, required: e.target.checked })}
          className="h-5 w-5 accent-black"
        />
      </label>
      {value.type === "multi_select" ? (
        <TextField
          label="Maximum"
          type="number"
          min={1}
          value={value.maxSelections}
          onChange={(maxSelections) => onChange({ ...value, maxSelections })}
        />
      ) : null}
      <FormButtons
        pending={pending}
        submitDisabled={saveDisabled}
        submitHint={saveHint}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    </div>
  );
}

function ValueForm({
  value,
  pending,
  onChange,
  onCancel,
  onSubmit,
}: {
  value: ValueFormState;
  pending: boolean;
  onChange: (value: ValueFormState) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="border border-outline p-3 flex flex-col gap-3">
      <TextField
        label="Nom"
        value={value.name}
        onChange={(name) => onChange({ ...value, name })}
      />
      <TextField
        label="Supplément"
        type="number"
        min={0}
        value={value.priceAddition}
        onChange={(priceAddition) => onChange({ ...value, priceAddition })}
      />
      <FormButtons pending={pending} onCancel={onCancel} onSubmit={onSubmit} />
    </div>
  );
}

function RowShell({
  children,
  compact = false,
}: {
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2",
        compact ? "py-2" : "p-3",
      )}
    >
      {children}
    </div>
  );
}

function RowActions({
  first,
  last,
  pending,
  deleteOpen,
  onMove,
  onEdit,
  onDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  first: boolean;
  last: boolean;
  pending: boolean;
  deleteOpen: boolean;
  onMove: (direction: -1 | 1) => void;
  onEdit: () => void;
  onDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  if (deleteOpen) {
    return (
      <div className="flex items-center gap-1 shrink-0">
        <IconButton label="Confirmer" disabled={pending} onClick={onConfirmDelete}>
          <Trash2 className="w-4 h-4 text-accent" />
        </IconButton>
        <IconButton label="Annuler" disabled={pending} onClick={onCancelDelete}>
          <X className="w-4 h-4" />
        </IconButton>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      <IconButton
        label="Monter"
        disabled={pending || first}
        onClick={() => onMove(-1)}
      >
        <ArrowUp className="w-4 h-4" />
      </IconButton>
      <IconButton
        label="Descendre"
        disabled={pending || last}
        onClick={() => onMove(1)}
      >
        <ArrowDown className="w-4 h-4" />
      </IconButton>
      <IconButton label="Modifier" disabled={pending} onClick={onEdit}>
        <Pencil className="w-4 h-4" />
      </IconButton>
      <IconButton label="Supprimer" disabled={pending} onClick={onDelete}>
        <Trash2 className="w-4 h-4" />
      </IconButton>
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="w-8 h-8 border border-outline flex items-center justify-center text-ink hover:border-ink hover:text-accent disabled:opacity-30 disabled:hover:text-ink disabled:hover:border-outline focus:outline-none focus:ring-2 focus:ring-accent/30"
    >
      {children}
    </button>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  min,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
  min?: number;
  step?: number;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-mono text-[10px] uppercase tracking-widest text-ink">
        {label}
      </span>
      <input
        type={type}
        min={min}
        step={step ?? (type === "number" ? "0.01" : undefined)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-outline px-3 py-2.5 bg-base text-sm text-ink focus:outline-none focus:border-ink focus:bg-white"
      />
    </label>
  );
}

function FormButtons({
  pending,
  submitDisabled = false,
  submitHint,
  onCancel,
  onSubmit,
}: {
  pending: boolean;
  submitDisabled?: boolean;
  submitHint?: string;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 border border-ink">
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="py-2.5 border-r border-ink font-mono text-[10px] uppercase tracking-widest font-bold text-ink hover:bg-black/[0.03] disabled:opacity-60"
        >
          Annuler
        </button>
        <button
          type="button"
          disabled={pending || submitDisabled}
          onClick={onSubmit}
          className="py-2.5 bg-ink text-base font-mono text-[10px] uppercase tracking-widest font-bold hover:bg-accent disabled:opacity-60"
        >
          Enregistrer
        </button>
      </div>
      {submitDisabled && submitHint ? (
        <p className="font-sans text-sm text-accent">{submitHint}</p>
      ) : null}
    </div>
  );
}

function AddButton({
  label,
  onClick,
  small = false,
}: {
  label: string;
  onClick: () => void;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "self-start font-mono font-bold uppercase tracking-widest text-accent hover:text-ink transition-colors flex items-center gap-1",
        small ? "text-[10px]" : "text-xs",
      )}
    >
      <Plus className="w-3 h-3" />
      {label.replace("+ ", "")}
    </button>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h3 className="font-mono text-[11px] uppercase tracking-widest text-ink/50 font-bold">
      {title}
    </h3>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="font-sans text-sm text-ink/50">{text}</p>;
}

function move<T>(items: T[], index: number, direction: -1 | 1): T[] | null {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return null;
  const next = [...items];
  const current = next[index];
  const target = next[nextIndex];
  if (!current || !target) return null;
  next[index] = target;
  next[nextIndex] = current;
  return next;
}

function stringifyOptionMaxSelectionsOverrides(
  overrides: Record<string, number>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(overrides).map(([optionId, maxSelections]) => [
      optionId,
      String(maxSelections),
    ]),
  );
}

function buildOptionMaxSelectionsOverrides(
  draft: VariantFormState,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(draft.optionMaxSelectionsOverrides)
      .filter(([, value]) => value.trim() !== "")
      .map(([optionId, value]) => [optionId, Number(value)]),
  );
}
