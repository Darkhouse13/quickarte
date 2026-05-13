import {
  getEffectiveMaxSelections,
  type VariantOptionMaxSelectionsOverrides,
} from "@/lib/catalog/option-guards";

export type DbProductForOrder = {
  id: string;
  price: string;
  available: boolean;
  variants: Array<{
    id: string;
    productId: string;
    name: string;
    priceOverride: string | null;
    optionMaxSelectionsOverrides: VariantOptionMaxSelectionsOverrides;
  }>;
  options: Array<{
    id: string;
    productId: string;
    name: string;
    type: "single_select" | "multi_select";
    required: boolean;
    maxSelections: number | null;
    values: Array<{
      id: string;
      optionId: string;
      name: string;
      priceAddition: string;
    }>;
  }>;
};

export type IncomingOrderLine = {
  product_id: string;
  quantity: number;
  variant_id: string | null;
  selected_option_value_ids: string[];
  unit_price: number;
};

export type ValidatedOrderLine = {
  productId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  optionsJson: {
    variant_id: string | null;
    variant_name: string | null;
    selected_options_summary: Array<{
      option_id: string;
      option_name: string;
      option_type: "single_select" | "multi_select";
      values: Array<{
        value_id: string;
        value_name: string;
        price_addition: number;
      }>;
    }>;
  } | null;
};

export function validateConfiguredLine(
  item: IncomingOrderLine,
  product: DbProductForOrder,
):
  | {
      status: "success";
      line: ValidatedOrderLine;
    }
  | { status: "error"; message: string; statusCode?: 422 } {
  const variants = product.variants ?? [];
  if (variants.length > 0 && item.variant_id === null) {
    return { status: "error", message: "Variante requise" };
  }
  if (variants.length === 0 && item.variant_id !== null) {
    return { status: "error", message: "Variante invalide" };
  }

  const variant = item.variant_id
    ? variants.find((v) => v.id === item.variant_id)
    : null;
  if (item.variant_id && !variant) {
    return { status: "error", message: "Variante invalide" };
  }

  const selectedIds = new Set(item.selected_option_value_ids);
  if (selectedIds.size !== item.selected_option_value_ids.length) {
    return { status: "error", message: "Choix invalides" };
  }

  const selectedOptionsSummary = [];
  let additions = 0;
  for (const option of product.options ?? []) {
    const selectedValues = option.values.filter((value) =>
      selectedIds.has(value.id),
    );

    if (option.type === "single_select") {
      if (option.required && selectedValues.length !== 1) {
        return { status: "error", message: "Choix requis manquant" };
      }
      if (selectedValues.length > 1) {
        return { status: "error", message: "Choix unique invalide" };
      }
    } else {
      if (option.required && selectedValues.length < 1) {
        return { status: "error", message: "Choix requis manquant" };
      }
      const effectiveMax = getEffectiveMaxSelections(option, variant);
      if (selectedValues.length > effectiveMax) {
        return {
          status: "error",
          statusCode: 422,
          message: "Trop de choix sélectionnés",
        };
      }
    }

    if (selectedValues.length > 0) {
      const values = selectedValues.map((value) => {
        const priceAddition = Number(value.priceAddition);
        additions += priceAddition;
        return {
          value_id: value.id,
          value_name: value.name,
          price_addition: priceAddition,
        };
      });
      selectedOptionsSummary.push({
        option_id: option.id,
        option_name: option.name,
        option_type: option.type,
        values,
      });
    }
  }

  const allowedValueIds = new Set(
    (product.options ?? []).flatMap((option) =>
      option.values.map((value) => value.id),
    ),
  );
  for (const selectedId of selectedIds) {
    if (!allowedValueIds.has(selectedId)) {
      return { status: "error", message: "Choix invalides" };
    }
  }

  const unitPrice = roundMoney(
    Number(variant?.priceOverride ?? product.price) + additions,
  );
  if (unitPrice !== roundMoney(item.unit_price)) {
    return {
      status: "error",
      statusCode: 422,
      message: "Les prix ont été mis à jour. Veuillez vérifier votre commande.",
    };
  }

  const subtotal = roundMoney(unitPrice * item.quantity);
  const hasConfiguration =
    variant !== null || selectedOptionsSummary.length > 0;

  return {
    status: "success",
    line: {
      productId: product.id,
      quantity: item.quantity,
      unitPrice,
      subtotal,
      optionsJson: hasConfiguration
        ? {
            variant_id: variant?.id ?? null,
            variant_name: variant?.name ?? null,
            selected_options_summary: selectedOptionsSummary,
          }
        : null,
    },
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
