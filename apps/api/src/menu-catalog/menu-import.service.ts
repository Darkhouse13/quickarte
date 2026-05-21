import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  categories,
  dietaryTags,
  menuImportJobs,
  products,
  productVariants,
  taxRates,
} from "@quickarte/db-schema";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import ExcelJS from "exceljs";
import {
  DatabaseService,
  type TenantedDrizzleClient,
} from "../database/database.service";
import {
  MENU_IMPORT_HEADERS,
  parseMenuImportFile,
  type ParsedImportRow,
  type UploadedImportFile,
} from "./menu-import.parser";
import type {
  ImportIssue,
  ImportPreview,
  ImportPreviewRow,
  ImportUploadResponse,
} from "./menu-import.schemas";

type CatalogLookups = {
  categoriesByName: Map<string, typeof categories.$inferSelect>;
  productsBySku: Map<string, typeof products.$inferSelect>;
  productsByCategoryAndName: Map<string, typeof products.$inferSelect>;
  variantsByProductAndName: Map<string, typeof productVariants.$inferSelect>;
  taxRateCodes: Set<string>;
  tagCodes: Set<string>;
};

@Injectable()
export class MenuImportService {
  constructor(@Inject(DatabaseService) private readonly databaseService: DatabaseService) {}

  async uploadAndPreview(
    businessId: string,
    userId: string,
    file: UploadedImportFile,
  ): Promise<ImportUploadResponse> {
    const parsed = await parseMenuImportFile(file);
    return this.databaseService.withTenant(businessId, async (tx) => {
      const lookups = await this.loadLookups(tx, businessId);
      const preview = this.buildPreview(parsed.rows, lookups);
      const [job] = await tx
        .insert(menuImportJobs)
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
        .returning({ id: menuImportJobs.id, status: menuImportJobs.status });
      if (!job) throw new Error("Menu import job creation failed");
      return { jobId: job.id, status: job.status, preview };
    });
  }

  async getJob(businessId: string, jobId: string) {
    return this.databaseService.withTenant(businessId, async (tx) => {
      const [job] = await tx
        .select()
        .from(menuImportJobs)
        .where(and(eq(menuImportJobs.businessId, businessId), eq(menuImportJobs.id, jobId)))
        .limit(1);
      if (!job) throw new NotFoundException("Menu import job not found");
      return {
        jobId: job.id,
        status: job.status,
        originalFilename: job.originalFilename,
        fileType: job.fileType as "csv" | "xlsx",
        createdAt: job.createdAt.toISOString(),
        preview: job.previewReport as ImportPreview,
      };
    });
  }

  async buildTemplateWorkbook(businessId: string): Promise<Buffer> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      const taxRows = await tx
        .select({ id: taxRates.id, label: taxRates.label, rate: taxRates.rate })
        .from(taxRates)
        .where(eq(taxRates.isActive, true))
        .orderBy(asc(taxRates.rate));
      const tagRows = await tx
        .select({ code: dietaryTags.code, kind: dietaryTags.kind })
        .from(dietaryTags)
        .where(and(eq(dietaryTags.businessId, businessId), isNull(dietaryTags.deletedAt)))
        .orderBy(asc(dietaryTags.kind), asc(dietaryTags.code));

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Mizan";
      const sheet = workbook.addWorksheet("menu_import");
      sheet.addRow([...MENU_IMPORT_HEADERS]);
      sheet.addRow([
        "Grillades",
        "",
        "",
        "",
        "Brochette poulet",
        "",
        "Chicken skewer",
        "",
        "Servie avec garniture",
        "",
        "",
        "",
        "BROCH-POULET",
        "BR-001",
        "Poulet",
        "protein",
        "80,00",
        "ma_tva_10",
        "halal",
        "#B8543A",
        "false",
        "false",
        "true",
        "true",
        "false",
        "true",
        "false",
        "1",
      ]);
      sheet.columns.forEach((column) => {
        column.width = 20;
      });

      const validValues = workbook.addWorksheet("valid_values");
      validValues.addRow(["field", "valid values", "notes"]);
      validValues.addRow(["tax_rate_code", taxRows.map((row) => row.id).join(", "), "Use one of the active Moroccan TVA ids."]);
      validValues.addRow(["tag_codes", tagRows.map((row) => row.code).join(", "), "Comma-separated existing dietary/allergen tag codes."]);
      validValues.addRow(["variant_kind", "size, protein, topping, market, custom", "Use custom when unsure."]);
      validValues.addRow(["channels", "true/false", "available_dine_in, available_takeaway, available_delivery, available_qr, available_online."]);
      validValues.addRow(["price", "decimal string", "Both 80.00 and 80,00 are accepted and normalized to 80.00."]);
      validValues.columns.forEach((column) => {
        column.width = 36;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(buffer);
    });
  }

  private buildPreview(rows: ParsedImportRow[], lookups: CatalogLookups): ImportPreview {
    const previewRows = rows.map((row) => this.previewRow(row, lookups));
    return {
      rows: previewRows,
      summary: {
        rowCount: previewRows.length,
        createCount: previewRows.filter((row) => row.action === "create").length,
        updateCount: previewRows.filter((row) => row.action === "update").length,
        skipCount: previewRows.filter((row) => row.action === "skip").length,
        errorCount: previewRows.filter((row) => row.errors.length > 0).length,
        warningCount: previewRows.reduce((count, row) => count + row.warnings.length, 0),
        blockingErrors: previewRows.some((row) => row.errors.length > 0),
      },
    };
  }

  private previewRow(row: ParsedImportRow, lookups: CatalogLookups): ImportPreviewRow {
    if (!row.normalized) {
      return {
        rowNumber: row.rowNumber,
        action: "skip",
        normalized: this.emptyNormalizedPreview(),
        resolvedCategory: null,
        resolvedProduct: null,
        resolvedVariant: null,
        errors: row.errors,
        warnings: row.warnings,
      };
    }

    const errors = [...row.errors];
    const categoryName = row.normalized.category.localizedNames.fr ?? "";
    const productName = row.normalized.product.localizedNames.fr ?? "";
    const category = lookups.categoriesByName.get(key(categoryName));
    const product = row.normalized.product.sku
      ? lookups.productsBySku.get(key(row.normalized.product.sku))
      : category
        ? lookups.productsByCategoryAndName.get(`${category.id}:${key(productName)}`)
        : undefined;
    const variant = product
      ? lookups.variantsByProductAndName.get(`${product.id}:${key(row.normalized.variant.name)}`)
      : undefined;

    if (row.normalized.taxRateCode && !lookups.taxRateCodes.has(row.normalized.taxRateCode)) {
      errors.push(issue("unknown-tax-rate", `Unknown tax_rate_code '${row.normalized.taxRateCode}'.`, "tax_rate_code"));
    }
    const unknownTags = row.normalized.tagCodes.filter((tagCode) => !lookups.tagCodes.has(tagCode));
    if (unknownTags.length > 0) {
      errors.push(issue("unknown-tag-code", `Unknown tag code(s): ${unknownTags.join(", ")}.`, "tag_codes"));
    }

    const action = errors.length > 0 ? "skip" : variant ? "update" : "create";
    return {
      rowNumber: row.normalized.rowNumber,
      action,
      normalized: {
        category: row.normalized.category,
        product: row.normalized.product,
        variant: row.normalized.variant,
        price: row.normalized.variant.price,
        taxRateCode: row.normalized.taxRateCode,
        tagCodes: row.normalized.tagCodes,
      },
      resolvedCategory: category ? { id: category.id, name: category.name } : { id: null, name: categoryName },
      resolvedProduct: product ? { id: product.id, name: product.name } : { id: null, name: productName },
      resolvedVariant: variant
        ? { id: variant.id, name: variant.name }
        : { id: null, name: row.normalized.variant.name },
      errors,
      warnings: row.warnings,
    };
  }

  private async loadLookups(
    tx: TenantedDrizzleClient,
    businessId: string,
  ): Promise<CatalogLookups> {
    const categoryRows = await tx
      .select()
      .from(categories)
      .where(and(eq(categories.businessId, businessId), isNull(categories.deletedAt)));
    const productRows = await tx
      .select()
      .from(products)
      .where(and(eq(products.businessId, businessId), isNull(products.deletedAt)));
    const productIds = productRows.map((row) => row.id);
    const variantRows =
      productIds.length > 0
        ? await tx
            .select()
            .from(productVariants)
            .where(inArray(productVariants.productId, productIds))
        : [];
    const taxRows = await tx
      .select({ id: taxRates.id })
      .from(taxRates)
      .where(eq(taxRates.isActive, true));
    const tagRows = await tx
      .select({ code: dietaryTags.code })
      .from(dietaryTags)
      .where(and(eq(dietaryTags.businessId, businessId), isNull(dietaryTags.deletedAt)));

    return {
      categoriesByName: new Map(categoryRows.map((row) => [key(row.localizedNames.fr ?? row.name), row])),
      productsBySku: new Map(
        productRows.flatMap((row) => (row.sku ? [[key(row.sku), row] as const] : [])),
      ),
      productsByCategoryAndName: new Map(
        productRows.flatMap((row) =>
          row.categoryId
            ? [[`${row.categoryId}:${key(row.localizedNames.fr ?? row.name)}`, row] as const]
            : [],
        ),
      ),
      variantsByProductAndName: new Map(
        variantRows.map((row) => [`${row.productId}:${key(row.name)}`, row]),
      ),
      taxRateCodes: new Set(taxRows.map((row) => row.id)),
      tagCodes: new Set(tagRows.map((row) => row.code)),
    };
  }

  private emptyNormalizedPreview(): ImportPreviewRow["normalized"] {
    return {
      category: { localizedNames: {} },
      product: {
        localizedNames: {},
        localizedDescriptions: {},
        sku: null,
        itemCode: null,
        colorTag: null,
        featured: false,
        hidden: false,
        channels: {
          dineIn: true,
          takeaway: true,
          delivery: true,
          qr: true,
          online: true,
        },
        spiceLevel: null,
      },
      variant: {
        name: "",
        variantKind: "custom",
        price: "0.00",
      },
      price: "0.00",
      taxRateCode: null,
      tagCodes: [],
    };
  }
}

function key(value: string): string {
  return value.trim().toLowerCase();
}

function issue(code: string, message: string, field: string): ImportIssue {
  return { code, message, field };
}
