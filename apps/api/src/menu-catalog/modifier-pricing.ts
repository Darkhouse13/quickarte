type ModifierSelection = {
  valueId: string;
  priceAddition: string;
};

type ModifierGroupDeltaInput = {
  freeQuantity: number;
  extraPrice: string | null;
  selections: ModifierSelection[];
};

export function computeModifierGroupDelta(input: ModifierGroupDeltaInput): string {
  const freeQuantity = Math.max(0, input.freeQuantity);
  const extraPriceCentimes = input.extraPrice ? decimalToCentimes(input.extraPrice) : 0;
  const selectedCount = input.selections.length;
  const paidExtraCount = Math.max(0, selectedCount - freeQuantity);
  const perValueCentimes = input.selections.reduce(
    (total, selection) => total + decimalToCentimes(selection.priceAddition),
    0,
  );
  return centimesToDecimal(perValueCentimes + paidExtraCount * extraPriceCentimes);
}

function decimalToCentimes(value: string): number {
  const [wholePart, decimalPart = ""] = value.split(".");
  const normalizedDecimal = decimalPart.padEnd(2, "0").slice(0, 2);
  return (
    Number.parseInt(wholePart ?? "0", 10) * 100 +
    Number.parseInt(normalizedDecimal || "0", 10)
  );
}

function centimesToDecimal(value: number): string {
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  const whole = Math.floor(absolute / 100);
  const cents = String(absolute % 100).padStart(2, "0");
  return `${sign}${whole}.${cents}`;
}
