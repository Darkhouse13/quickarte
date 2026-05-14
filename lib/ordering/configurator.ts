import {
  serializeOrderItemOptions,
  type OrderItemOptions,
} from "./order-item-options";
import { getEffectiveMaxSelections } from "../catalog/option-guards";
import type { MenuItemOption, MenuItemVariant } from "../catalog/fixtures";

/**
 * Pure logic behind the storefront product configurator sheet. The sheet is a
 * UX surface only — `placeOrder` re-validates and re-snapshots from the DB — so
 * everything here mirrors the server contract in `lib/ordering/line-validation.ts`
 * rather than inventing its own rules.
 */

export type ConfiguratorSelection = Record<string, string[]>;

type PricedValue = { priceAddition: number };

/**
 * Running total shown in the CTA. unit = (variant override ?? base price) +
 * sum of selected value additions, then × quantity, rounded to 2 decimals.
 * Matches the server recompute exactly.
 */
export function computeConfiguratorTotal(
  variantPriceOverride: number | null,
  basePrice: number,
  selectedValues: readonly PricedValue[],
  quantity: number,
): number {
  const unit =
    (variantPriceOverride ?? basePrice) +
    selectedValues.reduce((sum, value) => sum + value.priceAddition, 0);
  return roundMoney(unit * quantity);
}

/** Minimum selections an option needs to be satisfied. Mirrors the server. */
export function effectiveMinSelections(option: MenuItemOption): number {
  if (option.type === "single_select") return option.required ? 1 : 0;
  const min = option.minSelect ?? 0;
  return option.required ? Math.max(1, min) : min;
}

/**
 * A required option with no selectable value (zero values, or every value
 * unavailable) makes the whole product unorderable — the sheet disables the
 * CTA and shows one calm body line instead of per-option hints.
 */
export function hasUnorderableRequiredOption(
  options: readonly MenuItemOption[],
): boolean {
  return options.some(
    (option) =>
      option.required &&
      option.available !== false &&
      !option.values.some((value) => value.available !== false),
  );
}

/** Whether one option group's selection count is within [min, effectiveMax]. */
export function isOptionSatisfied(
  option: MenuItemOption,
  selectedCount: number,
  variant: MenuItemVariant | null,
): boolean {
  const max = getEffectiveMaxSelections(option, variant);
  if (Number.isFinite(max) && selectedCount > max) return false;
  if (option.type === "single_select") {
    if (selectedCount > 1) return false;
    return option.required ? selectedCount === 1 : true;
  }
  return selectedCount >= effectiveMinSelections(option);
}

/**
 * The CTA is enabled iff every option is satisfied and no required option is
 * unorderable. `selected` counts are taken as-is — the sheet only ever stores
 * valid value ids.
 */
export function isConfiguratorValid(
  options: readonly MenuItemOption[],
  selected: ConfiguratorSelection,
  variant: MenuItemVariant | null,
): boolean {
  if (hasUnorderableRequiredOption(options)) return false;
  return options.every((option) =>
    isOptionSatisfied(option, (selected[option.id] ?? []).length, variant),
  );
}

/** Inline French hint under an option header, or null when the group is fine. */
export function optionValidationHint(
  option: MenuItemOption,
  selectedCount: number,
): string | null {
  const min = effectiveMinSelections(option);
  if (selectedCount >= min) return null;
  if (selectedCount === 0) return "Veuillez choisir.";
  return `Choisissez au moins ${min}.`;
}

/**
 * Whether an unchecked multi-select value should render disabled because the
 * cap is reached. Checked values are never disabled (deselect always works);
 * single-selects are never cap-disabled.
 */
export function isValueDisabledByCap(
  option: MenuItemOption,
  selectedIds: readonly string[],
  valueId: string,
  variant: MenuItemVariant | null,
): boolean {
  if (option.type !== "multi_select") return false;
  if (selectedIds.includes(valueId)) return false;
  const max = getEffectiveMaxSelections(option, variant);
  if (!Number.isFinite(max)) return false;
  return selectedIds.length >= max;
}

/**
 * Build the canonical `OrderItemOptions` snapshot from the sheet's selected
 * state. The client captures names/prices from the storefront tree; the server
 * re-snapshots from the DB and recomputes — but the payload is already canonical.
 */
export function buildOrderItemOptions(
  variant: MenuItemVariant | null,
  options: readonly MenuItemOption[],
  selected: ConfiguratorSelection,
): OrderItemOptions {
  return serializeOrderItemOptions({
    variantId: variant?.id ?? null,
    variantName: variant?.name ?? null,
    variantPriceOverride: variant?.priceOverride ?? null,
    selections: options.flatMap((option) => {
      const selectedIds = selected[option.id] ?? [];
      const values = option.values
        .filter((value) => selectedIds.includes(value.id))
        .map((value) => ({
          valueId: value.id,
          valueName: value.name,
          priceAddition: value.priceAddition,
        }));
      if (values.length === 0) return [];
      return [
        {
          optionId: option.id,
          optionName: option.name,
          optionType: option.type,
          values,
        },
      ];
    }),
  });
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
