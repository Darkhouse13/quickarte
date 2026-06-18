import { z } from "zod";
import { optionMaxSelectionsOverridesSchema } from "./variant-option-overrides";

export const createProductSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis"),
  description: z
    .string()
    .trim()
    .transform((v) => (v.length === 0 ? undefined : v))
    .optional(),
  price: z.coerce
    .number({ invalid_type_error: "Prix invalide" })
    .positive("Le prix doit etre positif"),
  categoryId: z.string().uuid("Categorie invalide"),
  available: z
    .union([z.boolean(), z.literal("true"), z.literal("false"), z.literal("on")])
    .transform((v) => v === true || v === "true" || v === "on")
    .default(true),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Le nom est requis")
    .max(60, "Nom trop long"),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

const priceValueSchema = z.coerce
  .number({ invalid_type_error: "Prix invalide" })
  .nonnegative("Le prix doit etre positif ou nul")
  .finite("Prix invalide");

const priceDeltaSchema = z.coerce
  .number({ invalid_type_error: "Prix invalide" })
  .finite("Prix invalide");

const optionalPositionSchema = z.coerce
  .number({ invalid_type_error: "Position invalide" })
  .int("Position invalide")
  .nonnegative("Position invalide")
  .optional();

export const variantInputSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(60, "Nom trop long"),
  price_override: priceValueSchema.nullish(),
  is_default: z.boolean().optional(),
  available: z.boolean().optional(),
  option_max_selections_overrides: optionMaxSelectionsOverridesSchema.optional(),
  position: optionalPositionSchema,
});

export const updateVariantInputSchema = variantInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "Aucune modification",
);

const optionalSelectionLimitSchema = z.coerce
  .number({ invalid_type_error: "Maximum invalide" })
  .int("Maximum invalide")
  .positive("Maximum invalide")
  .nullish();

const optionBaseSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(60, "Nom trop long"),
  type: z.enum(["single_select", "multi_select"]),
  required: z.boolean(),
  min_select: z.coerce
    .number({ invalid_type_error: "Minimum invalide" })
    .int("Minimum invalide")
    .nonnegative("Minimum invalide")
    .optional(),
  max_select: optionalSelectionLimitSchema,
  // Legacy UI field retained as an alias while the DB/API move to max_select.
  max_selections: optionalSelectionLimitSchema,
  position: optionalPositionSchema,
});

export const optionInputSchema = optionBaseSchema.superRefine(
  validateOptionSelectionRules,
);

export const updateOptionInputSchema = optionBaseSchema
  .partial()
  .superRefine(validateOptionSelectionRules)
  .refine((value) => Object.keys(value).length > 0, "Aucune modification");

function validateOptionSelectionRules(
  value: Partial<z.infer<typeof optionBaseSchema>>,
  ctx: z.RefinementCtx,
) {
  const minSelect = value.min_select ?? 0;
  const maxSelect = value.max_select ?? value.max_selections ?? null;

  if (value.type === "single_select") {
    if (value.min_select != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["min_select"],
        message: "Minimum reserve aux choix multiples",
      });
    }
    if (maxSelect != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: value.max_select != null ? ["max_select"] : ["max_selections"],
        message: "Maximum reserve aux choix multiples",
      });
    }
  }

  if (value.type === "multi_select") {
    if (maxSelect != null && maxSelect < minSelect) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["max_select"],
        message: "Le maximum doit etre superieur au minimum",
      });
    }
    if (minSelect > 0 && value.required === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["required"],
        message: "Une option avec minimum doit etre obligatoire",
      });
    }
  }
}

export const optionValueInputSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(60, "Nom trop long"),
  price_addition: priceDeltaSchema,
  allow_quantity: z.boolean().optional(),
  max_quantity: z.coerce
    .number({ invalid_type_error: "Quantité max invalide" })
    .int("Quantité max invalide")
    .positive("Quantité max invalide")
    .nullish(),
  available: z.boolean().optional(),
  position: optionalPositionSchema,
});

export const updateOptionValueInputSchema = optionValueInputSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Aucune modification");

export const reorderIdsSchema = z.array(z.string().uuid("Identifiant invalide"));

export type VariantInput = z.infer<typeof variantInputSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantInputSchema>;
export type OptionInput = z.infer<typeof optionInputSchema>;
export type UpdateOptionInput = z.infer<typeof updateOptionInputSchema>;
export type OptionValueInput = z.infer<typeof optionValueInputSchema>;
export type UpdateOptionValueInput = z.infer<
  typeof updateOptionValueInputSchema
>;
