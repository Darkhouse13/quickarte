export type OrderItemOptionType = "single_select" | "multi_select";

/**
 * Canonical snapshot stored in order_items.options_json.
 *
 * Names and prices are copied from the catalog at order placement time. Reads
 * must render this JSON directly and must not join back to product_options,
 * option_values, or product_variants, because catalog labels/prices can change
 * after an order is placed.
 */
export type OrderItemOptions = {
  variantId: string | null;
  variantName: string | null;
  variantPriceOverride: number | null;
  selections: Array<{
    optionId: string;
    optionName: string;
    optionType: OrderItemOptionType;
    values: Array<{
      valueId: string;
      valueName: string;
      priceAddition: number;
    }>;
  }>;
};

export type OrderItemOptionsSummary = {
  variantName: string | null;
  options: Array<{
    optionName: string;
    values: Array<{
      valueName: string;
      priceAddition: number;
    }>;
  }>;
};

export function serializeOrderItemOptions(
  input: OrderItemOptions,
): OrderItemOptions {
  return {
    variantId: input.variantId ?? null,
    variantName: normalizeNullableString(input.variantName),
    variantPriceOverride: normalizeNullableNumber(input.variantPriceOverride),
    selections: input.selections.flatMap((selection) => {
      const optionName = normalizeString(selection.optionName);
      const optionId = normalizeString(selection.optionId);
      if (!optionId || !optionName) return [];
      const values = selection.values.flatMap((value) => {
        const valueId = normalizeString(value.valueId);
        const valueName = normalizeString(value.valueName);
        if (!valueId || !valueName) return [];
        return [
          {
            valueId,
            valueName,
            priceAddition: normalizeNumber(value.priceAddition),
          },
        ];
      });
      if (values.length === 0) return [];
      return [
        {
          optionId,
          optionName,
          optionType: selection.optionType,
          values,
        },
      ];
    }),
  };
}

export function summarizeOrderItemOptions(stored: unknown): string[] {
  const parsed = normalizeOrderItemOptions(stored);
  if (!parsed) return [];

  const lines: string[] = [];
  if (parsed.variantName) {
    lines.push(`  Variante : ${parsed.variantName}`);
  }
  for (const selection of parsed.selections) {
    const values = selection.values.map((value) => value.valueName).join(", ");
    if (values) lines.push(`  ${selection.optionName} : ${values}`);
  }
  return lines;
}

export function parseOrderItemOptions(
  stored: unknown,
): OrderItemOptionsSummary {
  const parsed = normalizeOrderItemOptions(stored);
  if (!parsed) return { variantName: null, options: [] };
  return {
    variantName: parsed.variantName,
    options: parsed.selections.map((selection) => ({
      optionName: selection.optionName,
      values: selection.values.map((value) => ({
        valueName: value.valueName,
        priceAddition: value.priceAddition,
      })),
    })),
  };
}

export function normalizeOrderItemOptions(
  stored: unknown,
): OrderItemOptions | null {
  if (!stored || typeof stored !== "object") return null;
  const raw = stored as Record<string, unknown>;

  if (Array.isArray(raw.selections) || "variantId" in raw) {
    const canonical = normalizeCanonical(raw);
    return hasConfiguration(canonical) ? canonical : null;
  }

  const legacy = normalizeLegacy(raw);
  return hasConfiguration(legacy) ? legacy : null;
}

function normalizeCanonical(raw: Record<string, unknown>): OrderItemOptions {
  return serializeOrderItemOptions({
    variantId: normalizeNullableString(raw.variantId),
    variantName: normalizeNullableString(raw.variantName),
    variantPriceOverride: normalizeNullableNumber(raw.variantPriceOverride),
    selections: Array.isArray(raw.selections)
      ? raw.selections.flatMap((selection) => {
          if (!selection || typeof selection !== "object") return [];
          const selectionRecord = selection as Record<string, unknown>;
          const optionType = normalizeOptionType(selectionRecord.optionType);
          if (!optionType) return [];
          return [
            {
              optionId: normalizeString(selectionRecord.optionId),
              optionName: normalizeString(selectionRecord.optionName),
              optionType,
              values: Array.isArray(selectionRecord.values)
                ? selectionRecord.values.flatMap((value) => {
                    if (!value || typeof value !== "object") return [];
                    const valueRecord = value as Record<string, unknown>;
                    return [
                      {
                        valueId: normalizeString(valueRecord.valueId),
                        valueName: normalizeString(valueRecord.valueName),
                        priceAddition: normalizeNumber(
                          valueRecord.priceAddition,
                        ),
                      },
                    ];
                  })
                : [],
            },
          ];
        })
      : [],
  });
}

function normalizeLegacy(raw: Record<string, unknown>): OrderItemOptions {
  return serializeOrderItemOptions({
    variantId: normalizeNullableString(raw.variant_id),
    variantName: normalizeNullableString(raw.variant_name),
    variantPriceOverride: null,
    selections: Array.isArray(raw.selected_options_summary)
      ? raw.selected_options_summary.flatMap((selection) => {
          if (!selection || typeof selection !== "object") return [];
          const selectionRecord = selection as Record<string, unknown>;
          const optionType = normalizeOptionType(selectionRecord.option_type);
          if (!optionType) return [];
          return [
            {
              optionId: normalizeString(selectionRecord.option_id),
              optionName: normalizeString(selectionRecord.option_name),
              optionType,
              values: Array.isArray(selectionRecord.values)
                ? selectionRecord.values.flatMap((value) => {
                    if (!value || typeof value !== "object") return [];
                    const valueRecord = value as Record<string, unknown>;
                    return [
                      {
                        valueId: normalizeString(valueRecord.value_id),
                        valueName: normalizeString(valueRecord.value_name),
                        priceAddition: normalizeNumber(
                          valueRecord.price_addition,
                        ),
                      },
                    ];
                  })
                : [],
            },
          ];
        })
      : [],
  });
}

function hasConfiguration(options: OrderItemOptions): boolean {
  return Boolean(options.variantName || options.variantId || options.selections.length);
}

function normalizeOptionType(value: unknown): OrderItemOptionType | null {
  return value === "single_select" || value === "multi_select" ? value : null;
}

function normalizeNullableString(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const normalized = normalizeNumber(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function normalizeNumber(value: unknown): number {
  const normalized = Number(value ?? 0);
  return Number.isFinite(normalized) ? normalized : 0;
}
