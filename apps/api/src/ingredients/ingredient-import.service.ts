import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  auditLog,
  dietaryTags,
  ingredientImportJobs,
  ingredients,
  ingredientTags,
  unitsOfMeasure,
} from "@quickarte/db-schema";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import ExcelJS from "exceljs";
import { DatabaseService, type TenantedDrizzleClient } from "../database/database.service";
import {
  INGREDIENT_IMPORT_HEADERS,
  parseIngredientImportFile,
  type ParsedIngredientImportRow,
  type UploadedIngredientImportFile,
} from "./ingredient-import.parser";
import type {
  IngredientImportCommitResponse,
  IngredientImportIssue,
  IngredientImportNormalizedRow,
  IngredientImportPreview,
  IngredientImportPreviewRow,
  IngredientImportUploadResponse,
} from "./ingredient-import.schemas";

type ImportLookups = {
  ingredientsByName: Map<string, typeof ingredients.$inferSelect>;
  unitCodes: Set<string>;
  tagsByCode: Map<string, typeof dietaryTags.$inferSelect>;
};

type StoredImportRow = {
  rowNumber: number;
  action: "create" | "update" | "skip";
  normalized: IngredientImportNormalizedRow;
  errors: IngredientImportIssue[];
  warnings: IngredientImportIssue[];
};

type CommitCounts = IngredientImportCommitResponse["counts"];

@Injectable()
export class IngredientImportService {
  constructor(@Inject(DatabaseService) private readonly databaseService: DatabaseService) {}

  async uploadAndPreview(
    businessId: string,
    userId: string,
    file: UploadedIngredientImportFile,
  ): Promise<IngredientImportUploadResponse> {
    const parsed = await parseIngredientImportFile(file);
    return this.databaseService.withTenant(businessId, async (tx) => {
      const lookups = await this.loadLookups(tx, businessId);
      const preview = this.buildPreview(parsed.rows, lookups);
      const [job] = await tx
        .insert(ingredientImportJobs)
        .values({
          businessId,
          status: "pending_review",
          originalFilename: file.originalname,
          fileType: parsed.fileType,
          parsedRows: preview.rows.map((row) => ({
            rowNumber: row.rowNumber,
            action: row.action,
            normalized: row.normalized,
            errors: row.errors,
            warnings: row.warnings,
          })),
          previewReport: preview,
          rowCount: preview.summary.rowCount,
          errorCount: preview.summary.errorCount,
          warningCount: preview.summary.warningCount,
          createdBy: userId,
        })
        .returning({ id: ingredientImportJobs.id, status: ingredientImportJobs.status });
      if (!job) throw new Error("Ingredient import job creation failed");
      return { jobId: job.id, status: job.status, preview };
    });
  }

  async getJob(businessId: string, jobId: string) {
    return this.databaseService.withTenant(businessId, async (tx) => {
      const [job] = await tx
        .select()
        .from(ingredientImportJobs)
        .where(and(eq(ingredientImportJobs.businessId, businessId), eq(ingredientImportJobs.id, jobId)))
        .limit(1);
      if (!job) throw new NotFoundException("Ingredient import job not found");
      return {
        jobId: job.id,
        status: job.status,
        originalFilename: job.originalFilename,
        fileType: job.fileType as "csv" | "xlsx",
        createdAt: job.createdAt.toISOString(),
        preview: job.previewReport as IngredientImportPreview,
      };
    });
  }

  async commitJob(
    businessId: string,
    userId: string,
    jobId: string,
  ): Promise<IngredientImportCommitResponse> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      const [job] = await tx
        .select()
        .from(ingredientImportJobs)
        .where(and(eq(ingredientImportJobs.businessId, businessId), eq(ingredientImportJobs.id, jobId)))
        .limit(1);
      if (!job) throw new NotFoundException("Ingredient import job not found");
      if (job.status !== "pending_review") {
        throw new ConflictException({
          type: "https://api.quickarte.ma/problems/ingredient-import-not-pending",
          message: "Only pending_review import jobs can be committed.",
        });
      }

      const storedRows = this.readStoredRows(job.parsedRows);
      const preview = this.buildPreviewFromStoredRows(
        storedRows,
        await this.loadLookups(tx, businessId),
      );
      if (preview.summary.blockingErrors) {
        throw new BadRequestException({
          type: "https://api.quickarte.ma/problems/ingredient-import-blocking-errors",
          message: "The import job has blocking errors and cannot be committed.",
          preview,
        });
      }

      const counts = await this.applyRows(tx, businessId, preview.rows);
      await tx
        .update(ingredientImportJobs)
        .set({
          status: "committed",
          committedAt: new Date(),
          previewReport: preview,
          rowCount: preview.summary.rowCount,
          errorCount: preview.summary.errorCount,
          warningCount: preview.summary.warningCount,
          updatedAt: new Date(),
        })
        .where(and(eq(ingredientImportJobs.businessId, businessId), eq(ingredientImportJobs.id, jobId)));
      await tx.insert(auditLog).values({
        businessId,
        actorUserId: userId,
        action: "ingredient.import.committed",
        entityType: "ingredient_import_job",
        entityId: jobId,
        afterState: {
          jobId,
          originalFilename: job.originalFilename,
          counts,
        },
      });
      return { jobId, status: "committed", counts };
    });
  }

  async buildTemplateWorkbook(businessId: string): Promise<Buffer> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      const unitRows = await tx.select().from(unitsOfMeasure).orderBy(asc(unitsOfMeasure.code));
      const tagRows = await tx
        .select({ code: dietaryTags.code, kind: dietaryTags.kind })
        .from(dietaryTags)
        .where(and(eq(dietaryTags.businessId, businessId), isNull(dietaryTags.deletedAt)))
        .orderBy(asc(dietaryTags.kind), asc(dietaryTags.code));
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Mizan";
      const sheet = workbook.addWorksheet("ingredient_import");
      sheet.addRow([...INGREDIENT_IMPORT_HEADERS]);
      sheet.addRow([
        "Oignon",
        "",
        "Onion",
        "",
        "vegetable",
        "g",
        "8,50",
        "true",
        "Reserve seche",
        "contains_nuts",
      ]);
      sheet.columns.forEach((column) => {
        column.width = 22;
      });
      const validValues = workbook.addWorksheet("valid_values");
      validValues.addRow(["field", "valid values", "notes"]);
      validValues.addRow(["category", "meat, dairy, vegetable, spice, dry_good, beverage, alcohol, packaging", "Ingredient category."]);
      validValues.addRow(["stock_uom", unitRows.map((row) => row.code).join(", "), "Use one global unit code."]);
      validValues.addRow(["allergen_tag_codes", tagRows.map((row) => row.code).join(", "), "Comma-separated existing dietary/allergen tag codes."]);
      validValues.addRow(["current_cost_per_uom", "decimal string", "Both 8.50 and 8,50 are accepted."]);
      validValues.columns.forEach((column) => {
        column.width = 42;
      });
      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(buffer);
    });
  }

  private buildPreview(rows: ParsedIngredientImportRow[], lookups: ImportLookups): IngredientImportPreview {
    const previewRows = rows.map((row) => this.previewRow(row, lookups));
    this.addDuplicateWarnings(previewRows);
    return this.summarize(previewRows);
  }

  private buildPreviewFromStoredRows(
    rows: StoredImportRow[],
    lookups: ImportLookups,
  ): IngredientImportPreview {
    return this.buildPreview(
      rows.map((row) => ({
        rowNumber: row.rowNumber,
        raw: {},
        normalized: row.normalized,
        errors: row.errors,
        warnings: row.warnings,
      })),
      lookups,
    );
  }

  private previewRow(row: ParsedIngredientImportRow, lookups: ImportLookups): IngredientImportPreviewRow {
    if (!row.normalized) {
      return {
        rowNumber: row.rowNumber,
        action: "skip",
        normalized: this.emptyNormalized(row.rowNumber),
        resolvedIngredient: null,
        errors: row.errors,
        warnings: row.warnings,
      };
    }
    const errors = [...row.errors];
    if (!lookups.unitCodes.has(row.normalized.stockUom)) {
      errors.push(issue("unknown-stock-uom", `Unknown stock_uom '${row.normalized.stockUom}'.`, "stock_uom"));
    }
    const unknownTags = row.normalized.tagCodes.filter((code) => !lookups.tagsByCode.has(code));
    if (unknownTags.length > 0) {
      errors.push(issue("unknown-tag-code", `Unknown tag code(s): ${unknownTags.join(", ")}.`, "allergen_tag_codes"));
    }
    const name = row.normalized.localizedNames.fr ?? "";
    const existing = lookups.ingredientsByName.get(key(name));
    return {
      rowNumber: row.rowNumber,
      action: errors.length > 0 ? "skip" : existing ? "update" : "create",
      normalized: row.normalized,
      resolvedIngredient: existing ? { id: existing.id, name: existing.name } : { id: null, name },
      errors,
      warnings: row.warnings,
    };
  }

  private summarize(rows: IngredientImportPreviewRow[]): IngredientImportPreview {
    return {
      rows,
      summary: {
        rowCount: rows.length,
        createCount: rows.filter((row) => row.action === "create").length,
        updateCount: rows.filter((row) => row.action === "update").length,
        skipCount: rows.filter((row) => row.action === "skip").length,
        errorCount: rows.filter((row) => row.errors.length > 0).length,
        warningCount: rows.reduce((count, row) => count + row.warnings.length, 0),
        blockingErrors: rows.some((row) => row.errors.length > 0),
      },
    };
  }

  private addDuplicateWarnings(rows: IngredientImportPreviewRow[]): void {
    const seen = new Map<string, number>();
    for (const row of rows) {
      if (row.errors.length > 0) continue;
      const name = row.normalized.localizedNames.fr ?? "";
      const first = seen.get(key(name));
      if (first) {
        row.warnings.push(issue("duplicate-ingredient-in-file", `This row resolves to the same ingredient as row ${first}; later rows update the same ingredient.`, "name_fr"));
      } else {
        seen.set(key(name), row.rowNumber);
      }
    }
  }

  private async applyRows(
    tx: TenantedDrizzleClient,
    businessId: string,
    rows: IngredientImportPreviewRow[],
  ): Promise<CommitCounts> {
    const counts: CommitCounts = {
      ingredientsCreated: 0,
      ingredientsUpdated: 0,
      tagsAttached: 0,
    };
    const lookups = await this.loadLookups(tx, businessId);
    const ingredientsByName = new Map(lookups.ingredientsByName);
    for (const row of rows) {
      if (row.errors.length > 0) continue;
      const name = row.normalized.localizedNames.fr ?? "";
      const ingredientKey = key(name);
      let ingredient = ingredientsByName.get(ingredientKey);
      if (ingredient) {
        const [updated] = await tx
          .update(ingredients)
          .set({
            name,
            localizedNames: row.normalized.localizedNames,
            category: row.normalized.category,
            stockUom: row.normalized.stockUom,
            currentCostPerUom: row.normalized.currentCostPerUom,
            trackedInStock: row.normalized.trackedInStock,
            storageLocation: row.normalized.storageLocation,
            updatedAt: new Date(),
          })
          .where(and(eq(ingredients.businessId, businessId), eq(ingredients.id, ingredient.id)))
          .returning();
        if (updated) ingredient = updated;
        counts.ingredientsUpdated += 1;
      } else {
        const [created] = await tx
          .insert(ingredients)
          .values({
            businessId,
            name,
            localizedNames: row.normalized.localizedNames,
            category: row.normalized.category,
            stockUom: row.normalized.stockUom,
            currentCostPerUom: row.normalized.currentCostPerUom,
            trackedInStock: row.normalized.trackedInStock,
            storageLocation: row.normalized.storageLocation,
            position: ingredientsByName.size,
          })
          .returning();
        if (!created) throw new Error("Ingredient import insert failed");
        ingredient = created;
        ingredientsByName.set(ingredientKey, created);
        counts.ingredientsCreated += 1;
      }
      await tx
        .delete(ingredientTags)
        .where(and(eq(ingredientTags.businessId, businessId), eq(ingredientTags.ingredientId, ingredient.id)));
      for (const tagCode of row.normalized.tagCodes) {
        const tag = lookups.tagsByCode.get(tagCode);
        if (!tag) continue;
        const inserted = await tx
          .insert(ingredientTags)
          .values({ businessId, ingredientId: ingredient.id, tagId: tag.id })
          .onConflictDoNothing()
          .returning({ tagId: ingredientTags.tagId });
        counts.tagsAttached += inserted.length;
      }
    }
    return counts;
  }

  private async loadLookups(
    tx: TenantedDrizzleClient,
    businessId: string,
  ): Promise<ImportLookups> {
    const ingredientRows = await tx
      .select()
      .from(ingredients)
      .where(and(eq(ingredients.businessId, businessId), isNull(ingredients.deletedAt)));
    const unitRows = await tx.select({ code: unitsOfMeasure.code }).from(unitsOfMeasure);
    const tagRows = await tx
      .select()
      .from(dietaryTags)
      .where(and(eq(dietaryTags.businessId, businessId), isNull(dietaryTags.deletedAt)));
    return {
      ingredientsByName: new Map(ingredientRows.map((row) => [key(row.localizedNames.fr ?? row.name), row])),
      unitCodes: new Set(unitRows.map((row) => row.code)),
      tagsByCode: new Map(tagRows.map((row) => [row.code, row])),
    };
  }

  private readStoredRows(value: unknown): StoredImportRow[] {
    return Array.isArray(value) ? (value as StoredImportRow[]) : [];
  }

  private emptyNormalized(rowNumber: number): IngredientImportNormalizedRow {
    return {
      rowNumber,
      localizedNames: {},
      category: "dry_good",
      stockUom: "",
      currentCostPerUom: null,
      trackedInStock: true,
      storageLocation: null,
      tagCodes: [],
    };
  }
}

function key(value: string): string {
  return value.trim().toLowerCase();
}

function issue(code: string, message: string, field: string): IngredientImportIssue {
  return { code, message, field };
}
