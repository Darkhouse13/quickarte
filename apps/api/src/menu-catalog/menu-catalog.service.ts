import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  categories,
  categoryModifierGroups,
  menuLocaleSettings,
  modifierGroupTemplates,
  modifierValueTemplates,
  optionValues,
  productImages,
  productOptions,
  products,
  productVariants,
} from "@quickarte/db-schema";
import { and, asc, eq, ilike, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import {
  DatabaseService,
  type TenantedDrizzleClient,
} from "../database/database.service";
import type {
  CategoryResponse,
  AttachModifierGroupsInput,
  CreateCategoryInput,
  CreateProductInput,
  ImageResponse,
  ModifierGroupInput,
  ModifierGroupResponse,
  ModifierGroupTemplateResponse,
  ProductResponse,
  UpdateModifierGroupInput,
  ReplaceImagesInput,
  ReplaceVariantsInput,
  UpdateCategoryInput,
  UpdateLocaleSettingsInput,
  UpdateProductInput,
  VariantResponse,
} from "./menu-catalog.schemas";

const PROBLEM_BASE_URL = "https://api.quickarte.ma/problems";
const AVAILABLE_MENU_LOCALES = ["fr", "ar", "en", "es"];

@Injectable()
export class MenuCatalogService {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
  ) {}

  async listModifierGroups(businessId: string): Promise<ModifierGroupTemplateResponse[]> {
    return this.databaseService.withTenant(businessId, (tx) =>
      this.listModifierGroupsInsideTenant(tx, businessId),
    );
  }

  async createModifierGroup(
    businessId: string,
    input: ModifierGroupInput,
  ): Promise<ModifierGroupTemplateResponse> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      this.validateModifierGroup(input);
      const fallbackName = await this.fallbackText(tx, businessId, input.localizedNames);
      const [created] = await tx
        .insert(modifierGroupTemplates)
        .values({
          businessId,
          name: input.name?.trim() || fallbackName,
          localizedNames: input.localizedNames,
          type: input.type,
          required: input.required,
          minSelect: input.minSelect,
          maxSelect: input.maxSelect ?? null,
          freeQuantity: input.freeQuantity,
          extraPrice: input.extraPrice ?? null,
          attachScope: input.attachScope,
          reusable: input.reusable,
        })
        .returning();
      if (!created) throw new Error("Modifier group creation failed");
      await this.replaceModifierValueRows(tx, businessId, created.id, input.values);
      return this.getModifierGroupInsideTenant(tx, businessId, created.id);
    });
  }

  async updateModifierGroup(
    businessId: string,
    groupId: string,
    input: UpdateModifierGroupInput,
  ): Promise<ModifierGroupTemplateResponse> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      const existing = await this.findModifierGroupRow(tx, businessId, groupId);
      const merged: ModifierGroupInput = {
        name: input.name ?? existing.name,
        localizedNames: input.localizedNames ?? existing.localizedNames,
        type: input.type ?? existing.type,
        required: input.required ?? existing.required,
        minSelect: input.minSelect ?? existing.minSelect,
        maxSelect: input.maxSelect === undefined ? existing.maxSelect : input.maxSelect,
        freeQuantity: input.freeQuantity ?? existing.freeQuantity,
        extraPrice: input.extraPrice === undefined ? existing.extraPrice : input.extraPrice,
        attachScope: input.attachScope ?? existing.attachScope,
        reusable: input.reusable ?? existing.reusable,
        values: input.values ?? (await this.listModifierValueInputs(tx, businessId, groupId)),
      };
      this.validateModifierGroup(merged);
      const fallbackName = input.localizedNames
        ? await this.fallbackText(tx, businessId, input.localizedNames)
        : existing.name;
      await tx
        .update(modifierGroupTemplates)
        .set({
          name: input.name?.trim() || fallbackName,
          localizedNames: merged.localizedNames,
          type: merged.type,
          required: merged.required,
          minSelect: merged.minSelect,
          maxSelect: merged.maxSelect ?? null,
          freeQuantity: merged.freeQuantity,
          extraPrice: merged.extraPrice ?? null,
          attachScope: merged.attachScope,
          reusable: merged.reusable,
          updatedAt: new Date(),
        })
        .where(and(eq(modifierGroupTemplates.businessId, businessId), eq(modifierGroupTemplates.id, groupId)));
      if (input.values) {
        await this.replaceModifierValueRows(tx, businessId, groupId, input.values);
      }
      return this.getModifierGroupInsideTenant(tx, businessId, groupId);
    });
  }

  async softDeleteModifierGroup(businessId: string, groupId: string): Promise<void> {
    await this.databaseService.withTenant(businessId, async (tx) => {
      await this.findModifierGroupRow(tx, businessId, groupId);
      await tx
        .update(modifierGroupTemplates)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(modifierGroupTemplates.businessId, businessId), eq(modifierGroupTemplates.id, groupId)));
    });
  }

  async attachModifierGroupsToProduct(
    businessId: string,
    productId: string,
    input: AttachModifierGroupsInput,
  ): Promise<ModifierGroupResponse[]> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      const product = await this.findProductRow(tx, businessId, productId);
      const groups = await this.findModifierGroupRows(tx, businessId, input.groupTemplateIds);
      await tx
        .delete(productOptions)
        .where(
          and(
            eq(productOptions.productId, productId),
            isNotNull(productOptions.templateId),
          ),
        );

      for (const [index, group] of groups.entries()) {
        const [createdOption] = await tx
          .insert(productOptions)
          .values({
            productId,
            templateId: group.id,
            name: group.name,
            localizedNames: group.localizedNames,
            type: group.type,
            required: group.required,
            minSelect: group.minSelect,
            maxSelect: group.maxSelect,
            freeQuantity: group.freeQuantity,
            extraPrice: group.extraPrice,
            position: index,
            available: true,
          })
          .returning();
        if (!createdOption) throw new Error("Product modifier materialization failed");
        const values = await this.listModifierValueRows(tx, businessId, group.id);
        if (values.length > 0) {
          await tx.insert(optionValues).values(
            values.map((value) => ({
              optionId: createdOption.id,
              templateValueId: value.id,
              name: value.name,
              localizedNames: value.localizedNames,
              priceAddition: value.priceAddition,
              position: value.position,
              available: value.available,
            })),
          );
        }
      }

      return (await this.hydrateProductModifiers(tx, businessId, [product])).get(productId) ?? [];
    });
  }

  async attachModifierGroupsToCategory(
    businessId: string,
    categoryId: string,
    input: AttachModifierGroupsInput,
  ): Promise<ModifierGroupResponse[]> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      const category = await this.findCategoryRow(tx, businessId, categoryId);
      const groups = await this.findModifierGroupRows(tx, businessId, input.groupTemplateIds);
      await tx
        .delete(categoryModifierGroups)
        .where(
          and(
            eq(categoryModifierGroups.businessId, businessId),
            eq(categoryModifierGroups.categoryId, categoryId),
          ),
        );
      if (groups.length > 0) {
        await tx.insert(categoryModifierGroups).values(
          groups.map((group, index) => ({
            businessId,
            categoryId,
            groupTemplateId: group.id,
            position: index,
          })),
        );
      }

      const syntheticProduct = {
        id: "__category_preview__",
        categoryId: category.id,
      } as typeof products.$inferSelect;
      return (
        (await this.hydrateProductModifiers(tx, businessId, [syntheticProduct])).get(
          syntheticProduct.id,
        ) ?? []
      ).filter((group) => group.source === "category");
    });
  }

  async listCategories(businessId: string): Promise<CategoryResponse[]> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      const rows = await tx
        .select()
        .from(categories)
        .where(and(eq(categories.businessId, businessId), isNull(categories.deletedAt)))
        .orderBy(asc(categories.parentId), asc(categories.position), asc(categories.name));

      return this.toCategoryTree(rows);
    });
  }

  async createCategory(
    businessId: string,
    input: CreateCategoryInput,
  ): Promise<CategoryResponse> {
    const category = await this.databaseService.withTenant(businessId, async (tx) => {
      await this.assertParentCanAcceptChild(tx, businessId, input.parentId ?? null);
      const fallbackName = await this.fallbackText(tx, businessId, input.localizedNames);

      if (input.slug) {
        await this.assertCategorySlugAvailable(tx, businessId, input.slug);
      }

      const [created] = await tx
        .insert(categories)
        .values({
          businessId,
          parentId: input.parentId ?? null,
          name: input.name?.trim() || fallbackName,
          slug: input.slug ?? null,
          description: input.description ?? null,
          localizedNames: input.localizedNames,
          localizedDescriptions: input.localizedDescriptions ?? {},
          colorTag: input.colorTag ?? null,
          visible: input.visible ?? true,
          position: input.position ?? 0,
        })
        .returning();

      if (!created) {
        throw new Error("Category creation failed");
      }
      return created;
    });

    return { ...this.toCategory(category), children: [] };
  }

  async updateCategory(
    businessId: string,
    categoryId: string,
    input: UpdateCategoryInput,
  ): Promise<CategoryResponse> {
    const category = await this.databaseService.withTenant(businessId, async (tx) => {
      const existing = await this.findCategoryRow(tx, businessId, categoryId);
      await this.assertParentCanAcceptChild(tx, businessId, input.parentId ?? existing.parentId, categoryId);

      if (input.slug) {
        await this.assertCategorySlugAvailable(tx, businessId, input.slug, categoryId);
      }

      const fallbackName = input.localizedNames
        ? await this.fallbackText(tx, businessId, input.localizedNames)
        : existing.name;

      const [updated] = await tx
        .update(categories)
        .set({
          parentId: input.parentId === undefined ? existing.parentId : input.parentId,
          name: input.name?.trim() || fallbackName,
          slug: input.slug === undefined ? existing.slug : input.slug,
          description:
            input.description === undefined ? existing.description : input.description,
          localizedNames: input.localizedNames ?? existing.localizedNames,
          localizedDescriptions:
            input.localizedDescriptions ?? existing.localizedDescriptions,
          colorTag: input.colorTag === undefined ? existing.colorTag : input.colorTag,
          visible: input.visible ?? existing.visible,
          position: input.position ?? existing.position,
          updatedAt: new Date(),
        })
        .where(and(eq(categories.businessId, businessId), eq(categories.id, categoryId)))
        .returning();

      if (!updated) {
        throw new NotFoundException("Category not found");
      }
      return updated;
    });

    return { ...this.toCategory(category), children: [] };
  }

  async softDeleteCategory(businessId: string, categoryId: string): Promise<void> {
    await this.databaseService.withTenant(businessId, async (tx) => {
      await this.findCategoryRow(tx, businessId, categoryId);
      await tx
        .update(categories)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(categories.businessId, businessId), eq(categories.id, categoryId)));
    });
  }

  async reorderCategories(
    businessId: string,
    input: { categories: Array<{ id: string; parentId: string | null; position: number }> },
  ): Promise<CategoryResponse[]> {
    await this.databaseService.withTenant(businessId, async (tx) => {
      for (const row of input.categories) {
        await this.findCategoryRow(tx, businessId, row.id);
        await this.assertParentCanAcceptChild(tx, businessId, row.parentId, row.id);
        await tx
          .update(categories)
          .set({ parentId: row.parentId, position: row.position, updatedAt: new Date() })
          .where(and(eq(categories.businessId, businessId), eq(categories.id, row.id)));
      }
    });
    return this.listCategories(businessId);
  }

  async listProducts(
    businessId: string,
    filters: { categoryId?: string; search?: string; includeHidden?: boolean },
  ): Promise<ProductResponse[]> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      const predicates = [
        eq(products.businessId, businessId),
        isNull(products.deletedAt),
      ];
      if (!filters.includeHidden) predicates.push(eq(products.hidden, false));
      if (filters.categoryId) predicates.push(eq(products.categoryId, filters.categoryId));
      if (filters.search) {
        predicates.push(
          or(
            ilike(products.name, `%${filters.search}%`),
            ilike(products.description, `%${filters.search}%`),
            ilike(products.sku, `%${filters.search}%`),
            ilike(products.itemCode, `%${filters.search}%`),
          )!,
        );
      }

      const rows = await tx
        .select()
        .from(products)
        .where(and(...predicates))
        .orderBy(asc(products.categoryId), asc(products.position), asc(products.name));

      return this.hydrateProducts(tx, businessId, rows);
    });
  }

  async createProduct(
    businessId: string,
    input: CreateProductInput,
  ): Promise<ProductResponse> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      if (input.categoryId) {
        await this.findCategoryRow(tx, businessId, input.categoryId);
      }
      this.validateVariants(input.variants, input.basePrice);
      const fallbackName = await this.fallbackText(tx, businessId, input.localizedNames);
      const fallbackDescription = await this.optionalFallbackText(
        tx,
        businessId,
        input.localizedDescriptions ?? {},
      );

      const [created] = await tx
        .insert(products)
        .values({
          businessId,
          categoryId: input.categoryId ?? null,
          name: fallbackName,
          description: fallbackDescription,
          price: input.basePrice,
          image: this.primaryImageUrl(input.images),
          sku: input.sku ?? null,
          itemCode: input.itemCode ?? null,
          colorTag: input.colorTag ?? null,
          featured: input.featured,
          hidden: input.hidden,
          available: input.available,
          availableDineIn: input.channels.dineIn,
          availableTakeaway: input.channels.takeaway,
          availableDelivery: input.channels.delivery,
          availableQr: input.channels.qr,
          availableOnline: input.channels.online,
          localizedNames: input.localizedNames,
          localizedDescriptions: input.localizedDescriptions ?? {},
          position: input.position,
        })
        .returning();

      if (!created) throw new Error("Product creation failed");
      await this.replaceVariantRows(tx, businessId, created.id, input.variants, created.price);
      await this.replaceImageRows(tx, businessId, created.id, input.images);
      return this.getProductInsideTenant(tx, businessId, created.id);
    });
  }

  async getProduct(businessId: string, productId: string): Promise<ProductResponse> {
    return this.databaseService.withTenant(businessId, (tx) =>
      this.getProductInsideTenant(tx, businessId, productId),
    );
  }

  async updateProduct(
    businessId: string,
    productId: string,
    input: UpdateProductInput,
  ): Promise<ProductResponse> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      const existing = await this.findProductRow(tx, businessId, productId);
      if (input.categoryId) {
        await this.findCategoryRow(tx, businessId, input.categoryId);
      }
      if (input.variants) {
        this.validateVariants(input.variants, input.basePrice ?? existing.price);
      }

      const localizedNames = input.localizedNames ?? existing.localizedNames;
      const localizedDescriptions =
        input.localizedDescriptions ?? existing.localizedDescriptions;
      const fallbackName = input.localizedNames
        ? await this.fallbackText(tx, businessId, input.localizedNames)
        : existing.name;
      const fallbackDescription = input.localizedDescriptions
        ? await this.optionalFallbackText(tx, businessId, input.localizedDescriptions)
        : existing.description;

      await tx
        .update(products)
        .set({
          categoryId: input.categoryId === undefined ? existing.categoryId : input.categoryId,
          name: fallbackName,
          description: fallbackDescription,
          price: input.basePrice ?? existing.price,
          sku: input.sku === undefined ? existing.sku : input.sku,
          itemCode: input.itemCode === undefined ? existing.itemCode : input.itemCode,
          colorTag: input.colorTag === undefined ? existing.colorTag : input.colorTag,
          featured: input.featured ?? existing.featured,
          hidden: input.hidden ?? existing.hidden,
          available: input.available ?? existing.available,
          availableDineIn: input.channels?.dineIn ?? existing.availableDineIn,
          availableTakeaway: input.channels?.takeaway ?? existing.availableTakeaway,
          availableDelivery: input.channels?.delivery ?? existing.availableDelivery,
          availableQr: input.channels?.qr ?? existing.availableQr,
          availableOnline: input.channels?.online ?? existing.availableOnline,
          localizedNames,
          localizedDescriptions,
          position: input.position ?? existing.position,
          updatedAt: new Date(),
        })
        .where(and(eq(products.businessId, businessId), eq(products.id, productId)));

      if (input.variants) {
        await this.replaceVariantRows(
          tx,
          businessId,
          productId,
          input.variants,
          input.basePrice ?? existing.price,
        );
      }
      if (input.images) {
        await this.replaceImageRows(tx, businessId, productId, input.images);
      }
      return this.getProductInsideTenant(tx, businessId, productId);
    });
  }

  async softDeleteProduct(businessId: string, productId: string): Promise<void> {
    await this.databaseService.withTenant(businessId, async (tx) => {
      await this.findProductRow(tx, businessId, productId);
      await tx
        .update(products)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(products.businessId, businessId), eq(products.id, productId)));
    });
  }

  async reorderProducts(
    businessId: string,
    input: { products: Array<{ id: string; categoryId: string | null; position: number }> },
  ): Promise<ProductResponse[]> {
    await this.databaseService.withTenant(businessId, async (tx) => {
      for (const row of input.products) {
        await this.findProductRow(tx, businessId, row.id);
        if (row.categoryId) await this.findCategoryRow(tx, businessId, row.categoryId);
        await tx
          .update(products)
          .set({
            categoryId: row.categoryId,
            position: row.position,
            updatedAt: new Date(),
          })
          .where(and(eq(products.businessId, businessId), eq(products.id, row.id)));
      }
    });
    return this.listProducts(businessId, { includeHidden: true });
  }

  async replaceVariants(
    businessId: string,
    productId: string,
    input: ReplaceVariantsInput,
  ): Promise<VariantResponse[]> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      const product = await this.findProductRow(tx, businessId, productId);
      this.validateVariants(input.variants, product.price);
      await this.replaceVariantRows(tx, businessId, productId, input.variants, product.price);
      const hydrated = await this.getProductInsideTenant(tx, businessId, productId);
      return hydrated.variants;
    });
  }

  async replaceImages(
    businessId: string,
    productId: string,
    input: ReplaceImagesInput,
  ): Promise<ImageResponse[]> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      await this.findProductRow(tx, businessId, productId);
      await this.replaceImageRows(tx, businessId, productId, input.images);
      const hydrated = await this.getProductInsideTenant(tx, businessId, productId);
      return hydrated.images;
    });
  }

  async getLocaleSettings(businessId: string) {
    return this.databaseService.withTenant(businessId, async (tx) => {
      const [row] = await tx
        .select()
        .from(menuLocaleSettings)
        .where(eq(menuLocaleSettings.businessId, businessId))
        .limit(1);
      return {
        activeLocales: row?.activeLocales ?? ["fr"],
        defaultLocale: row?.defaultLocale ?? "fr",
        availableLocales: AVAILABLE_MENU_LOCALES,
      };
    });
  }

  async updateLocaleSettings(businessId: string, input: UpdateLocaleSettingsInput) {
    if (!input.activeLocales.includes(input.defaultLocale)) {
      throw new BadRequestException({
        type: `${PROBLEM_BASE_URL}/menu-locale-default-not-active`,
        message: "The default locale must be active.",
      });
    }

    await this.databaseService.withTenant(businessId, async (tx) => {
      await tx
        .insert(menuLocaleSettings)
        .values({
          businessId,
          activeLocales: input.activeLocales,
          defaultLocale: input.defaultLocale,
        })
        .onConflictDoUpdate({
          target: menuLocaleSettings.businessId,
          set: {
            activeLocales: input.activeLocales,
            defaultLocale: input.defaultLocale,
            updatedAt: sql`now()`,
          },
        });
    });
    return this.getLocaleSettings(businessId);
  }

  private async hydrateProducts(
    tx: TenantedDrizzleClient,
    businessId: string,
    rows: Array<typeof products.$inferSelect>,
  ): Promise<ProductResponse[]> {
    if (rows.length === 0) return [];
    const productIds = rows.map((row) => row.id);
    const variantRows = await tx
      .select({
        variant: productVariants,
        productBusinessId: products.businessId,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(and(eq(products.businessId, businessId), inArray(productVariants.productId, productIds)))
      .orderBy(asc(productVariants.position));
    const imageRows = await tx
      .select()
      .from(productImages)
      .where(and(eq(productImages.businessId, businessId), inArray(productImages.productId, productIds)))
      .orderBy(asc(productImages.position));
    const modifiersByProduct = await this.hydrateProductModifiers(tx, businessId, rows);

    return rows.map((row) =>
      this.toProductResponse(
        row,
        variantRows
          .filter((variantRow) => variantRow.variant.productId === row.id)
          .map((variantRow) => variantRow.variant),
        imageRows.filter((image) => image.productId === row.id),
        modifiersByProduct.get(row.id) ?? [],
      ),
    );
  }

  private async listModifierGroupsInsideTenant(
    tx: TenantedDrizzleClient,
    businessId: string,
  ): Promise<ModifierGroupTemplateResponse[]> {
    const rows = await tx
      .select()
      .from(modifierGroupTemplates)
      .where(
        and(
          eq(modifierGroupTemplates.businessId, businessId),
          isNull(modifierGroupTemplates.deletedAt),
        ),
      )
      .orderBy(asc(modifierGroupTemplates.name));
    if (rows.length === 0) return [];
    const valuesByGroup = await this.listModifierValuesByGroup(
      tx,
      businessId,
      rows.map((row) => row.id),
    );
    return rows.map((row) =>
      this.toModifierGroupTemplateResponse(row, valuesByGroup.get(row.id) ?? []),
    );
  }

  private async getModifierGroupInsideTenant(
    tx: TenantedDrizzleClient,
    businessId: string,
    groupId: string,
  ): Promise<ModifierGroupTemplateResponse> {
    const row = await this.findModifierGroupRow(tx, businessId, groupId);
    const values = await this.listModifierValueRows(tx, businessId, groupId);
    return this.toModifierGroupTemplateResponse(row, values);
  }

  private async findModifierGroupRow(
    tx: TenantedDrizzleClient,
    businessId: string,
    groupId: string,
  ) {
    const [row] = await tx
      .select()
      .from(modifierGroupTemplates)
      .where(
        and(
          eq(modifierGroupTemplates.businessId, businessId),
          eq(modifierGroupTemplates.id, groupId),
          isNull(modifierGroupTemplates.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Modifier group not found");
    return row;
  }

  private async findModifierGroupRows(
    tx: TenantedDrizzleClient,
    businessId: string,
    groupIds: string[],
  ) {
    if (groupIds.length === 0) return [];
    const rows = await tx
      .select()
      .from(modifierGroupTemplates)
      .where(
        and(
          eq(modifierGroupTemplates.businessId, businessId),
          inArray(modifierGroupTemplates.id, groupIds),
          isNull(modifierGroupTemplates.deletedAt),
        ),
      );
    if (rows.length !== new Set(groupIds).size) {
      throw new NotFoundException("Modifier group not found");
    }
    const byId = new Map(rows.map((row) => [row.id, row]));
    return groupIds.map((id) => byId.get(id)!);
  }

  private async replaceModifierValueRows(
    tx: TenantedDrizzleClient,
    businessId: string,
    groupId: string,
    values: ModifierGroupInput["values"],
  ): Promise<void> {
    await tx
      .delete(modifierValueTemplates)
      .where(
        and(
          eq(modifierValueTemplates.businessId, businessId),
          eq(modifierValueTemplates.groupTemplateId, groupId),
        ),
      );
    if (values.length === 0) return;
    await tx.insert(modifierValueTemplates).values(
      values.map((value, index) => ({
        id: value.id,
        businessId,
        groupTemplateId: groupId,
        name: value.name,
        localizedNames: value.localizedNames,
        priceAddition: value.priceAddition,
        position: value.position ?? index,
        available: value.available,
        recipeHookKey: value.recipeHookKey ?? null,
      })),
    );
  }

  private async listModifierValueRows(
    tx: TenantedDrizzleClient,
    businessId: string,
    groupId: string,
  ) {
    return tx
      .select()
      .from(modifierValueTemplates)
      .where(
        and(
          eq(modifierValueTemplates.businessId, businessId),
          eq(modifierValueTemplates.groupTemplateId, groupId),
          isNull(modifierValueTemplates.deletedAt),
        ),
      )
      .orderBy(asc(modifierValueTemplates.position), asc(modifierValueTemplates.name));
  }

  private async listModifierValueInputs(
    tx: TenantedDrizzleClient,
    businessId: string,
    groupId: string,
  ): Promise<ModifierGroupInput["values"]> {
    const rows = await this.listModifierValueRows(tx, businessId, groupId);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      localizedNames: row.localizedNames,
      priceAddition: row.priceAddition,
      position: row.position,
      available: row.available,
      recipeHookKey: row.recipeHookKey,
    }));
  }

  private async listModifierValuesByGroup(
    tx: TenantedDrizzleClient,
    businessId: string,
    groupIds: string[],
  ) {
    const valuesByGroup = new Map<string, Array<typeof modifierValueTemplates.$inferSelect>>();
    if (groupIds.length === 0) return valuesByGroup;
    const rows = await tx
      .select()
      .from(modifierValueTemplates)
      .where(
        and(
          eq(modifierValueTemplates.businessId, businessId),
          inArray(modifierValueTemplates.groupTemplateId, groupIds),
          isNull(modifierValueTemplates.deletedAt),
        ),
      )
      .orderBy(asc(modifierValueTemplates.position), asc(modifierValueTemplates.name));
    for (const row of rows) {
      const bucket = valuesByGroup.get(row.groupTemplateId) ?? [];
      bucket.push(row);
      valuesByGroup.set(row.groupTemplateId, bucket);
    }
    return valuesByGroup;
  }

  private validateModifierGroup(input: ModifierGroupInput): void {
    if (input.maxSelect !== null && input.maxSelect !== undefined && input.maxSelect < input.minSelect) {
      throw new BadRequestException({
        type: `${PROBLEM_BASE_URL}/modifier-selection-bounds-invalid`,
        message: "max_select must be greater than or equal to min_select.",
      });
    }
    if (input.type === "single_select" && input.maxSelect && input.maxSelect > 1) {
      throw new BadRequestException({
        type: `${PROBLEM_BASE_URL}/modifier-single-select-max-invalid`,
        message: "single_select groups cannot allow more than one selection.",
      });
    }
    if (input.required && input.minSelect < 1) {
      throw new BadRequestException({
        type: `${PROBLEM_BASE_URL}/modifier-required-min-invalid`,
        message: "Required modifier groups must require at least one selection.",
      });
    }
  }

  private async hydrateProductModifiers(
    tx: TenantedDrizzleClient,
    businessId: string,
    rows: Array<typeof products.$inferSelect>,
  ): Promise<Map<string, ModifierGroupResponse[]>> {
    const result = new Map<string, ModifierGroupResponse[]>();
    if (rows.length === 0) return result;
    const productIds = rows.map((row) => row.id).filter((id) => id !== "__category_preview__");
    const categoryIds = Array.from(
      new Set(rows.map((row) => row.categoryId).filter((id): id is string => Boolean(id))),
    );

    const optionRows =
      productIds.length > 0
        ? await tx
            .select({ option: productOptions })
            .from(productOptions)
            .innerJoin(products, eq(productOptions.productId, products.id))
            .where(
              and(
                eq(products.businessId, businessId),
                inArray(productOptions.productId, productIds),
              ),
            )
            .orderBy(asc(productOptions.position), asc(productOptions.name))
        : [];
    const optionIds = optionRows.map((row) => row.option.id);
    const valueRows =
      optionIds.length > 0
        ? await tx
            .select()
            .from(optionValues)
            .where(inArray(optionValues.optionId, optionIds))
            .orderBy(asc(optionValues.position), asc(optionValues.name))
        : [];
    const productValuesByOption = new Map<string, Array<typeof optionValues.$inferSelect>>();
    for (const row of valueRows) {
      const bucket = productValuesByOption.get(row.optionId) ?? [];
      bucket.push(row);
      productValuesByOption.set(row.optionId, bucket);
    }

    for (const row of optionRows) {
      const bucket = result.get(row.option.productId) ?? [];
      bucket.push(this.toProductModifierGroupResponse(row.option, productValuesByOption.get(row.option.id) ?? []));
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
            .innerJoin(
              modifierGroupTemplates,
              eq(categoryModifierGroups.groupTemplateId, modifierGroupTemplates.id),
            )
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
    const templateValuesByGroup = await this.listModifierValuesByGroup(tx, businessId, groupIds);

    for (const product of rows) {
      if (!product.categoryId) continue;
      const inheritedGroups = categoryRows
        .filter((row) => row.attachment.categoryId === product.categoryId)
        .map((row) =>
          this.toCategoryModifierGroupResponse(
            row.group,
            templateValuesByGroup.get(row.group.id) ?? [],
            row.attachment,
            row.categoryName,
          ),
        );
      if (inheritedGroups.length === 0) continue;
      const bucket = result.get(product.id) ?? [];
      bucket.push(...inheritedGroups);
      result.set(product.id, bucket);
    }

    return result;
  }

  private async getProductInsideTenant(
    tx: TenantedDrizzleClient,
    businessId: string,
    productId: string,
  ): Promise<ProductResponse> {
    const product = await this.findProductRow(tx, businessId, productId);
    const [hydrated] = await this.hydrateProducts(tx, businessId, [product]);
    if (!hydrated) throw new NotFoundException("Product not found");
    return hydrated;
  }

  private async findCategoryRow(
    tx: TenantedDrizzleClient,
    businessId: string,
    categoryId: string,
  ) {
    const [row] = await tx
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.businessId, businessId),
          eq(categories.id, categoryId),
          isNull(categories.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Category not found");
    return row;
  }

  private async findProductRow(
    tx: TenantedDrizzleClient,
    businessId: string,
    productId: string,
  ) {
    const [row] = await tx
      .select()
      .from(products)
      .where(
        and(
          eq(products.businessId, businessId),
          eq(products.id, productId),
          isNull(products.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Product not found");
    return row;
  }

  private async assertParentCanAcceptChild(
    tx: TenantedDrizzleClient,
    businessId: string,
    parentId: string | null,
    categoryId?: string,
  ): Promise<void> {
    if (!parentId) return;
    if (parentId === categoryId) {
      throw new BadRequestException({
        type: `${PROBLEM_BASE_URL}/category-parent-invalid`,
        message: "A category cannot be its own parent.",
      });
    }
    const parent = await this.findCategoryRow(tx, businessId, parentId);
    if (parent.parentId) {
      throw new BadRequestException({
        type: `${PROBLEM_BASE_URL}/category-depth-exceeded`,
        message: "Only one subcategory level is supported.",
      });
    }
    if (categoryId) {
      const [child] = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.businessId, businessId),
            eq(categories.parentId, categoryId),
            isNull(categories.deletedAt),
          ),
        )
        .limit(1);
      if (child) {
        throw new BadRequestException({
          type: `${PROBLEM_BASE_URL}/category-depth-exceeded`,
          message: "A category with children cannot become a subcategory.",
        });
      }
    }
  }

  private async assertCategorySlugAvailable(
    tx: TenantedDrizzleClient,
    businessId: string,
    slug: string,
    exceptCategoryId?: string,
  ): Promise<void> {
    const predicates = [
      eq(categories.businessId, businessId),
      eq(categories.slug, slug),
      isNull(categories.deletedAt),
    ];
    if (exceptCategoryId) predicates.push(ne(categories.id, exceptCategoryId));
    const [existing] = await tx.select({ id: categories.id }).from(categories).where(and(...predicates)).limit(1);
    if (existing) {
      throw new ConflictException({
        type: `${PROBLEM_BASE_URL}/category-slug-conflict`,
        message: "A category with this slug already exists.",
      });
    }
  }

  private async fallbackText(
    tx: TenantedDrizzleClient,
    businessId: string,
    values: Record<string, string>,
  ): Promise<string> {
    const settings = await this.getLocaleSettingsInsideTenant(tx, businessId);
    return values[settings.defaultLocale]?.trim() || values.fr?.trim() || Object.values(values)[0]?.trim() || "Sans nom";
  }

  private async optionalFallbackText(
    tx: TenantedDrizzleClient,
    businessId: string,
    values: Record<string, string>,
  ): Promise<string | null> {
    if (Object.keys(values).length === 0) return null;
    return this.fallbackText(tx, businessId, values);
  }

  private async getLocaleSettingsInsideTenant(
    tx: TenantedDrizzleClient,
    businessId: string,
  ) {
    const [row] = await tx
      .select()
      .from(menuLocaleSettings)
      .where(eq(menuLocaleSettings.businessId, businessId))
      .limit(1);
    return { defaultLocale: row?.defaultLocale ?? "fr" };
  }

  private validateVariants(
    variants: CreateProductInput["variants"],
    basePrice: string,
  ): void {
    const defaults = variants.filter((variant) => variant.isDefault);
    if (variants.length > 0 && defaults.length !== 1) {
      throw new BadRequestException({
        type: `${PROBLEM_BASE_URL}/menu-variant-default-required`,
        message: "Exactly one real variant must be marked as default.",
      });
    }
    for (const variant of variants) {
      if (variant.pricingMode === "fixed" && !variant.price) {
        throw new BadRequestException({
          type: `${PROBLEM_BASE_URL}/menu-variant-price-required`,
          message: "Fixed variants require a decimal-string price.",
        });
      }
      if (variant.pricingMode === "variable_pos" && variant.price) {
        throw new BadRequestException({
          type: `${PROBLEM_BASE_URL}/menu-variable-variant-no-fixed-price`,
          message: "Variable POS variants store display metadata, not a fixed price.",
        });
      }
    }
    if (variants.length === 0 && !basePrice) {
      throw new BadRequestException("Base price is required for synthetic default variants.");
    }
  }

  private async replaceVariantRows(
    tx: TenantedDrizzleClient,
    businessId: string,
    productId: string,
    variants: CreateProductInput["variants"],
    basePrice: string,
  ): Promise<void> {
    await this.findProductRow(tx, businessId, productId);
    await tx.delete(productVariants).where(eq(productVariants.productId, productId));
    if (variants.length === 0) return;
    await tx.insert(productVariants).values(
      variants.map((variant, index) => ({
        id: variant.id,
        productId,
        name: variant.name,
        priceOverride:
          variant.pricingMode === "fixed" ? variant.price ?? basePrice : null,
        position: variant.position ?? index,
        isDefault: variant.isDefault,
        available: variant.available,
        variantKind: variant.variantKind,
        pricingMode: variant.pricingMode,
        displayPriceLabel: variant.displayPriceLabel ?? null,
        displayPriceMin: variant.displayPriceMin ?? null,
        displayPriceMax: variant.displayPriceMax ?? null,
        unitLabel: variant.unitLabel ?? null,
      })),
    );
  }

  private async replaceImageRows(
    tx: TenantedDrizzleClient,
    businessId: string,
    productId: string,
    images: CreateProductInput["images"],
  ): Promise<void> {
    await this.findProductRow(tx, businessId, productId);
    await tx
      .delete(productImages)
      .where(and(eq(productImages.businessId, businessId), eq(productImages.productId, productId)));
    if (images.length > 0) {
      await tx.insert(productImages).values(
        images.map((image, index) => ({
          id: image.id,
          businessId,
          productId,
          url: image.url,
          altText: image.altText ?? null,
          position: image.position ?? index,
          isPrimary: image.isPrimary,
        })),
      );
    }
    await tx
      .update(products)
      .set({ image: this.primaryImageUrl(images), updatedAt: new Date() })
      .where(and(eq(products.businessId, businessId), eq(products.id, productId)));
  }

  private primaryImageUrl(images: CreateProductInput["images"]): string | null {
    return images.find((image) => image.isPrimary)?.url ?? images[0]?.url ?? null;
  }

  private toCategoryTree(rows: Array<typeof categories.$inferSelect>): CategoryResponse[] {
    const byParent = new Map<string | null, CategoryResponse[]>();
    for (const row of rows) {
      const category = this.toCategory(row);
      const bucket = byParent.get(row.parentId) ?? [];
      bucket.push(category);
      byParent.set(row.parentId, bucket);
    }
    for (const category of rows) {
      const response = byParent
        .get(category.parentId)
        ?.find((candidate) => candidate.id === category.id);
      if (response) {
        response.children = byParent.get(category.id) ?? [];
      }
    }
    return byParent.get(null) ?? [];
  }

  private toCategory(row: typeof categories.$inferSelect): CategoryResponse {
    return {
      id: row.id,
      parentId: row.parentId,
      name: row.name,
      slug: row.slug,
      description: row.description,
      localizedNames: row.localizedNames,
      localizedDescriptions: row.localizedDescriptions,
      colorTag: row.colorTag,
      position: row.position,
      visible: row.visible,
      children: [],
    };
  }

  private toProductResponse(
    row: typeof products.$inferSelect,
    variants: Array<typeof productVariants.$inferSelect>,
    images: Array<typeof productImages.$inferSelect>,
    modifiers: ModifierGroupResponse[],
  ): ProductResponse {
    return {
      id: row.id,
      categoryId: row.categoryId,
      name: row.name,
      description: row.description,
      basePrice: row.price,
      image: row.image,
      sku: row.sku,
      itemCode: row.itemCode,
      colorTag: row.colorTag,
      featured: row.featured,
      hidden: row.hidden,
      available: row.available,
      channels: {
        dineIn: row.availableDineIn,
        takeaway: row.availableTakeaway,
        delivery: row.availableDelivery,
        qr: row.availableQr,
        online: row.availableOnline,
      },
      localizedNames: row.localizedNames,
      localizedDescriptions: row.localizedDescriptions,
      position: row.position,
      variants:
        variants.length > 0
          ? variants.map((variant) => this.toVariantResponse(variant, row.price))
          : [this.syntheticDefaultVariant(row)],
      images: images.map((image) => ({
        id: image.id,
        url: image.url,
        altText: image.altText,
        position: image.position,
        isPrimary: image.isPrimary,
      })),
      modifiers,
    };
  }

  private toModifierGroupTemplateResponse(
    row: typeof modifierGroupTemplates.$inferSelect,
    values: Array<typeof modifierValueTemplates.$inferSelect>,
  ): ModifierGroupTemplateResponse {
    return {
      id: row.id,
      name: row.name,
      localizedNames: row.localizedNames,
      type: row.type,
      required: row.required,
      minSelect: row.minSelect,
      maxSelect: row.maxSelect,
      freeQuantity: row.freeQuantity,
      extraPrice: row.extraPrice,
      attachScope: row.attachScope,
      reusable: row.reusable,
      position: 0,
      values: values.map((value) => ({
        id: value.id,
        templateValueId: value.id,
        name: value.name,
        localizedNames: value.localizedNames,
        priceAddition: value.priceAddition,
        position: value.position,
        available: value.available,
        recipeHookKey: value.recipeHookKey,
      })),
    };
  }

  private toProductModifierGroupResponse(
    row: typeof productOptions.$inferSelect,
    values: Array<typeof optionValues.$inferSelect>,
  ): ModifierGroupResponse {
    return {
      id: row.id,
      templateId: row.templateId,
      name: row.name,
      localizedNames: row.localizedNames,
      type: row.type,
      required: row.required,
      minSelect: row.minSelect,
      maxSelect: row.maxSelect,
      freeQuantity: row.freeQuantity,
      extraPrice: row.extraPrice,
      attachScope: "product",
      reusable: row.templateId !== null,
      source: "product",
      sourceCategoryId: null,
      sourceCategoryName: null,
      position: row.position,
      values: values.map((value) => ({
        id: value.id,
        templateValueId: value.templateValueId,
        name: value.name,
        localizedNames: value.localizedNames,
        priceAddition: value.priceAddition,
        position: value.position,
        available: value.available,
        recipeHookKey: null,
      })),
    };
  }

  private toCategoryModifierGroupResponse(
    row: typeof modifierGroupTemplates.$inferSelect,
    values: Array<typeof modifierValueTemplates.$inferSelect>,
    attachment: typeof categoryModifierGroups.$inferSelect,
    categoryName: string,
  ): ModifierGroupResponse {
    return {
      id: row.id,
      templateId: row.id,
      name: row.name,
      localizedNames: row.localizedNames,
      type: row.type,
      required: row.required,
      minSelect: row.minSelect,
      maxSelect: row.maxSelect,
      freeQuantity: row.freeQuantity,
      extraPrice: row.extraPrice,
      attachScope: "category",
      reusable: row.reusable,
      source: "category",
      sourceCategoryId: attachment.categoryId,
      sourceCategoryName: categoryName,
      position: attachment.position,
      values: values.map((value) => ({
        id: value.id,
        templateValueId: value.id,
        name: value.name,
        localizedNames: value.localizedNames,
        priceAddition: value.priceAddition,
        position: value.position,
        available: value.available,
        recipeHookKey: value.recipeHookKey,
      })),
    };
  }

  private toVariantResponse(
    variant: typeof productVariants.$inferSelect,
    basePrice: string,
  ): VariantResponse {
    return {
      id: variant.id,
      name: variant.name,
      price: variant.pricingMode === "fixed" ? variant.priceOverride ?? basePrice : null,
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
  }

  private syntheticDefaultVariant(row: typeof products.$inferSelect): VariantResponse {
    return {
      id: null,
      name: "Default",
      price: row.price,
      isDefault: true,
      available: row.available,
      position: 0,
      variantKind: "custom",
      pricingMode: "fixed",
      displayPriceLabel: null,
      displayPriceMin: null,
      displayPriceMax: null,
      unitLabel: null,
      synthetic: true,
    };
  }
}
