type OptionValueLike = { id: string };

type OptionLike = {
  id: string;
  required: boolean;
  type: "single_select" | "multi_select";
  values: readonly OptionValueLike[];
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
): boolean {
  return options.every((option) => {
    if (!option.required) return true;
    if (!optionHasValues(option)) return false;

    const validSelections = (selected[option.id] ?? []).filter((id) =>
      option.values.some((value) => value.id === id),
    );

    if (option.type === "single_select") return validSelections.length === 1;
    return validSelections.length >= 1;
  });
}
