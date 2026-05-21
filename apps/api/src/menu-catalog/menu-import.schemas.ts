import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import {
  decimalStringSchema,
  localizedTextSchema,
  variantKindSchema,
} from "./menu-catalog.schemas";

export const importActionSchema = z.enum(["create", "update", "skip"]);
export const importFileTypeSchema = z.enum(["csv", "xlsx"]);
export const importJobStatusSchema = z.enum(["pending_review", "committed", "failed"]);

export const importIssueSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    field: z.string().nullable(),
  })
  .meta({ id: "MenuImportIssue" });

export const normalizedImportRowSchema = z
  .object({
    rowNumber: z.number().int().min(2),
    category: z.object({
      localizedNames: localizedTextSchema,
    }),
    product: z.object({
      localizedNames: localizedTextSchema,
      localizedDescriptions: localizedTextSchema,
      sku: z.string().nullable(),
      itemCode: z.string().nullable(),
      colorTag: z.string().nullable(),
      featured: z.boolean(),
      hidden: z.boolean(),
      channels: z.object({
        dineIn: z.boolean(),
        takeaway: z.boolean(),
        delivery: z.boolean(),
        qr: z.boolean(),
        online: z.boolean(),
      }),
      spiceLevel: z.number().int().min(0).max(3).nullable(),
    }),
    variant: z.object({
      name: z.string(),
      variantKind: variantKindSchema,
      price: decimalStringSchema,
    }),
    taxRateCode: z.string().nullable(),
    tagCodes: z.array(z.string()),
  })
  .meta({ id: "MenuImportNormalizedRow" });

export const importResolvedEntitySchema = z.object({
  id: z.uuid().nullable(),
  name: z.string(),
});

export const importPreviewRowSchema = z
  .object({
    rowNumber: z.number().int().min(2),
    action: importActionSchema,
    normalized: normalizedImportRowSchema.pick({
      category: true,
      product: true,
      variant: true,
      taxRateCode: true,
      tagCodes: true,
    }).extend({
      price: decimalStringSchema,
    }),
    resolvedCategory: importResolvedEntitySchema.nullable(),
    resolvedProduct: importResolvedEntitySchema.nullable(),
    resolvedVariant: importResolvedEntitySchema.nullable(),
    errors: z.array(importIssueSchema),
    warnings: z.array(importIssueSchema),
  })
  .meta({ id: "MenuImportPreviewRow" });

export const importPreviewSummarySchema = z
  .object({
    rowCount: z.number().int().min(0),
    createCount: z.number().int().min(0),
    updateCount: z.number().int().min(0),
    skipCount: z.number().int().min(0),
    errorCount: z.number().int().min(0),
    warningCount: z.number().int().min(0),
    blockingErrors: z.boolean(),
  })
  .meta({ id: "MenuImportPreviewSummary" });

export const importPreviewSchema = z
  .object({
    rows: z.array(importPreviewRowSchema),
    summary: importPreviewSummarySchema,
  })
  .meta({ id: "MenuImportPreview" });

export const importUploadResponseSchema = z
  .object({
    jobId: z.uuid(),
    status: importJobStatusSchema,
    preview: importPreviewSchema,
  })
  .meta({ id: "MenuImportUploadResponse" });

export const importJobResponseSchema = importUploadResponseSchema
  .extend({
    originalFilename: z.string(),
    fileType: importFileTypeSchema,
    createdAt: z.string(),
  })
  .meta({ id: "MenuImportJobResponse" });

export class MenuImportUploadResponseDto extends createZodDto(importUploadResponseSchema) {}
export class MenuImportJobResponseDto extends createZodDto(importJobResponseSchema) {}

export type ImportIssue = z.infer<typeof importIssueSchema>;
export type NormalizedImportRow = z.infer<typeof normalizedImportRowSchema>;
export type ImportPreviewRow = z.infer<typeof importPreviewRowSchema>;
export type ImportPreview = z.infer<typeof importPreviewSchema>;
export type ImportUploadResponse = z.infer<typeof importUploadResponseSchema>;
