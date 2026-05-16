import {
  serializeOrderItemOptions,
  type OrderItemOptions,
  type OrderItemOptionType,
} from "./order-item-options";

export type OrderPlacementErrorCode =
  | "PRODUCT_UNAVAILABLE"
  | "VARIANT_INVALID"
  | "OPTION_REQUIRED_MISSING"
  | "OPTION_MIN_NOT_MET"
  | "OPTION_MAX_EXCEEDED"
  | "OPTION_SINGLE_INVALID"
  | "OPTION_VALUE_INVALID"
  | "PRICE_RESOLVED_NEGATIVE";

export type DbProductForOrder = {
  id: string;
  name: string;
  price: string;
  available: boolean;
  variants: Array<{
    id: string;
    productId: string;
    name: string;
    priceOverride: string | null;
    isDefault: boolean;
    available: boolean;
  }>;
  options: Array<{
    id: string;
    productId: string;
    name: string;
    type: OrderItemOptionType;
    required: boolean;
    minSelect: number;
    maxSelect: number | null;
    available: boolean;
    values: Array<{
      id: string;
      optionId: string;
      name: string;
      priceAddition: string;
      available: boolean;
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
  optionsJson: OrderItemOptions | null;
};

export type ConfiguredLineValidationResult =
  | {
      status: "success";
      line: ValidatedOrderLine;
    }
  | {
      status: "error";
      code: OrderPlacementErrorCode;
      message: string;
      statusCode: 422;
    };

export function validateConfiguredLine(
  item: IncomingOrderLine,
  product: DbProductForOrder,
): ConfiguredLineValidationResult {
  if (!product.available) {
    return validationError(
      "PRODUCT_UNAVAILABLE",
      "Un ou plusieurs articles sont indisponibles",
    );
  }

  const variantResult = resolveVariant(item, product);
  if (variantResult.status === "error") return variantResult;
  const variant = variantResult.variant;
  const snapshotVariant = variantResult.snapshotVariant;

  const selectedIds = new Set(item.selected_option_value_ids);
  if (selectedIds.size !== item.selected_option_value_ids.length) {
    return validationError("OPTION_VALUE_INVALID", "Choix invalides");
  }

  const allowedValueIds = new Set<string>();
  const unavailableValueIds = new Set<string>();
  const selections: OrderItemOptions["selections"] = [];
  let additions = 0;

  for (const option of product.options ?? []) {
    for (const value of option.values) {
      allowedValueIds.add(value.id);
      if (!value.available || !option.available) {
        unavailableValueIds.add(value.id);
      }
    }

    const selectedValues = option.values.filter((value) =>
      selectedIds.has(value.id),
    );

    if (selectedValues.some((value) => unavailableValueIds.has(value.id))) {
      return validationError(
        "OPTION_VALUE_INVALID",
        `${option.name} n'est plus disponible pour ${product.name}.`,
      );
    }

    if (!option.available) {
      continue;
    }

    if (option.type === "single_select") {
      const singleValidation = validateSingleSelect(
        option,
        selectedValues.length,
        product.name,
      );
      if (singleValidation) return singleValidation;
    } else {
      const multiValidation = validateMultiSelect(
        option,
        selectedValues.length,
        product.name,
      );
      if (multiValidation) return multiValidation;
    }

    if (selectedValues.length > 0) {
      const values = selectedValues.map((value) => {
        const priceAddition = Number(value.priceAddition);
        additions += priceAddition;
        return {
          valueId: value.id,
          valueName: value.name,
          priceAddition,
        };
      });
      selections.push({
        optionId: option.id,
        optionName: option.name,
        optionType: option.type,
        values,
      });
    }
  }

  for (const selectedId of selectedIds) {
    if (!allowedValueIds.has(selectedId)) {
      return validationError("OPTION_VALUE_INVALID", "Choix invalides");
    }
  }

  const unitPrice = roundMoney(
    Number(variant?.priceOverride ?? product.price) + additions,
  );
  if (unitPrice < 0) {
    return validationError(
      "PRICE_RESOLVED_NEGATIVE",
      "Le prix de cet article est invalide.",
    );
  }

  const subtotal = roundMoney(unitPrice * item.quantity);
  const hasConfiguration = snapshotVariant || selections.length > 0;

  return {
    status: "success",
    line: {
      productId: product.id,
      quantity: item.quantity,
      unitPrice,
      subtotal,
      optionsJson: hasConfiguration
        ? serializeOrderItemOptions({
            variantId: snapshotVariant ? variant?.id ?? null : null,
            variantName: snapshotVariant ? variant?.name ?? null : null,
            variantPriceOverride:
              !snapshotVariant || variant?.priceOverride == null
                ? null
                : Number(variant.priceOverride),
            selections,
          })
        : null,
    },
  };
}

function resolveVariant(
  item: IncomingOrderLine,
  product: DbProductForOrder,
):
  | {
      status: "success";
      variant: DbProductForOrder["variants"][number] | null;
      snapshotVariant: boolean;
    }
  | Extract<ConfiguredLineValidationResult, { status: "error" }> {
  const variants = product.variants ?? [];
  if (variants.length === 0) {
    if (item.variant_id !== null) {
      return validationError("VARIANT_INVALID", "Variante invalide");
    }
    return { status: "success", variant: null, snapshotVariant: false };
  }

  if (item.variant_id) {
    const variant = variants.find((v) => v.id === item.variant_id);
    if (!variant || variant.productId !== product.id || !variant.available) {
      return validationError("VARIANT_INVALID", "Variante invalide");
    }
    return { status: "success", variant, snapshotVariant: true };
  }

  if (variants.length > 1) {
    return validationError(
      "VARIANT_INVALID",
      `Veuillez choisir une variante pour ${product.name}.`,
    );
  }

  const defaultVariant =
    variants.find((variant) => variant.isDefault && variant.available) ??
    (variants.length === 1 && variants[0]?.available ? variants[0] : null);
  if (!defaultVariant) {
    return validationError(
      "VARIANT_INVALID",
      `Veuillez choisir une variante pour ${product.name}.`,
    );
  }
  return {
    status: "success",
    variant: defaultVariant,
    snapshotVariant: variants.length > 1,
  };
}

function validateSingleSelect(
  option: DbProductForOrder["options"][number],
  selectedCount: number,
  productName: string,
): Extract<ConfiguredLineValidationResult, { status: "error" }> | null {
  if (selectedCount > 1) {
    return validationError(
      "OPTION_SINGLE_INVALID",
      `Veuillez choisir une seule valeur pour ${option.name}.`,
    );
  }
  if (option.required && selectedCount !== 1) {
    return validationError(
      "OPTION_REQUIRED_MISSING",
      requiredMessage(option.name, productName),
    );
  }
  return null;
}

function validateMultiSelect(
  option: DbProductForOrder["options"][number],
  selectedCount: number,
  productName: string,
): Extract<ConfiguredLineValidationResult, { status: "error" }> | null {
  const minSelect = option.required ? Math.max(1, option.minSelect) : option.minSelect;
  if (selectedCount < minSelect) {
    return validationError(
      minSelect > 1 ? "OPTION_MIN_NOT_MET" : "OPTION_REQUIRED_MISSING",
      requiredMessage(option.name, productName),
    );
  }
  if (option.maxSelect !== null && selectedCount > option.maxSelect) {
    return validationError(
      "OPTION_MAX_EXCEEDED",
      `Vous pouvez choisir au maximum ${option.maxSelect} option(s) pour ${option.name}.`,
    );
  }
  return null;
}

function requiredMessage(optionName: string, productName: string): string {
  return `Veuillez choisir ${optionName.toLocaleLowerCase("fr-FR")} pour ${productName}.`;
}

function validationError(
  code: OrderPlacementErrorCode,
  message: string,
): Extract<ConfiguredLineValidationResult, { status: "error" }> {
  return { status: "error", code, message, statusCode: 422 };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
