import { z } from "zod";
import type { VariantOptionMaxSelectionsOverrides } from "./option-guards";

export const optionMaxSelectionsOverridesSchema = z
  .record(
    z.string().uuid("Option invalide"),
    z.coerce
      .number({ invalid_type_error: "Maximum invalide" })
      .int("Maximum invalide")
      .positive("Maximum invalide"),
  )
  .default({});

export type OverrideValidationOption = {
  id: string;
  productId: string;
  type: "single_select" | "multi_select";
};

export function validateVariantOptionMaxSelectionsOverrides(
  overrides: VariantOptionMaxSelectionsOverrides,
  options: readonly OverrideValidationOption[],
  productId: string,
): { status: "success"; overrides: VariantOptionMaxSelectionsOverrides } | {
  status: "error";
  message: string;
  fieldErrors?: Record<string, string[]>;
} {
  const parsed = optionMaxSelectionsOverridesSchema.safeParse(overrides);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Validation invalide",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const optionById = new Map(options.map((option) => [option.id, option]));
  for (const optionId of Object.keys(parsed.data)) {
    const option = optionById.get(optionId);
    if (!option || option.productId !== productId) {
      return {
        status: "error",
        message: "Option invalide",
        fieldErrors: {
          option_max_selections_overrides: ["Option invalide"],
        },
      };
    }
    if (option.type !== "multi_select") {
      return {
        status: "error",
        message: "Maximum réservé aux choix multiples",
        fieldErrors: {
          option_max_selections_overrides: [
            "Maximum réservé aux choix multiples",
          ],
        },
      };
    }
  }

  return { status: "success", overrides: parsed.data };
}
