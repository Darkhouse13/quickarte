import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  branchCategoryOverrides,
  branchOptionValueOverrides,
  branchProductOverrides,
  branchProductPriceOverrides,
  branchTaxSettings,
  branches,
  categories,
  categoryModifierGroups,
  modifierGroupTemplates,
  modifierValueTemplates,
  optionValues,
  productOptions,
  products,
  productVariants,
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
  UpdateProductAvailabilityInput,
} from "./branch-menu.schemas";
import type { ModifierGroupResponse } from "./menu-catalog.schemas";

const DEFAULT_TAX_RATE_ID = "ma_tva_10";

@Injectable()
export class EffectiveMenuResolver {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
  ) {}

  async getEffectiveMenu(
    businessId: string,
    branchId: string,
    channel: MenuChannel,
  ): Promise<EffectiveMenuResponse> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      await this.assertBranch(tx, businessId, branchId);
      const defaultTaxRateId = await this.getDefaultTaxRateId(tx, businessId, branchId);
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
          effectiveTaxRateId: defaultTaxRateId,
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
        defaultTaxRateId,
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
      const [categoryRows, productRows, priceRows, optionRows] = await Promise.all([
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
  ): Promise<string> {
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
    return row?.id ?? DEFAULT_TAX_RATE_ID;
  }

  private async assertBranch(
    tx: TenantedDrizzleClient,
    businessId: string,
    branchId: string,
  ): Promise<void> {
    const [branch] = await tx
      .select({ id: branches.id })
      .from(branches)
      .where(
        and(
          eq(branches.businessId, businessId),
          eq(branches.id, branchId),
          isNull(branches.deletedAt),
        ),
      )
      .limit(1);
    if (!branch) throw new NotFoundException("Branch not found");
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
