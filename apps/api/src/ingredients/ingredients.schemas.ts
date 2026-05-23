import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const decimalMoneySchema = z
  .string()
  .regex(/^\d+(?:\.\d{1,4})?$/, "Expected a non-negative decimal string");

const positiveQuantitySchema = z
  .string()
  .regex(/^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,4})?$/, "Expected a positive decimal string");

const unitFactorSchema = z
  .string()
  .regex(/^\d+(?:\.\d{1,6})?$/, "Expected a non-negative unit factor string");

const localizedTextSchema = z.record(z.string().min(2), z.string().min(1));

export const ingredientCategorySchema = z.enum([
  "meat",
  "dairy",
  "vegetable",
  "spice",
  "dry_good",
  "beverage",
  "alcohol",
  "packaging",
]);

export const unitDimensionSchema = z.enum(["mass", "volume", "count"]);

export const unitSchema = z
  .object({
    code: z.string(),
    dimension: unitDimensionSchema,
    factorToBase: unitFactorSchema,
  })
  .meta({ id: "UnitOfMeasure" });

export const ingredientTagSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(["dietary", "allergen"]),
    code: z.string(),
    localizedLabels: localizedTextSchema,
    isSystem: z.boolean(),
  })
  .meta({ id: "IngredientTag" });

export const ingredientUnitConversionSchema = z
  .object({
    id: z.uuid(),
    altUom: z.string().min(1),
    qtyInStockUom: positiveQuantitySchema,
  })
  .meta({ id: "IngredientUnitConversion" });

export const ingredientSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    localizedNames: localizedTextSchema,
    category: ingredientCategorySchema,
    stockUom: z.string(),
    currentCostPerUom: decimalMoneySchema.nullable(),
    trackedInStock: z.boolean(),
    supplierId: z.uuid().nullable(),
    storageLocation: z.string().nullable(),
    position: z.number().int(),
    conversions: z.array(ingredientUnitConversionSchema),
    tags: z.array(ingredientTagSchema),
  })
  .meta({ id: "Ingredient" });

export const unitsResponseSchema = z.object({
  units: z.array(unitSchema),
});

export const ingredientsResponseSchema = z.object({
  ingredients: z.array(ingredientSchema),
});

export const ingredientResponseSchema = z.object({
  ingredient: ingredientSchema,
});

export const ingredientConversionsResponseSchema = z.object({
  conversions: z.array(ingredientUnitConversionSchema),
});

export const ingredientTagsResponseSchema = z.object({
  tags: z.array(ingredientTagSchema),
});

export const ingredientDeleteResponseSchema = z.object({
  deleted: z.literal(true),
});

export const createIngredientSchema = z.object({
  name: z.string().min(1),
  localizedNames: localizedTextSchema.optional(),
  category: ingredientCategorySchema.optional(),
  stockUom: z.string().min(1),
  currentCostPerUom: decimalMoneySchema.nullable().optional(),
  trackedInStock: z.boolean().optional(),
  supplierId: z.uuid().nullable().optional(),
  storageLocation: z.string().nullable().optional(),
  position: z.number().int().min(0).optional(),
});

export const updateIngredientSchema = createIngredientSchema.partial();

export const replaceIngredientConversionsSchema = z.object({
  conversions: z.array(
    z.object({
      altUom: z.string().min(1),
      qtyInStockUom: positiveQuantitySchema,
    }),
  ),
});

export const replaceIngredientTagsSchema = z.object({
  tagIds: z.array(z.uuid()),
});

export class UnitsResponseDto extends createZodDto(unitsResponseSchema) {}
export class IngredientsResponseDto extends createZodDto(ingredientsResponseSchema) {}
export class IngredientResponseDto extends createZodDto(ingredientResponseSchema) {}
export class IngredientConversionsResponseDto extends createZodDto(
  ingredientConversionsResponseSchema,
) {}
export class IngredientTagsResponseDto extends createZodDto(
  ingredientTagsResponseSchema,
) {}
export class IngredientDeleteResponseDto extends createZodDto(
  ingredientDeleteResponseSchema,
) {}
export class CreateIngredientDto extends createZodDto(createIngredientSchema) {}
export class UpdateIngredientDto extends createZodDto(updateIngredientSchema) {}
export class ReplaceIngredientConversionsDto extends createZodDto(
  replaceIngredientConversionsSchema,
) {}
export class ReplaceIngredientTagsDto extends createZodDto(
  replaceIngredientTagsSchema,
) {}

export type CreateIngredientInput = z.infer<typeof createIngredientSchema>;
export type UpdateIngredientInput = z.infer<typeof updateIngredientSchema>;
export type ReplaceIngredientConversionsInput = z.infer<
  typeof replaceIngredientConversionsSchema
>;
export type ReplaceIngredientTagsInput = z.infer<typeof replaceIngredientTagsSchema>;
