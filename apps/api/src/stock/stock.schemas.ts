import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const decimalQuantitySchema = z
  .string()
  .regex(/^-?\d+(?:\.\d{1,4})?$/, "Expected a signed decimal string");

const positiveQuantitySchema = z
  .string()
  .regex(/^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,4})?$/, "Expected a positive decimal string");

export const stockMovementTypeSchema = z.enum([
  "sale_deduction",
  "adjustment",
  "receipt",
  "transfer_in",
  "transfer_out",
  "count_correction",
  "batch_production",
  "batch_consumption",
]);

export const stockLevelSchema = z
  .object({
    businessId: z.uuid(),
    branchId: z.uuid(),
    ingredientId: z.uuid(),
    ingredientName: z.string().nullable(),
    stockUom: z.string().nullable(),
    currentQty: decimalQuantitySchema,
    updatedAt: z.string(),
  })
  .meta({ id: "StockLevel" });

export const stockMovementSchema = z
  .object({
    id: z.uuid(),
    businessId: z.uuid(),
    branchId: z.uuid(),
    ingredientId: z.uuid(),
    quantityDelta: decimalQuantitySchema,
    movementType: stockMovementTypeSchema,
    reason: z.string().nullable(),
    referenceType: z.string().nullable(),
    referenceId: z.string().nullable(),
    createdAt: z.string(),
    createdBy: z.uuid().nullable(),
  })
  .meta({ id: "StockMovement" });

export const stockLevelsResponseSchema = z.object({
  levels: z.array(stockLevelSchema),
});

export const stockMovementsResponseSchema = z.object({
  movements: z.array(stockMovementSchema),
});

export const stockAdjustmentResponseSchema = z.object({
  movement: stockMovementSchema,
  level: stockLevelSchema,
});

export const createStockAdjustmentSchema = z.object({
  ingredientId: z.uuid(),
  quantityDelta: decimalQuantitySchema.refine((value) => value !== "0" && value !== "0.0000", {
    message: "Adjustment quantity cannot be zero",
  }),
  reason: z.string().min(1),
});

export const stockDeductionLineSchema = z.object({
  variantId: z.uuid(),
  quantity: positiveQuantitySchema,
  selectedOptionValueIds: z.array(z.uuid()).optional(),
});

export class StockLevelsResponseDto extends createZodDto(stockLevelsResponseSchema) {}
export class StockMovementsResponseDto extends createZodDto(stockMovementsResponseSchema) {}
export class StockAdjustmentResponseDto extends createZodDto(
  stockAdjustmentResponseSchema,
) {}
export class CreateStockAdjustmentDto extends createZodDto(
  createStockAdjustmentSchema,
) {}

export type CreateStockAdjustmentInput = z.infer<typeof createStockAdjustmentSchema>;
export type StockDeductionLineInput = z.infer<typeof stockDeductionLineSchema>;
