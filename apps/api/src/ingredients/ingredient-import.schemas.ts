import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { ingredientCategorySchema } from "./ingredients.schemas";

export const ingredientImportFileTypeSchema = z.enum(["csv", "xlsx"]);
export const ingredientImportJobStatusSchema = z.enum(["pending_review", "committed", "failed"]);
export const ingredientImportActionSchema = z.enum(["create", "update", "skip"]);

export const ingredientImportIssueSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    field: z.string().nullable(),
  })
  .meta({ id: "IngredientImportIssue" });

export const ingredientImportNormalizedRowSchema = z
  .object({
    rowNumber: z.number().int().min(2),
    localizedNames: z.record(z.string().min(2), z.string().min(1)),
    category: ingredientCategorySchema,
    stockUom: z.string(),
    currentCostPerUom: z
      .string()
      .regex(/^\d+(?:\.\d{1,4})?$/)
      .nullable(),
    trackedInStock: z.boolean(),
    storageLocation: z.string().nullable(),
    tagCodes: z.array(z.string()),
  })
  .meta({ id: "IngredientImportNormalizedRow" });

export const ingredientImportResolvedEntitySchema = z.object({
  id: z.uuid().nullable(),
  name: z.string(),
});

export const ingredientImportPreviewRowSchema = z
  .object({
    rowNumber: z.number().int().min(2),
    action: ingredientImportActionSchema,
    normalized: ingredientImportNormalizedRowSchema,
    resolvedIngredient: ingredientImportResolvedEntitySchema.nullable(),
    errors: z.array(ingredientImportIssueSchema),
    warnings: z.array(ingredientImportIssueSchema),
  })
  .meta({ id: "IngredientImportPreviewRow" });

export const ingredientImportPreviewSummarySchema = z
  .object({
    rowCount: z.number().int().min(0),
    createCount: z.number().int().min(0),
    updateCount: z.number().int().min(0),
    skipCount: z.number().int().min(0),
    errorCount: z.number().int().min(0),
    warningCount: z.number().int().min(0),
    blockingErrors: z.boolean(),
  })
  .meta({ id: "IngredientImportPreviewSummary" });

export const ingredientImportPreviewSchema = z
  .object({
    rows: z.array(ingredientImportPreviewRowSchema),
    summary: ingredientImportPreviewSummarySchema,
  })
  .meta({ id: "IngredientImportPreview" });

export const ingredientImportUploadResponseSchema = z
  .object({
    jobId: z.uuid(),
    status: ingredientImportJobStatusSchema,
    preview: ingredientImportPreviewSchema,
  })
  .meta({ id: "IngredientImportUploadResponse" });

export const ingredientImportCommitCountsSchema = z
  .object({
    ingredientsCreated: z.number().int().min(0),
    ingredientsUpdated: z.number().int().min(0),
    tagsAttached: z.number().int().min(0),
  })
  .meta({ id: "IngredientImportCommitCounts" });

export const ingredientImportCommitResponseSchema = z
  .object({
    jobId: z.uuid(),
    status: z.literal("committed"),
    counts: ingredientImportCommitCountsSchema,
  })
  .meta({ id: "IngredientImportCommitResponse" });

export const ingredientImportJobResponseSchema = ingredientImportUploadResponseSchema
  .extend({
    originalFilename: z.string(),
    fileType: ingredientImportFileTypeSchema,
    createdAt: z.string(),
  })
  .meta({ id: "IngredientImportJobResponse" });

export class IngredientImportUploadResponseDto extends createZodDto(
  ingredientImportUploadResponseSchema,
) {}
export class IngredientImportCommitResponseDto extends createZodDto(
  ingredientImportCommitResponseSchema,
) {}
export class IngredientImportJobResponseDto extends createZodDto(
  ingredientImportJobResponseSchema,
) {}

export type IngredientImportIssue = z.infer<typeof ingredientImportIssueSchema>;
export type IngredientImportNormalizedRow = z.infer<
  typeof ingredientImportNormalizedRowSchema
>;
export type IngredientImportPreviewRow = z.infer<typeof ingredientImportPreviewRowSchema>;
export type IngredientImportPreview = z.infer<typeof ingredientImportPreviewSchema>;
export type IngredientImportUploadResponse = z.infer<
  typeof ingredientImportUploadResponseSchema
>;
export type IngredientImportCommitResponse = z.infer<
  typeof ingredientImportCommitResponseSchema
>;
