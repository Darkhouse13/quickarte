/**
 * Pure helpers for the merchant product-customization editor. Kept framework-free
 * so the live-save UI logic can be unit-tested without a component harness.
 */

export type MinMaxValidation =
  | { valid: true }
  | { valid: false; message: string };

/**
 * Client-side guard for a multi-select option's min/max selection fields. The
 * server stays the source of truth — this only prevents a roundtrip for an
 * obvious typo. `null` max means unlimited.
 */
export function validateOptionMinMax(
  min: number | null,
  max: number | null,
): MinMaxValidation {
  if (min != null && (!Number.isInteger(min) || min < 0)) {
    return { valid: false, message: "Le minimum doit être positif ou nul." };
  }
  if (max != null && (!Number.isInteger(max) || max < 1)) {
    return { valid: false, message: "Le maximum doit être au moins 1." };
  }
  if (min != null && max != null && max < min) {
    return {
      valid: false,
      message: "Le maximum doit être supérieur ou égal au minimum.",
    };
  }
  return { valid: true };
}

/**
 * An option is "incomplete" — and shows a non-blocking warning — when it cannot
 * offer the customer anything to pick: a single-select with no values, or any
 * required option with no values.
 */
export function optionConfigIncomplete(option: {
  type: "single_select" | "multi_select";
  required: boolean;
  values: readonly unknown[];
}): boolean {
  if (option.values.length > 0) return false;
  return option.type === "single_select" || option.required;
}

/** Min/max selection controls only exist for multi-select options. */
export function multiSelectControlsVisible(
  type: "single_select" | "multi_select",
): boolean {
  return type === "multi_select";
}

/** Swap an item with its neighbour. Returns null when the move is out of bounds. */
export function reorder<T>(
  items: readonly T[],
  index: number,
  direction: -1 | 1,
): T[] | null {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return null;
  const next = [...items];
  const current = next[index];
  const target = next[nextIndex];
  if (current === undefined || target === undefined) return null;
  next[index] = target;
  next[nextIndex] = current;
  return next;
}
