import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis"),
  description: z
    .string()
    .trim()
    .transform((v) => (v.length === 0 ? undefined : v))
    .optional(),
  price: z.coerce
    .number({ invalid_type_error: "Prix invalide" })
    .positive("Le prix doit être positif"),
  categoryId: z.string().uuid("Catégorie invalide"),
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
  .nonnegative("Le prix doit être positif ou nul")
  .finite("Prix invalide");

const optionalPositionSchema = z.coerce
  .number({ invalid_type_error: "Position invalide" })
  .int("Position invalide")
  .nonnegative("Position invalide")
  .optional();

export const variantInputSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(60, "Nom trop long"),
  price_override: priceValueSchema.nullish(),
  position: optionalPositionSchema,
});

export const updateVariantInputSchema = variantInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "Aucune modification",
);

const optionBaseSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(60, "Nom trop long"),
  type: z.enum(["single_select", "multi_select"]),
  required: z.boolean(),
  max_selections: z.coerce
    .number({ invalid_type_error: "Maximum invalide" })
    .int("Maximum invalide")
    .positive("Maximum invalide")
    .nullish(),
  position: optionalPositionSchema,
});

export const optionInputSchema = optionBaseSchema.superRefine((value, ctx) => {
    if (value.type === "single_select" && value.max_selections != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["max_selections"],
        message: "Maximum réservé aux choix multiples",
      });
    }
  });

export const updateOptionInputSchema = optionBaseSchema
  .partial()
  .superRefine((value, ctx) => {
    if (value.type === "single_select" && value.max_selections != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["max_selections"],
        message: "Maximum réservé aux choix multiples",
      });
    }
  })
  .refine((value) => Object.keys(value).length > 0, "Aucune modification");

export const optionValueInputSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(60, "Nom trop long"),
  price_addition: priceValueSchema,
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
