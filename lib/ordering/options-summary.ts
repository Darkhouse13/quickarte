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

type RawOptionsJson = {
  variant_name?: unknown;
  selected_options_summary?: unknown;
};

export function parseOrderItemOptions(
  optionsJson: unknown,
): OrderItemOptionsSummary {
  if (!optionsJson || typeof optionsJson !== "object") {
    return { variantName: null, options: [] };
  }

  const raw = optionsJson as RawOptionsJson;
  const variantName =
    typeof raw.variant_name === "string" && raw.variant_name.trim().length > 0
      ? raw.variant_name
      : null;

  if (!Array.isArray(raw.selected_options_summary)) {
    return { variantName, options: [] };
  }

  const options = raw.selected_options_summary.flatMap((option) => {
    if (!option || typeof option !== "object") return [];
    const optionRecord = option as {
      option_name?: unknown;
      values?: unknown;
    };
    if (
      typeof optionRecord.option_name !== "string" ||
      !Array.isArray(optionRecord.values)
    ) {
      return [];
    }

    const values = optionRecord.values.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const valueRecord = value as {
        value_name?: unknown;
        price_addition?: unknown;
      };
      if (typeof valueRecord.value_name !== "string") return [];
      return [
        {
          valueName: valueRecord.value_name,
          priceAddition: Number(valueRecord.price_addition ?? 0),
        },
      ];
    });

    if (values.length === 0) return [];
    return [{ optionName: optionRecord.option_name, values }];
  });

  return { variantName, options };
}
