type OptionValueLike = { id: string };

type OptionLike = {
  id: string;
  required: boolean;
  type: "single_select" | "multi_select";
  maxSelections?: number | null;
  values: readonly OptionValueLike[];
};

export type VariantOptionMaxSelectionsOverrides = Record<string, number>;

export type VariantWithOptionMaxOverrides = {
  optionMaxSelectionsOverrides?: VariantOptionMaxSelectionsOverrides | null;
};

export function optionHasValues(option: { values: readonly unknown[] }): boolean {
  return option.values.length > 0;
}

export function getDisplayableOptions<T extends { values: readonly unknown[] }>(
  options: readonly T[],
): T[] {
  return options.filter(optionHasValues);
}

export function areRequiredOptionsSatisfied(
  options: readonly OptionLike[],
  selected: Record<string, readonly string[]>,
  variant?: VariantWithOptionMaxOverrides | null,
): boolean {
  return options.every((option) => {
    if (!optionHasValues(option)) return !option.required;

    const validSelections = (selected[option.id] ?? []).filter((id) =>
      option.values.some((value) => value.id === id),
    );

    if (option.type === "single_select") {
      if (validSelections.length > 1) return false;
      return option.required ? validSelections.length === 1 : true;
    }
    if (validSelections.length > getEffectiveMaxSelections(option, variant)) {
      return false;
    }
    if (!option.required) return true;
    return validSelections.length >= 1;
  });
}

export function getEffectiveMaxSelections(
  option: { id: string; maxSelections?: number | null },
  variant?: VariantWithOptionMaxOverrides | null,
): number {
  return (
    variant?.optionMaxSelectionsOverrides?.[option.id] ??
    option.maxSelections ??
    Infinity
  );
}

export function trimSelectionsToEffectiveMax(
  selectedIds: readonly string[],
  option: { id: string; maxSelections?: number | null },
  variant?: VariantWithOptionMaxOverrides | null,
): string[] {
  const effectiveMax = getEffectiveMaxSelections(option, variant);
  if (!Number.isFinite(effectiveMax)) return [...selectedIds];
  return selectedIds.slice(0, effectiveMax);
}
