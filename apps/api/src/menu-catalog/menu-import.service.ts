import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  auditLog,
  categories,
  dietaryTags,
  menuImportJobs,
  products,
  productTags,
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
  ImportCommitResponse,
  ImportPreview,
  ImportPreviewRow,
  ImportUploadResponse,
  NormalizedImportRow,
} from "./menu-import.schemas";

type CatalogLookups = {
  categoriesByName: Map<string, typeof categories.$inferSelect>;
  productsBySku: Map<string, typeof products.$inferSelect>;
  productsByCategoryAndName: Map<string, typeof products.$inferSelect>;
  variantsByProductAndName: Map<string, typeof productVariants.$inferSelect>;
  taxRateCodes: Set<string>;
  tagsByCode: Map<string, typeof dietaryTags.$inferSelect>;
};

type StoredImportRow = {
  rowNumber: number;
  action: "create" | "update" | "skip";
  normalized: ImportPreviewRow["normalized"];
  errors: ImportIssue[];
  warnings: ImportIssue[];
};

type CommitCounts = ImportCommitResponse["counts"];

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

  async commitJob(
    businessId: string,
    userId: string,
    jobId: string,
  ): Promise<ImportCommitResponse> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      const [job] = await tx
        .select()
        .from(menuImportJobs)
        .where(and(eq(menuImportJobs.businessId, businessId), eq(menuImportJobs.id, jobId)))
        .limit(1);
      if (!job) throw new NotFoundException("Menu import job not found");
      if (job.status !== "pending_review") {
        throw new ConflictException({
          type: "https://api.quickarte.ma/problems/menu-import-not-pending",
          message: "Only pending_review import jobs can be committed.",
        });
      }

      const storedRows = this.readStoredRows(job.parsedRows);
      const lookups = await this.loadLookups(tx, businessId);
      const preview = this.buildPreviewFromStoredRows(storedRows, lookups);
      if (preview.summary.blockingErrors) {
        throw new BadRequestException({
          type: "https://api.quickarte.ma/problems/menu-import-blocking-errors",
          message: "The import job has blocking errors and cannot be committed.",
          preview,
        });
      }

      const counts = await this.applyRows(tx, businessId, preview.rows, lookups);
      await tx
        .update(menuImportJobs)
        .set({
          status: "committed",
          committedAt: new Date(),
          previewReport: preview,
          rowCount: preview.summary.rowCount,
          errorCount: preview.summary.errorCount,
          warningCount: preview.summary.warningCount,
          updatedAt: new Date(),
        })
        .where(and(eq(menuImportJobs.businessId, businessId), eq(menuImportJobs.id, jobId)));
      await tx.insert(auditLog).values({
        businessId,
        actorUserId: userId,
        action: "menu.import.committed",
        entityType: "menu_import_job",
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
    this.addDuplicateVariantWarnings(previewRows);
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

  private buildPreviewFromStoredRows(
    rows: StoredImportRow[],
    lookups: CatalogLookups,
  ): ImportPreview {
    return this.buildPreview(
      rows.map((row) => ({
        rowNumber: row.rowNumber,
        raw: {},
        normalized: {
          rowNumber: row.rowNumber,
          category: row.normalized.category,
          product: row.normalized.product,
          variant: row.normalized.variant,
          taxRateCode: row.normalized.taxRateCode,
          tagCodes: row.normalized.tagCodes,
        } satisfies NormalizedImportRow,
        errors: row.errors,
        warnings: row.warnings,
      })),
      lookups,
    );
  }

  private readStoredRows(value: unknown): StoredImportRow[] {
    return Array.isArray(value) ? (value as StoredImportRow[]) : [];
  }

  private async applyRows(
    tx: TenantedDrizzleClient,
    businessId: string,
    rows: ImportPreviewRow[],
    lookups: CatalogLookups,
  ): Promise<CommitCounts> {
    const counts: CommitCounts = {
      categoriesCreated: 0,
      categoriesUpdated: 0,
      productsCreated: 0,
      productsUpdated: 0,
      variantsCreated: 0,
      variantsUpdated: 0,
      tagsAttached: 0,
    };
    const categoriesByName = new Map(lookups.categoriesByName);
    const productsBySku = new Map(lookups.productsBySku);
    const productsByCategoryAndName = new Map(lookups.productsByCategoryAndName);
    const variantsByProductAndName = new Map(lookups.variantsByProductAndName);
    const touchedCategoryKeys = new Set<string>();
    const touchedProductKeys = new Set<string>();
    const variantPositionsByProduct = new Map<string, number>();

    for (const row of rows) {
      if (row.errors.length > 0) continue;
      const normalized = row.normalized;
      const categoryName = normalized.category.localizedNames.fr ?? "";
      const categoryKey = key(categoryName);
      let category = categoriesByName.get(categoryKey);
      if (category) {
        if (!touchedCategoryKeys.has(categoryKey)) {
          const [updated] = await tx
            .update(categories)
            .set({
              name: categoryName,
              localizedNames: normalized.category.localizedNames,
              slug: category.slug ?? slugify(categoryName),
              updatedAt: new Date(),
            })
            .where(and(eq(categories.businessId, businessId), eq(categories.id, category.id)))
            .returning();
          if (updated) {
            category = updated;
            categoriesByName.set(categoryKey, updated);
            counts.categoriesUpdated += 1;
          }
          touchedCategoryKeys.add(categoryKey);
        }
      } else {
        const [created] = await tx
          .insert(categories)
          .values({
            businessId,
            name: categoryName,
            slug: slugify(categoryName),
            localizedNames: normalized.category.localizedNames,
            position: categoriesByName.size,
          })
          .returning();
        if (!created) throw new Error("Category import insert failed");
        category = created;
        categoriesByName.set(categoryKey, created);
        touchedCategoryKeys.add(categoryKey);
        counts.categoriesCreated += 1;
      }

      const productName = normalized.product.localizedNames.fr ?? "";
      const productKey = normalized.product.sku
        ? `sku:${key(normalized.product.sku)}`
        : `category:${category.id}:${key(productName)}`;
      let product = normalized.product.sku
        ? productsBySku.get(key(normalized.product.sku))
        : productsByCategoryAndName.get(`${category.id}:${key(productName)}`);
      if (product) {
        if (!touchedProductKeys.has(productKey)) {
          const [updated] = await tx
            .update(products)
            .set({
              categoryId: category.id,
              name: productName,
              description: normalized.product.localizedDescriptions.fr ?? null,
              price: normalized.variant.price,
              sku: normalized.product.sku,
              itemCode: normalized.product.itemCode,
              colorTag: normalized.product.colorTag,
              featured: normalized.product.featured,
              hidden: normalized.product.hidden,
              availableDineIn: normalized.product.channels.dineIn,
              availableTakeaway: normalized.product.channels.takeaway,
              availableDelivery: normalized.product.channels.delivery,
              availableQr: normalized.product.channels.qr,
              availableOnline: normalized.product.channels.online,
              spiceLevel: normalized.product.spiceLevel,
              localizedNames: normalized.product.localizedNames,
              localizedDescriptions: normalized.product.localizedDescriptions,
              updatedAt: new Date(),
            })
            .where(and(eq(products.businessId, businessId), eq(products.id, product.id)))
            .returning();
          if (updated) {
            product = updated;
            counts.productsUpdated += 1;
          }
          touchedProductKeys.add(productKey);
        }
      } else {
        const [created] = await tx
          .insert(products)
          .values({
            businessId,
            categoryId: category.id,
            name: productName,
            description: normalized.product.localizedDescriptions.fr ?? null,
            price: normalized.variant.price,
            sku: normalized.product.sku,
            itemCode: normalized.product.itemCode,
            colorTag: normalized.product.colorTag,
            featured: normalized.product.featured,
            hidden: normalized.product.hidden,
            availableDineIn: normalized.product.channels.dineIn,
            availableTakeaway: normalized.product.channels.takeaway,
            availableDelivery: normalized.product.channels.delivery,
            availableQr: normalized.product.channels.qr,
            availableOnline: normalized.product.channels.online,
            spiceLevel: normalized.product.spiceLevel,
            localizedNames: normalized.product.localizedNames,
            localizedDescriptions: normalized.product.localizedDescriptions,
            position: touchedProductKeys.size,
          })
          .returning();
        if (!created) throw new Error("Product import insert failed");
        product = created;
        counts.productsCreated += 1;
        touchedProductKeys.add(productKey);
      }
      if (product.sku) productsBySku.set(key(product.sku), product);
      productsByCategoryAndName.set(`${category.id}:${key(productName)}`, product);

      const variantKey = `${product.id}:${key(normalized.variant.name)}`;
      const variant = variantsByProductAndName.get(variantKey);
      const nextPosition = variantPositionsByProduct.get(product.id) ?? 0;
      if (variant) {
        const [updated] = await tx
          .update(productVariants)
          .set({
            name: normalized.variant.name,
            priceOverride: normalized.variant.price,
            variantKind: normalized.variant.variantKind,
            pricingMode: "fixed",
            position: variant.position,
            updatedAt: new Date(),
          })
          .where(eq(productVariants.id, variant.id))
          .returning();
        if (updated) variantsByProductAndName.set(variantKey, updated);
        counts.variantsUpdated += 1;
      } else {
        const [created] = await tx
          .insert(productVariants)
          .values({
            productId: product.id,
            name: normalized.variant.name,
            priceOverride: normalized.variant.price,
            variantKind: normalized.variant.variantKind,
            pricingMode: "fixed",
            position: nextPosition,
            isDefault: nextPosition === 0,
          })
          .returning();
        if (!created) throw new Error("Product variant import insert failed");
        variantsByProductAndName.set(variantKey, created);
        counts.variantsCreated += 1;
      }
      variantPositionsByProduct.set(product.id, nextPosition + 1);

      for (const tagCode of normalized.tagCodes) {
        const tag = lookups.tagsByCode.get(tagCode);
        if (!tag) continue;
        const inserted = await tx
          .insert(productTags)
          .values({
            businessId,
            productId: product.id,
            tagId: tag.id,
          })
          .onConflictDoNothing()
          .returning({ tagId: productTags.tagId });
        counts.tagsAttached += inserted.length;
      }
    }
    return counts;
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
    const unknownTags = row.normalized.tagCodes.filter((tagCode) => !lookups.tagsByCode.has(tagCode));
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

  private addDuplicateVariantWarnings(rows: ImportPreviewRow[]): void {
    const seen = new Map<string, number>();
    for (const row of rows) {
      if (row.errors.length > 0) continue;
      const categoryName = row.resolvedCategory?.name ?? row.normalized.category.localizedNames.fr ?? "";
      const productKey = row.normalized.product.sku
        ? `sku:${key(row.normalized.product.sku)}`
        : `category:${key(categoryName)}:${key(row.normalized.product.localizedNames.fr ?? "")}`;
      const variantKey = `${productKey}:${key(row.normalized.variant.name)}`;
      const firstRowNumber = seen.get(variantKey);
      if (firstRowNumber) {
        row.warnings.push(
          issue(
            "duplicate-variant-in-file",
            `This row resolves to the same product variant as row ${firstRowNumber}; later rows update the same variant.`,
            "variant_name",
          ),
        );
      } else {
        seen.set(variantKey, row.rowNumber);
      }
    }
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
      .select()
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
      tagsByCode: new Map(tagRows.map((row) => [row.code, row])),
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

function slugify(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "menu-category";
}

function issue(code: string, message: string, field: string): ImportIssue {
  return { code, message, field };
}
