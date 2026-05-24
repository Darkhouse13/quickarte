import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const localizedTextSchema = z.record(z.string().min(2), z.string().min(1));
const decimalStringSchema = z
  .string()
  .regex(/^\d+(?:\.\d{1,4})?$/, "Expected a non-negative decimal string");
const positiveDecimalStringSchema = z
  .string()
  .regex(/^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,4})?$/, "Expected a positive decimal string");

const recipeLineSchema = z
  .object({
    id: z.uuid(),
    componentType: z.enum(["ingredient", "sub_recipe"]),
    ingredientId: z.uuid().nullable(),
    subRecipeId: z.uuid().nullable(),
    quantity: positiveDecimalStringSchema,
    uom: z.string(),
    yieldPct: positiveDecimalStringSchema.nullable(),
    quantityIsCooked: z.boolean(),
    position: z.number().int(),
  })
  .meta({ id: "RecipeLine" });

const recipeSchema = z
  .object({
    id: z.uuid(),
    variantId: z.uuid().nullable(),
    name: z.string(),
    localizedNames: localizedTextSchema,
    yieldQty: positiveDecimalStringSchema,
    yieldUom: z.string().nullable(),
    prepNotes: z.string().nullable(),
    photoUrl: z.string().nullable(),
    computedCost: decimalStringSchema,
    costIsComplete: z.boolean(),
    foodCostPct: decimalStringSchema.nullable(),
    lines: z.array(recipeLineSchema),
  })
  .meta({ id: "Recipe" });

export const recipesResponseSchema = z.object({
  recipes: z.array(recipeSchema),
});

export const recipeResponseSchema = z.object({
  recipe: recipeSchema,
});

export const recipeDeleteResponseSchema = z.object({
  deleted: z.literal(true),
});

export const createRecipeSchema = z.object({
  variantId: z.uuid().nullable().optional(),
  name: z.string().min(1),
  localizedNames: localizedTextSchema.optional(),
  yieldQty: positiveDecimalStringSchema.optional(),
  yieldUom: z.string().nullable().optional(),
  prepNotes: z.string().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
});

export const updateRecipeSchema = createRecipeSchema.partial();

export const replaceRecipeLinesSchema = z.object({
  lines: z.array(
    z.object({
      componentType: z.enum(["ingredient", "sub_recipe"]),
      ingredientId: z.uuid().nullable().optional(),
      subRecipeId: z.uuid().nullable().optional(),
      quantity: positiveDecimalStringSchema,
      uom: z.string().min(1),
      yieldPct: positiveDecimalStringSchema.nullable().optional(),
      quantityIsCooked: z.boolean().optional(),
      position: z.number().int().min(0).optional(),
    }),
  ),
});

export class RecipesResponseDto extends createZodDto(recipesResponseSchema) {}
export class RecipeResponseDto extends createZodDto(recipeResponseSchema) {}
export class RecipeDeleteResponseDto extends createZodDto(recipeDeleteResponseSchema) {}
export class CreateRecipeDto extends createZodDto(createRecipeSchema) {}
export class UpdateRecipeDto extends createZodDto(updateRecipeSchema) {}
export class ReplaceRecipeLinesDto extends createZodDto(replaceRecipeLinesSchema) {}

export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;
export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>;
export type ReplaceRecipeLinesInput = z.infer<typeof replaceRecipeLinesSchema>;
