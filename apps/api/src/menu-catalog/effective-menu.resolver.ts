import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DateTime } from "luxon";
import {
  businesses,
  branchCategoryOverrides,
  branchCategoryPrintRoutes,
  branchCategoryTaxOverrides,
  branchOptionValueOverrides,
  branchProductOverrides,
  branchProductPrintRoutes,
  branchProductPriceOverrides,
  branchProductTaxOverrides,
  branchTaxSettings,
  branches,
  categories,
  categoryModifierGroups,
  categoryPrintRoutes,
  dietaryTags,
  modifierGroupTemplates,
  modifierValueTemplates,
  optionValues,
  productAvailabilityWindows,
  productOptions,
  productTags,
  products,
  productVariants,
  taxRates,
} from "@quickarte/db-schema";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
  DatabaseService,
  type TenantedDrizzleClient,
} from "../database/database.service";
import type {
  BranchMenuOverridesResponse,
  EffectiveMenuResponse,
  MenuChannel,
  ReplaceBranchMenuOverridesInput,
  ReplaceBranchProductPricesInput,
  ReplaceMenuPrintRoutesInput,
  ReplaceMenuTaxOverridesInput,
  UpdateProductAvailabilityInput,
} from "./branch-menu.schemas";
import type { AvailabilityWindowResponse, DietaryTagResponse, ModifierGroupResponse } from "./menu-catalog.schemas";

const DEFAULT_TAX_RATE_ID = "ma_tva_10";
const ALL_PRINT_STATIONS = ["bar", "counter", "kitchen"] as const;

@Injectable()
export class EffectiveMenuResolver {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
  ) {}

  async getEffectiveMenu(
    businessId: string,
    branchId: string,
    channel: MenuChannel,
    evaluationDate: Date = new Date(),
  ): Promise<EffectiveMenuResponse> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      const branchContext = await this.assertBranch(tx, businessId, branchId);
      const defaultTaxRate = await this.getDefaultTaxRateId(tx, businessId, branchId);
      const categoryRows = await tx
        .select()
        .from(categories)
        .where(and(eq(categories.businessId, businessId), isNull(categories.deletedAt)))
        .orderBy(asc(categories.parentId), asc(categories.position), asc(categories.name));
      const categoryOverrideRows = await tx
        .select()
        .from(branchCategoryOverrides)
        .where(
          and(
            eq(branchCategoryOverrides.businessId, businessId),
            eq(branchCategoryOverrides.branchId, branchId),
          ),
        );
      const categoryOverridesById = new Map(
        categoryOverrideRows.map((row) => [row.categoryId, row]),
      );
      const visibleCategoryIds = new Set(
        categoryRows
          .filter((row) => (categoryOverridesById.get(row.id)?.visible ?? row.visible) === true)
          .map((row) => row.id),
      );

      const productRows = await tx
        .select()
        .from(products)
        .where(and(eq(products.businessId, businessId), isNull(products.deletedAt)))
        .orderBy(asc(products.categoryId), asc(products.position), asc(products.name));
      const productOverrideRows = await tx
        .select()
        .from(branchProductOverrides)
        .where(
          and(
            eq(branchProductOverrides.businessId, businessId),
            eq(branchProductOverrides.branchId, branchId),
          ),
        );
      const productOverridesById = new Map(
        productOverrideRows.map((row) => [row.productId, row]),
      );
      const productIds = productRows.map((row) => row.id);
      const [tagsByProduct, windowsByProduct] = await Promise.all([
        this.loadProductTags(tx, businessId, productIds),
        this.loadAvailabilityWindows(tx, businessId, productIds),
      ]);
      const variantRows =
        productIds.length > 0
          ? await tx
              .select()
              .from(productVariants)
              .where(inArray(productVariants.productId, productIds))
              .orderBy(asc(productVariants.position), asc(productVariants.name))
          : [];
      const variantsByProduct = bucketBy(variantRows, (row) => row.productId);
      const priceOverrideRows = await tx
        .select()
        .from(branchProductPriceOverrides)
        .where(
          and(
            eq(branchProductPriceOverrides.businessId, businessId),
            eq(branchProductPriceOverrides.branchId, branchId),
          ),
        );
      const priceOverridesByVariant = new Map(
        priceOverrideRows.map((row) => [row.variantId, row]),
      );
      const [categoryTaxRows, productTaxRows, branchCategoryRouteRows, branchProductRouteRows, legacyRouteRows] =
        await Promise.all([
          tx
            .select()
            .from(branchCategoryTaxOverrides)
            .where(
              and(
                eq(branchCategoryTaxOverrides.businessId, businessId),
                eq(branchCategoryTaxOverrides.branchId, branchId),
              ),
            ),
          tx
            .select()
            .from(branchProductTaxOverrides)
            .where(
              and(
                eq(branchProductTaxOverrides.businessId, businessId),
                eq(branchProductTaxOverrides.branchId, branchId),
              ),
            ),
          tx
            .select()
            .from(branchCategoryPrintRoutes)
            .where(
              and(
                eq(branchCategoryPrintRoutes.businessId, businessId),
                eq(branchCategoryPrintRoutes.branchId, branchId),
              ),
            ),
          tx
            .select()
            .from(branchProductPrintRoutes)
            .where(
              and(
                eq(branchProductPrintRoutes.businessId, businessId),
                eq(branchProductPrintRoutes.branchId, branchId),
              ),
            ),
          tx
            .select()
            .from(categoryPrintRoutes)
            .where(eq(categoryPrintRoutes.businessId, businessId)),
        ]);
      const categoryTaxById = new Map(categoryTaxRows.map((row) => [row.categoryId, row.taxRateId]));
      const productTaxById = new Map(productTaxRows.map((row) => [row.productId, row.taxRateId]));
      const branchCategoryRoutesById = stationSetById(branchCategoryRouteRows, (row) => row.categoryId);
      const branchProductRoutesById = stationSetById(branchProductRouteRows, (row) => row.productId);
      const legacyRoutesByCategoryId = stationSetById(legacyRouteRows, (row) => row.categoryId);
      const modifiersByProduct = await this.loadEffectiveModifiers(
        tx,
        businessId,
        branchId,
        productRows,
      );

      const productsByCategory = new Map<string | null, EffectiveMenuResponse["categories"][number]["products"]>();
      for (const product of productRows) {
        if (product.categoryId && !visibleCategoryIds.has(product.categoryId)) continue;
        const override = productOverridesById.get(product.id);
        if (!this.isProductVisibleForChannel(product, override, channel)) continue;
        const taxResolution = this.resolveTaxRate(
          product,
          defaultTaxRate,
          productTaxById,
          categoryTaxById,
        );
        const routingResolution = this.resolvePrintStations(
          product,
          branchProductRoutesById,
          branchCategoryRoutesById,
          legacyRoutesByCategoryId,
        );
        const availabilityWindows = windowsByProduct.get(product.id) ?? [];
        const effectiveProduct = {
          id: product.id,
          categoryId: product.categoryId,
          name: product.name,
          localizedNames: product.localizedNames,
          description: product.description,
          localizedDescriptions: product.localizedDescriptions,
          image: product.image,
          sku: product.sku,
          itemCode: product.itemCode,
          colorTag: product.colorTag,
          featured: override?.featured ?? product.featured,
          featuredSource: override?.featured === null || override?.featured === undefined ? "inherited" as const : "overridden" as const,
          hidden: override?.hidden ?? product.hidden,
          hiddenSource: override?.hidden === null || override?.hidden === undefined ? "inherited" as const : "overridden" as const,
          available: override?.available ?? product.available,
          availableSource: override?.available === null || override?.available === undefined ? "inherited" as const : "overridden" as const,
          is86d: override?.is86d ?? false,
          eightySixedAt: override?.eightySixedAt?.toISOString() ?? null,
          eightySixedReason: override?.eightySixedReason ?? null,
          position: override?.position ?? product.position,
          positionSource: override?.position === null || override?.position === undefined ? "inherited" as const : "overridden" as const,
          channels: {
            dineIn: override?.availableDineIn ?? product.availableDineIn,
            takeaway: override?.availableTakeaway ?? product.availableTakeaway,
            delivery: override?.availableDelivery ?? product.availableDelivery,
            qr: override?.availableQr ?? product.availableQr,
            online: override?.availableOnline ?? product.availableOnline,
          },
          effectiveTaxRateId: taxResolution.taxRateId,
          taxSource: taxResolution.source,
          printStations: routingResolution.stations,
          printRouteSource: routingResolution.source,
          tags: tagsByProduct.get(product.id) ?? [],
          spiceLevel: product.spiceLevel,
          availabilityWindows,
          availableNow: this.isAvailableAt(
            availabilityWindows,
            branchContext.timezone,
            evaluationDate,
          ),
          variants: this.resolveVariants(
            product,
            variantsByProduct.get(product.id) ?? [],
            priceOverridesByVariant,
          ),
          modifiers: modifiersByProduct.get(product.id) ?? [],
        };
        const bucket = productsByCategory.get(product.categoryId) ?? [];
        bucket.push(effectiveProduct);
        productsByCategory.set(product.categoryId, bucket);
      }

      const responseCategories = this.toCategoryTree(
        categoryRows
          .filter((row) => visibleCategoryIds.has(row.id))
          .map((row) => {
            const override = categoryOverridesById.get(row.id);
            return {
              id: row.id,
              parentId: row.parentId,
              name: row.name,
              localizedNames: row.localizedNames,
              description: row.description,
              localizedDescriptions: row.localizedDescriptions,
              colorTag: row.colorTag,
              visible: override?.visible ?? row.visible,
              visibleSource: override?.visible === null || override?.visible === undefined ? "inherited" as const : "overridden" as const,
              position: override?.position ?? row.position,
              positionSource: override?.position === null || override?.position === undefined ? "inherited" as const : "overridden" as const,
              products: (productsByCategory.get(row.id) ?? []).sort((a, b) => a.position - b.position),
              children: [],
            };
          }),
      );

      return {
        branchId,
        channel,
        generatedAt: new Date().toISOString(),
        defaultTaxRateId: defaultTaxRate.taxRateId,
        categories: responseCategories,
      };
    });
  }

  async getOverrides(
    businessId: string,
    branchId: string,
  ): Promise<BranchMenuOverridesResponse> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      await this.assertBranch(tx, businessId, branchId);
      const [
        categoryRows,
        productRows,
        priceRows,
        optionRows,
        categoryTaxRows,
        productTaxRows,
        categoryPrintRows,
        productPrintRows,
      ] = await Promise.all([
        tx
          .select()
          .from(branchCategoryOverrides)
          .where(
            and(
              eq(branchCategoryOverrides.businessId, businessId),
              eq(branchCategoryOverrides.branchId, branchId),
            ),
          ),
        tx
          .select()
          .from(branchProductOverrides)
          .where(
            and(
              eq(branchProductOverrides.businessId, businessId),
              eq(branchProductOverrides.branchId, branchId),
            ),
          ),
        tx
          .select()
          .from(branchProductPriceOverrides)
          .where(
            and(
              eq(branchProductPriceOverrides.businessId, businessId),
              eq(branchProductPriceOverrides.branchId, branchId),
            ),
          ),
        tx
          .select()
          .from(branchOptionValueOverrides)
          .where(
            and(
              eq(branchOptionValueOverrides.businessId, businessId),
              eq(branchOptionValueOverrides.branchId, branchId),
            ),
          ),
        tx
          .select()
          .from(branchCategoryTaxOverrides)
          .where(
            and(
              eq(branchCategoryTaxOverrides.businessId, businessId),
              eq(branchCategoryTaxOverrides.branchId, branchId),
            ),
          ),
        tx
          .select()
          .from(branchProductTaxOverrides)
          .where(
            and(
              eq(branchProductTaxOverrides.businessId, businessId),
              eq(branchProductTaxOverrides.branchId, branchId),
            ),
          ),
        tx
          .select()
          .from(branchCategoryPrintRoutes)
          .where(
            and(
              eq(branchCategoryPrintRoutes.businessId, businessId),
              eq(branchCategoryPrintRoutes.branchId, branchId),
            ),
          ),
        tx
          .select()
          .from(branchProductPrintRoutes)
          .where(
            and(
              eq(branchProductPrintRoutes.businessId, businessId),
              eq(branchProductPrintRoutes.branchId, branchId),
            ),
          ),
      ]);
      return {
        categoryOverrides: categoryRows.map((row) => ({
          categoryId: row.categoryId,
          visible: row.visible,
          position: row.position,
        })),
        productOverrides: productRows.map((row) => ({
          productId: row.productId,
          available: row.available,
          is86d: row.is86d,
          eightySixedAt: row.eightySixedAt?.toISOString() ?? null,
          eightySixedByUserId: row.eightySixedByUserId,
          eightySixedReason: row.eightySixedReason,
          featured: row.featured,
          hidden: row.hidden,
          channels: {
            dineIn: row.availableDineIn,
            takeaway: row.availableTakeaway,
            delivery: row.availableDelivery,
            qr: row.availableQr,
            online: row.availableOnline,
          },
          position: row.position,
        })),
        priceOverrides: priceRows.map((row) => ({
          productId: row.productId,
          variantId: row.variantId,
          price: row.price,
        })),
        optionValueOverrides: optionRows.map((row) => ({
          optionValueId: row.optionValueId,
          available: row.available,
          priceAddition: row.priceAddition,
        })),
        categoryTaxOverrides: categoryTaxRows.map((row) => ({
          categoryId: row.categoryId,
          taxRateId: row.taxRateId,
        })),
        productTaxOverrides: productTaxRows.map((row) => ({
          productId: row.productId,
          taxRateId: row.taxRateId,
        })),
        categoryPrintRoutes: groupRouteRows(categoryPrintRows, (row) => row.categoryId).map(
          ([categoryId, stations]) => ({ categoryId, stations }),
        ),
        productPrintRoutes: groupRouteRows(productPrintRows, (row) => row.productId).map(
          ([productId, stations]) => ({ productId, stations }),
        ),
      };
    });
  }

  async replaceOverrides(
    businessId: string,
    branchId: string,
    input: ReplaceBranchMenuOverridesInput,
  ): Promise<BranchMenuOverridesResponse> {
    await this.databaseService.withTenant(businessId, async (tx) => {
      await this.assertBranch(tx, businessId, branchId);
      await Promise.all([
        tx.delete(branchCategoryOverrides).where(eq(branchCategoryOverrides.branchId, branchId)),
        tx.delete(branchProductOverrides).where(eq(branchProductOverrides.branchId, branchId)),
        tx.delete(branchProductPriceOverrides).where(eq(branchProductPriceOverrides.branchId, branchId)),
        tx.delete(branchOptionValueOverrides).where(eq(branchOptionValueOverrides.branchId, branchId)),
      ]);
      if (input.categoryOverrides.length > 0) {
        await tx.insert(branchCategoryOverrides).values(
          input.categoryOverrides.map((row) => ({
            businessId,
            branchId,
            categoryId: row.categoryId,
            visible: row.visible,
            position: row.position,
          })),
        );
      }
      if (input.productOverrides.length > 0) {
        await tx.insert(branchProductOverrides).values(
          input.productOverrides.map((row) => ({
            businessId,
            branchId,
            productId: row.productId,
            available: row.available,
            is86d: row.is86d,
            eightySixedAt: row.eightySixedAt ? new Date(row.eightySixedAt) : null,
            eightySixedByUserId: row.eightySixedByUserId,
            eightySixedReason: row.eightySixedReason,
            featured: row.featured,
            hidden: row.hidden,
            availableDineIn: row.channels.dineIn,
            availableTakeaway: row.channels.takeaway,
            availableDelivery: row.channels.delivery,
            availableQr: row.channels.qr,
            availableOnline: row.channels.online,
            position: row.position,
          })),
        );
      }
      await this.replacePriceRows(tx, businessId, branchId, input.priceOverrides);
      if (input.optionValueOverrides.length > 0) {
        await tx.insert(branchOptionValueOverrides).values(
          input.optionValueOverrides.map((row) => ({
            businessId,
            branchId,
            optionValueId: row.optionValueId,
            available: row.available,
            priceAddition: row.priceAddition,
          })),
        );
      }
    });
    return this.getOverrides(businessId, branchId);
  }

  async replaceTaxOverrides(
    businessId: string,
    branchId: string,
    input: ReplaceMenuTaxOverridesInput,
  ): Promise<BranchMenuOverridesResponse> {
    await this.databaseService.withTenant(businessId, async (tx) => {
      await this.assertBranch(tx, businessId, branchId);
      for (const row of input.categoryTaxOverrides) {
        await this.assertCategory(tx, businessId, row.categoryId);
        await this.assertTaxRate(tx, row.taxRateId);
      }
      for (const row of input.productTaxOverrides) {
        await this.assertProduct(tx, businessId, row.productId);
        await this.assertTaxRate(tx, row.taxRateId);
      }
      await Promise.all([
        tx
          .delete(branchCategoryTaxOverrides)
          .where(
            and(
              eq(branchCategoryTaxOverrides.businessId, businessId),
              eq(branchCategoryTaxOverrides.branchId, branchId),
            ),
          ),
        tx
          .delete(branchProductTaxOverrides)
          .where(
            and(
              eq(branchProductTaxOverrides.businessId, businessId),
              eq(branchProductTaxOverrides.branchId, branchId),
            ),
          ),
      ]);
      if (input.categoryTaxOverrides.length > 0) {
        await tx.insert(branchCategoryTaxOverrides).values(
          input.categoryTaxOverrides.map((row) => ({
            businessId,
            branchId,
            categoryId: row.categoryId,
            taxRateId: row.taxRateId,
          })),
        );
      }
      if (input.productTaxOverrides.length > 0) {
        await tx.insert(branchProductTaxOverrides).values(
          input.productTaxOverrides.map((row) => ({
            businessId,
            branchId,
            productId: row.productId,
            taxRateId: row.taxRateId,
          })),
        );
      }
    });
    return this.getOverrides(businessId, branchId);
  }

  async replacePrintRoutes(
    businessId: string,
    branchId: string,
    input: ReplaceMenuPrintRoutesInput,
  ): Promise<BranchMenuOverridesResponse> {
    await this.databaseService.withTenant(businessId, async (tx) => {
      await this.assertBranch(tx, businessId, branchId);
      for (const row of input.categoryPrintRoutes) {
        await this.assertCategory(tx, businessId, row.categoryId);
      }
      for (const row of input.productPrintRoutes) {
        await this.assertProduct(tx, businessId, row.productId);
      }
      await Promise.all([
        tx
          .delete(branchCategoryPrintRoutes)
          .where(
            and(
              eq(branchCategoryPrintRoutes.businessId, businessId),
              eq(branchCategoryPrintRoutes.branchId, branchId),
            ),
          ),
        tx
          .delete(branchProductPrintRoutes)
          .where(
            and(
              eq(branchProductPrintRoutes.businessId, businessId),
              eq(branchProductPrintRoutes.branchId, branchId),
            ),
          ),
      ]);
      const categoryRows = input.categoryPrintRoutes.flatMap((row) =>
        Array.from(new Set(row.stations)).map((station) => ({
          businessId,
          branchId,
          categoryId: row.categoryId,
          station,
        })),
      );
      const productRows = input.productPrintRoutes.flatMap((row) =>
        Array.from(new Set(row.stations)).map((station) => ({
          businessId,
          branchId,
          productId: row.productId,
          station,
        })),
      );
      if (categoryRows.length > 0) await tx.insert(branchCategoryPrintRoutes).values(categoryRows);
      if (productRows.length > 0) await tx.insert(branchProductPrintRoutes).values(productRows);
    });
    return this.getOverrides(businessId, branchId);
  }

  async updateProductAvailability(
    businessId: string,
    branchId: string,
    productId: string,
    userId: string,
    input: UpdateProductAvailabilityInput,
  ): Promise<BranchMenuOverridesResponse> {
    await this.databaseService.withTenant(businessId, async (tx) => {
      await this.assertBranch(tx, businessId, branchId);
      await this.assertProduct(tx, businessId, productId);
      const existing = await this.findProductOverride(tx, businessId, branchId, productId);
      const is86d = input.is86d ?? existing?.is86d ?? false;
      await tx
        .insert(branchProductOverrides)
        .values({
          businessId,
          branchId,
          productId,
          available: input.available ?? existing?.available ?? null,
          is86d,
          eightySixedAt: input.is86d === undefined ? existing?.eightySixedAt ?? null : is86d ? new Date() : null,
          eightySixedByUserId:
            input.is86d === undefined ? existing?.eightySixedByUserId ?? null : is86d ? userId : null,
          eightySixedReason:
            input.is86d === undefined ? existing?.eightySixedReason ?? null : is86d ? input.eightySixedReason ?? null : null,
          featured: existing?.featured ?? null,
          hidden: input.hidden ?? existing?.hidden ?? null,
          availableDineIn: input.channels?.dineIn ?? existing?.availableDineIn ?? null,
          availableTakeaway: input.channels?.takeaway ?? existing?.availableTakeaway ?? null,
          availableDelivery: input.channels?.delivery ?? existing?.availableDelivery ?? null,
          availableQr: input.channels?.qr ?? existing?.availableQr ?? null,
          availableOnline: input.channels?.online ?? existing?.availableOnline ?? null,
          position: existing?.position ?? null,
        })
        .onConflictDoUpdate({
          target: [branchProductOverrides.branchId, branchProductOverrides.productId],
          set: {
            available: input.available ?? existing?.available ?? null,
            is86d,
            eightySixedAt: input.is86d === undefined ? existing?.eightySixedAt ?? null : is86d ? new Date() : null,
            eightySixedByUserId:
              input.is86d === undefined ? existing?.eightySixedByUserId ?? null : is86d ? userId : null,
            eightySixedReason:
              input.is86d === undefined ? existing?.eightySixedReason ?? null : is86d ? input.eightySixedReason ?? null : null,
            hidden: input.hidden ?? existing?.hidden ?? null,
            availableDineIn: input.channels?.dineIn ?? existing?.availableDineIn ?? null,
            availableTakeaway: input.channels?.takeaway ?? existing?.availableTakeaway ?? null,
            availableDelivery: input.channels?.delivery ?? existing?.availableDelivery ?? null,
            availableQr: input.channels?.qr ?? existing?.availableQr ?? null,
            availableOnline: input.channels?.online ?? existing?.availableOnline ?? null,
            updatedAt: new Date(),
          },
        });
    });
    return this.getOverrides(businessId, branchId);
  }

  async replaceProductPrices(
    businessId: string,
    branchId: string,
    productId: string,
    input: ReplaceBranchProductPricesInput,
  ): Promise<BranchMenuOverridesResponse> {
    await this.databaseService.withTenant(businessId, async (tx) => {
      await this.assertBranch(tx, businessId, branchId);
      await this.assertProduct(tx, businessId, productId);
      await tx
        .delete(branchProductPriceOverrides)
        .where(
          and(
            eq(branchProductPriceOverrides.businessId, businessId),
            eq(branchProductPriceOverrides.branchId, branchId),
            eq(branchProductPriceOverrides.productId, productId),
          ),
        );
      await this.replacePriceRows(
        tx,
        businessId,
        branchId,
        input.prices.map((price) => ({ ...price, productId })),
      );
    });
    return this.getOverrides(businessId, branchId);
  }

  private async replacePriceRows(
    tx: TenantedDrizzleClient,
    businessId: string,
    branchId: string,
    rows: Array<{ productId: string; variantId: string; price: string }>,
  ): Promise<void> {
    for (const row of rows) {
      await this.assertProduct(tx, businessId, row.productId);
      const [variant] = await tx
        .select({ id: productVariants.id })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(
          and(
            eq(products.businessId, businessId),
            eq(productVariants.id, row.variantId),
            eq(productVariants.productId, row.productId),
          ),
        )
        .limit(1);
      if (!variant) throw new NotFoundException("Variant not found");
    }
    if (rows.length > 0) {
      await tx.insert(branchProductPriceOverrides).values(
        rows.map((row) => ({
          businessId,
          branchId,
          productId: row.productId,
          variantId: row.variantId,
          price: row.price,
        })),
      );
    }
  }

  private async loadEffectiveModifiers(
    tx: TenantedDrizzleClient,
    businessId: string,
    branchId: string,
    productRows: Array<typeof products.$inferSelect>,
  ): Promise<Map<string, ModifierGroupResponse[]>> {
    const result = new Map<string, ModifierGroupResponse[]>();
    if (productRows.length === 0) return result;
    const productIds = productRows.map((row) => row.id);
    const categoryIds = Array.from(
      new Set(productRows.map((row) => row.categoryId).filter((id): id is string => Boolean(id))),
    );
    const optionOverrideRows = await tx
      .select()
      .from(branchOptionValueOverrides)
      .where(
        and(
          eq(branchOptionValueOverrides.businessId, businessId),
          eq(branchOptionValueOverrides.branchId, branchId),
        ),
      );
    const optionOverridesByValueId = new Map(
      optionOverrideRows.map((row) => [row.optionValueId, row]),
    );
    const optionRows = await tx
      .select({ option: productOptions })
      .from(productOptions)
      .innerJoin(products, eq(productOptions.productId, products.id))
      .where(and(eq(products.businessId, businessId), inArray(productOptions.productId, productIds)))
      .orderBy(asc(productOptions.position), asc(productOptions.name));
    const optionIds = optionRows.map((row) => row.option.id);
    const valueRows =
      optionIds.length > 0
        ? await tx
            .select()
            .from(optionValues)
            .where(inArray(optionValues.optionId, optionIds))
            .orderBy(asc(optionValues.position), asc(optionValues.name))
        : [];
    const valuesByOption = bucketBy(valueRows, (row) => row.optionId);
    for (const row of optionRows) {
      const bucket = result.get(row.option.productId) ?? [];
      bucket.push({
        id: row.option.id,
        templateId: row.option.templateId,
        name: row.option.name,
        localizedNames: row.option.localizedNames,
        type: row.option.type,
        required: row.option.required,
        minSelect: row.option.minSelect,
        maxSelect: row.option.maxSelect,
        freeQuantity: row.option.freeQuantity,
        extraPrice: row.option.extraPrice,
        attachScope: "product",
        reusable: row.option.templateId !== null,
        source: "product",
        sourceCategoryId: null,
        sourceCategoryName: null,
        position: row.option.position,
        values: (valuesByOption.get(row.option.id) ?? [])
          .map((value) => {
            const override = optionOverridesByValueId.get(value.id);
            return {
              id: value.id,
              templateValueId: value.templateValueId,
              name: value.name,
              localizedNames: value.localizedNames,
              priceAddition: override?.priceAddition ?? value.priceAddition,
              position: value.position,
              available: override?.available ?? value.available,
              recipeHookKey: null,
            };
          })
          .filter((value) => value.available),
      });
      result.set(row.option.productId, bucket);
    }

    const categoryRows =
      categoryIds.length > 0
        ? await tx
            .select({
              attachment: categoryModifierGroups,
              group: modifierGroupTemplates,
              categoryName: categories.name,
            })
            .from(categoryModifierGroups)
            .innerJoin(categories, eq(categoryModifierGroups.categoryId, categories.id))
            .innerJoin(modifierGroupTemplates, eq(categoryModifierGroups.groupTemplateId, modifierGroupTemplates.id))
            .where(
              and(
                eq(categoryModifierGroups.businessId, businessId),
                eq(categories.businessId, businessId),
                inArray(categoryModifierGroups.categoryId, categoryIds),
                isNull(categories.deletedAt),
                isNull(modifierGroupTemplates.deletedAt),
              ),
            )
            .orderBy(asc(categoryModifierGroups.position), asc(modifierGroupTemplates.name))
        : [];
    const groupIds = categoryRows.map((row) => row.group.id);
    const templateValues =
      groupIds.length > 0
        ? await tx
            .select()
            .from(modifierValueTemplates)
            .where(
              and(
                eq(modifierValueTemplates.businessId, businessId),
                inArray(modifierValueTemplates.groupTemplateId, groupIds),
                isNull(modifierValueTemplates.deletedAt),
              ),
            )
            .orderBy(asc(modifierValueTemplates.position), asc(modifierValueTemplates.name))
        : [];
    const templateValuesByGroup = bucketBy(templateValues, (row) => row.groupTemplateId);
    for (const product of productRows) {
      if (!product.categoryId) continue;
      const inherited = categoryRows
        .filter((row) => row.attachment.categoryId === product.categoryId)
        .map((row) => ({
          id: row.group.id,
          templateId: row.group.id,
          name: row.group.name,
          localizedNames: row.group.localizedNames,
          type: row.group.type,
          required: row.group.required,
          minSelect: row.group.minSelect,
          maxSelect: row.group.maxSelect,
          freeQuantity: row.group.freeQuantity,
          extraPrice: row.group.extraPrice,
          attachScope: "category" as const,
          reusable: row.group.reusable,
          source: "category" as const,
          sourceCategoryId: row.attachment.categoryId,
          sourceCategoryName: row.categoryName,
          position: row.attachment.position,
          values: (templateValuesByGroup.get(row.group.id) ?? [])
            .filter((value) => value.available)
            .map((value) => ({
              id: value.id,
              templateValueId: value.id,
              name: value.name,
              localizedNames: value.localizedNames,
              priceAddition: value.priceAddition,
              position: value.position,
              available: value.available,
              recipeHookKey: value.recipeHookKey,
            })),
        }));
      if (inherited.length > 0) {
        result.set(product.id, [...(result.get(product.id) ?? []), ...inherited]);
      }
    }
    return result;
  }

  private async loadProductTags(
    tx: TenantedDrizzleClient,
    businessId: string,
    productIds: string[],
  ): Promise<Map<string, DietaryTagResponse[]>> {
    if (productIds.length === 0) return new Map();
    const rows = await tx
      .select({
        productId: productTags.productId,
        tag: dietaryTags,
      })
      .from(productTags)
      .innerJoin(dietaryTags, eq(productTags.tagId, dietaryTags.id))
      .where(
        and(
          eq(productTags.businessId, businessId),
          eq(dietaryTags.businessId, businessId),
          inArray(productTags.productId, productIds),
          isNull(dietaryTags.deletedAt),
        ),
      )
      .orderBy(asc(dietaryTags.kind), asc(dietaryTags.position), asc(dietaryTags.code));
    const tagsByProduct = new Map<string, DietaryTagResponse[]>();
    for (const row of rows) {
      const bucket = tagsByProduct.get(row.productId) ?? [];
      bucket.push({
        id: row.tag.id,
        kind: row.tag.kind,
        code: row.tag.code,
        localizedLabels: row.tag.localizedLabels,
        position: row.tag.position,
        isSystem: row.tag.isSystem,
      });
      tagsByProduct.set(row.productId, bucket);
    }
    return tagsByProduct;
  }

  private async loadAvailabilityWindows(
    tx: TenantedDrizzleClient,
    businessId: string,
    productIds: string[],
  ): Promise<Map<string, AvailabilityWindowResponse[]>> {
    if (productIds.length === 0) return new Map();
    const rows = await tx
      .select()
      .from(productAvailabilityWindows)
      .where(
        and(
          eq(productAvailabilityWindows.businessId, businessId),
          inArray(productAvailabilityWindows.productId, productIds),
        ),
      )
      .orderBy(
        asc(productAvailabilityWindows.productId),
        asc(productAvailabilityWindows.dayOfWeek),
        asc(productAvailabilityWindows.startMinute),
      );
    const windowsByProduct = new Map<string, AvailabilityWindowResponse[]>();
    for (const row of rows) {
      const bucket = windowsByProduct.get(row.productId) ?? [];
      bucket.push({
        id: row.id,
        dayOfWeek: row.dayOfWeek,
        startMinute: row.startMinute,
        endMinute: row.endMinute,
      });
      windowsByProduct.set(row.productId, bucket);
    }
    return windowsByProduct;
  }

  private isAvailableAt(
    windows: AvailabilityWindowResponse[],
    timezone: string,
    evaluationDate: Date,
  ): boolean {
    if (windows.length === 0) return true;
    const local = DateTime.fromJSDate(evaluationDate, { zone: "utc" }).setZone(timezone);
    const dayOfWeek = local.weekday % 7;
    const minute = local.hour * 60 + local.minute;
    return windows.some((window) => {
      if (window.startMinute <= window.endMinute) {
        return (
          window.dayOfWeek === dayOfWeek &&
          minute >= window.startMinute &&
          minute < window.endMinute
        );
      }
      const nextDay = (window.dayOfWeek + 1) % 7;
      return (
        (window.dayOfWeek === dayOfWeek && minute >= window.startMinute) ||
        (nextDay === dayOfWeek && minute < window.endMinute)
      );
    });
  }

  private resolveVariants(
    product: typeof products.$inferSelect,
    variants: Array<typeof productVariants.$inferSelect>,
    overridesByVariant: Map<string, typeof branchProductPriceOverrides.$inferSelect>,
  ): EffectiveMenuResponse["categories"][number]["products"][number]["variants"] {
    if (variants.length === 0) {
      return [
        {
          id: null,
          name: "Default",
          price: product.price,
          priceSource: "inherited",
          isDefault: true,
          available: product.available,
          position: 0,
          variantKind: "custom",
          pricingMode: "fixed",
          displayPriceLabel: null,
          displayPriceMin: null,
          displayPriceMax: null,
          unitLabel: null,
          synthetic: true,
        },
      ];
    }
    return variants
      .filter((variant) => variant.available)
      .map((variant) => {
        const override = overridesByVariant.get(variant.id);
        return {
          id: variant.id,
          name: variant.name,
          price:
            variant.pricingMode === "fixed"
              ? override?.price ?? variant.priceOverride ?? product.price
              : null,
          priceSource: override ? "overridden" : "inherited",
          isDefault: variant.isDefault,
          available: variant.available,
          position: variant.position,
          variantKind: variant.variantKind,
          pricingMode: variant.pricingMode,
          displayPriceLabel: variant.displayPriceLabel,
          displayPriceMin: variant.displayPriceMin,
          displayPriceMax: variant.displayPriceMax,
          unitLabel: variant.unitLabel,
          synthetic: false,
        };
      });
  }

  private resolveTaxRate(
    product: typeof products.$inferSelect,
    defaultTaxRate: { taxRateId: string; isExplicit: boolean },
    productTaxById: Map<string, string>,
    categoryTaxById: Map<string, string>,
  ): { taxRateId: string; source: "product" | "category" | "branch_default" | "fallback" } {
    const productOverride = productTaxById.get(product.id);
    if (productOverride) return { taxRateId: productOverride, source: "product" };
    const categoryOverride = product.categoryId ? categoryTaxById.get(product.categoryId) : undefined;
    if (categoryOverride) return { taxRateId: categoryOverride, source: "category" };
    if (defaultTaxRate.isExplicit) {
      return { taxRateId: defaultTaxRate.taxRateId, source: "branch_default" };
    }
    return { taxRateId: DEFAULT_TAX_RATE_ID, source: "fallback" };
  }

  private resolvePrintStations(
    product: typeof products.$inferSelect,
    productRoutesById: Map<string, string[]>,
    categoryRoutesById: Map<string, string[]>,
    legacyRoutesByCategoryId: Map<string, string[]>,
  ): { stations: string[]; source: "product" | "category" | "legacy" | "all" } {
    const productRoutes = productRoutesById.get(product.id);
    if (productRoutes && productRoutes.length > 0) {
      return { stations: productRoutes, source: "product" };
    }
    const categoryRoutes = product.categoryId ? categoryRoutesById.get(product.categoryId) : undefined;
    if (categoryRoutes && categoryRoutes.length > 0) {
      return { stations: categoryRoutes, source: "category" };
    }
    const legacyRoutes = product.categoryId ? legacyRoutesByCategoryId.get(product.categoryId) : undefined;
    if (legacyRoutes && legacyRoutes.length > 0) {
      return { stations: legacyRoutes, source: "legacy" };
    }
    return { stations: [...ALL_PRINT_STATIONS], source: "all" };
  }

  private isProductVisibleForChannel(
    product: typeof products.$inferSelect,
    override: typeof branchProductOverrides.$inferSelect | undefined,
    channel: MenuChannel,
  ): boolean {
    if (product.hidden || product.deletedAt) return false;
    if ((override?.hidden ?? false) === true) return false;
    if ((override?.available ?? product.available) === false) return false;
    if (override?.is86d) return false;
    if (channel === "pos") return true;
    const channels = {
      dine_in: override?.availableDineIn ?? product.availableDineIn,
      takeaway: override?.availableTakeaway ?? product.availableTakeaway,
      delivery: override?.availableDelivery ?? product.availableDelivery,
      qr: override?.availableQr ?? product.availableQr,
      online: override?.availableOnline ?? product.availableOnline,
    };
    return channels[channel];
  }

  private toCategoryTree(
    rows: EffectiveMenuResponse["categories"],
  ): EffectiveMenuResponse["categories"] {
    const byParent = new Map<string | null, EffectiveMenuResponse["categories"]>();
    for (const row of rows.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))) {
      const bucket = byParent.get(row.parentId) ?? [];
      bucket.push(row);
      byParent.set(row.parentId, bucket);
    }
    for (const row of rows) {
      row.children = byParent.get(row.id) ?? [];
    }
    return byParent.get(null) ?? [];
  }

  private async getDefaultTaxRateId(
    tx: TenantedDrizzleClient,
    businessId: string,
    branchId: string,
  ): Promise<{ taxRateId: string; isExplicit: boolean }> {
    const [row] = await tx
      .select({ id: branchTaxSettings.defaultTaxRateId })
      .from(branchTaxSettings)
      .where(
        and(
          eq(branchTaxSettings.businessId, businessId),
          eq(branchTaxSettings.branchId, branchId),
        ),
      )
      .limit(1);
    return row
      ? { taxRateId: row.id, isExplicit: true }
      : { taxRateId: DEFAULT_TAX_RATE_ID, isExplicit: false };
  }

  private async assertBranch(
    tx: TenantedDrizzleClient,
    businessId: string,
    branchId: string,
  ): Promise<{ timezone: string }> {
    const [branch] = await tx
      .select({
        id: branches.id,
        branchTimezone: branches.timezone,
        businessTimezone: businesses.timezone,
      })
      .from(branches)
      .innerJoin(businesses, eq(branches.businessId, businesses.id))
      .where(
        and(
          eq(branches.businessId, businessId),
          eq(branches.id, branchId),
          isNull(branches.deletedAt),
        ),
      )
      .limit(1);
    if (!branch) throw new NotFoundException("Branch not found");
    return { timezone: branch.branchTimezone ?? branch.businessTimezone ?? "Africa/Casablanca" };
  }

  private async assertProduct(
    tx: TenantedDrizzleClient,
    businessId: string,
    productId: string,
  ): Promise<void> {
    const [product] = await tx
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          eq(products.businessId, businessId),
          eq(products.id, productId),
          isNull(products.deletedAt),
        ),
      )
      .limit(1);
    if (!product) throw new NotFoundException("Product not found");
  }

  private async assertCategory(
    tx: TenantedDrizzleClient,
    businessId: string,
    categoryId: string,
  ): Promise<void> {
    const [category] = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.businessId, businessId),
          eq(categories.id, categoryId),
          isNull(categories.deletedAt),
        ),
      )
      .limit(1);
    if (!category) throw new NotFoundException("Category not found");
  }

  private async assertTaxRate(
    tx: TenantedDrizzleClient,
    taxRateId: string,
  ): Promise<void> {
    const [rate] = await tx
      .select({ id: taxRates.id })
      .from(taxRates)
      .where(and(eq(taxRates.id, taxRateId), eq(taxRates.isActive, true)))
      .limit(1);
    if (!rate) throw new NotFoundException("Tax rate not found");
  }

  private async findProductOverride(
    tx: TenantedDrizzleClient,
    businessId: string,
    branchId: string,
    productId: string,
  ) {
    const [row] = await tx
      .select()
      .from(branchProductOverrides)
      .where(
        and(
          eq(branchProductOverrides.businessId, businessId),
          eq(branchProductOverrides.branchId, branchId),
          eq(branchProductOverrides.productId, productId),
        ),
      )
      .limit(1);
    return row;
  }
}

function bucketBy<T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const result = new Map<K, T[]>();
  for (const row of rows) {
    const bucket = result.get(key(row)) ?? [];
    bucket.push(row);
    result.set(key(row), bucket);
  }
  return result;
}

function stationSetById<T extends { station: string }>(rows: T[], id: (row: T) => string): Map<string, string[]> {
  return new Map(
    groupRouteRows(rows, id).map(([rowId, stations]) => [rowId, stations.sort()]),
  );
}

function groupRouteRows<T extends { station: string }>(
  rows: T[],
  id: (row: T) => string,
): Array<[string, string[]]> {
  const grouped = new Map<string, Set<string>>();
  for (const row of rows) {
    const bucket = grouped.get(id(row)) ?? new Set<string>();
    bucket.add(row.station);
    grouped.set(id(row), bucket);
  }
  return Array.from(grouped.entries()).map(([rowId, stations]) => [
    rowId,
    Array.from(stations).sort(),
  ]);
}
