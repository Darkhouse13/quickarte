import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  dietaryTags,
  ingredientTags,
  ingredientUnitConversions,
  ingredients,
  modifierValueIngredientDeltas,
  recipeLines,
  recipes,
  unitsOfMeasure,
} from "@quickarte/db-schema";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { DatabaseService, type TenantedDrizzleClient } from "../database/database.service";
import { RecipesService } from "../recipes/recipes.service";
import type {
  CreateIngredientInput,
  ReplaceIngredientConversionsInput,
  ReplaceIngredientTagsInput,
  UpdateIngredientInput,
} from "./ingredients.schemas";

@Injectable()
export class IngredientsService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(RecipesService)
    private readonly recipesService: RecipesService,
  ) {}

  async listUnits(businessId: string) {
    return this.databaseService.withTenant(businessId, async (tx) => {
      const rows = await tx
        .select()
        .from(unitsOfMeasure)
        .orderBy(asc(unitsOfMeasure.dimension), asc(unitsOfMeasure.code));
      return rows.map((row) => ({
        ...row,
        factorToBase: formatRequiredDecimalString(row.factorToBase, 0),
      }));
    });
  }

  async listIngredients(businessId: string) {
    return this.databaseService.withTenant(businessId, async (tx) => {
      const rows = await tx
        .select()
        .from(ingredients)
        .where(and(eq(ingredients.businessId, businessId), isNull(ingredients.deletedAt)))
        .orderBy(asc(ingredients.position), asc(ingredients.name));
      return this.hydrateIngredients(tx, businessId, rows);
    });
  }

  async getIngredient(businessId: string, ingredientId: string) {
    return this.databaseService.withTenant(businessId, async (tx) => {
      const ingredient = await this.findIngredient(tx, businessId, ingredientId);
      const [hydrated] = await this.hydrateIngredients(tx, businessId, [ingredient]);
      if (!hydrated) throw new NotFoundException("Ingredient not found");
      return { ingredient: hydrated };
    });
  }

  async createIngredient(businessId: string, input: CreateIngredientInput) {
    return this.databaseService.withTenant(businessId, async (tx) => {
      const [created] = await tx
        .insert(ingredients)
        .values({
          businessId,
          name: input.name.trim(),
          localizedNames: input.localizedNames ?? {},
          category: input.category ?? "dry_good",
          stockUom: input.stockUom,
          currentCostPerUom: input.currentCostPerUom ?? null,
          trackedInStock: input.trackedInStock ?? true,
          supplierId: input.supplierId ?? null,
          storageLocation: input.storageLocation?.trim() || null,
          position: input.position ?? 0,
        })
        .returning();
      if (!created) throw new Error("Failed to create ingredient");
      const [hydrated] = await this.hydrateIngredients(tx, businessId, [created]);
      if (!hydrated) throw new Error("Failed to hydrate ingredient");
      return { ingredient: hydrated };
    });
  }

  async updateIngredient(
    businessId: string,
    ingredientId: string,
    input: UpdateIngredientInput,
  ) {
    return this.databaseService.withTenant(businessId, async (tx) => {
      await this.findIngredient(tx, businessId, ingredientId);
      const [updated] = await tx
        .update(ingredients)
        .set({
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.localizedNames !== undefined
            ? { localizedNames: input.localizedNames }
            : {}),
          ...(input.category !== undefined ? { category: input.category } : {}),
          ...(input.stockUom !== undefined ? { stockUom: input.stockUom } : {}),
          ...(input.currentCostPerUom !== undefined
            ? { currentCostPerUom: input.currentCostPerUom }
            : {}),
          ...(input.trackedInStock !== undefined
            ? { trackedInStock: input.trackedInStock }
            : {}),
          ...(input.supplierId !== undefined ? { supplierId: input.supplierId } : {}),
          ...(input.storageLocation !== undefined
            ? { storageLocation: input.storageLocation?.trim() || null }
            : {}),
          ...(input.position !== undefined ? { position: input.position } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(ingredients.id, ingredientId),
            eq(ingredients.businessId, businessId),
            isNull(ingredients.deletedAt),
          ),
        )
        .returning();
      if (!updated) throw new NotFoundException("Ingredient not found");
      if (input.currentCostPerUom !== undefined) {
        await this.recipesService.recomputeRecipesForIngredientInTransaction(
          tx,
          businessId,
          ingredientId,
        );
      }
      const [hydrated] = await this.hydrateIngredients(tx, businessId, [updated]);
      if (!hydrated) throw new Error("Failed to hydrate ingredient");
      return { ingredient: hydrated };
    });
  }

  async softDeleteIngredient(businessId: string, ingredientId: string) {
    return this.databaseService.withTenant(businessId, async (tx) => {
      await this.findIngredient(tx, businessId, ingredientId);
      await this.assertIngredientNotInUse(tx, businessId, ingredientId);
      await tx
        .update(ingredients)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(ingredients.id, ingredientId), eq(ingredients.businessId, businessId)));
    });
  }

  async replaceConversions(
    businessId: string,
    ingredientId: string,
    input: ReplaceIngredientConversionsInput,
  ) {
    return this.databaseService.withTenant(businessId, async (tx) => {
      await this.findIngredient(tx, businessId, ingredientId);
      await tx
        .delete(ingredientUnitConversions)
        .where(
          and(
            eq(ingredientUnitConversions.businessId, businessId),
            eq(ingredientUnitConversions.ingredientId, ingredientId),
          ),
        );
      if (input.conversions.length > 0) {
        await tx.insert(ingredientUnitConversions).values(
          input.conversions.map((conversion) => ({
            businessId,
            ingredientId,
            altUom: conversion.altUom,
            qtyInStockUom: conversion.qtyInStockUom,
          })),
        );
      }
      return {
        conversions: await this.listConversions(tx, businessId, [ingredientId]).then(
          (map) => map.get(ingredientId) ?? [],
        ),
      };
    });
  }

  async replaceTags(
    businessId: string,
    ingredientId: string,
    input: ReplaceIngredientTagsInput,
  ) {
    return this.databaseService.withTenant(businessId, async (tx) => {
      await this.findIngredient(tx, businessId, ingredientId);
      const uniqueTagIds = [...new Set(input.tagIds)];
      if (uniqueTagIds.length > 0) {
        const tagRows = await tx
          .select({ id: dietaryTags.id })
          .from(dietaryTags)
          .where(
            and(
              eq(dietaryTags.businessId, businessId),
              isNull(dietaryTags.deletedAt),
              inArray(dietaryTags.id, uniqueTagIds),
            ),
          );
        if (tagRows.length !== uniqueTagIds.length) {
          throw new NotFoundException("Tag not found");
        }
      }

      await tx
        .delete(ingredientTags)
        .where(
          and(
            eq(ingredientTags.businessId, businessId),
            eq(ingredientTags.ingredientId, ingredientId),
          ),
        );
      if (uniqueTagIds.length > 0) {
        await tx.insert(ingredientTags).values(
          uniqueTagIds.map((tagId) => ({
            businessId,
            ingredientId,
            tagId,
          })),
        );
      }
      return {
        tags: await this.listTags(tx, businessId, [ingredientId]).then(
          (map) => map.get(ingredientId) ?? [],
        ),
      };
    });
  }

  private async findIngredient(
    tx: TenantedDrizzleClient,
    businessId: string,
    ingredientId: string,
  ) {
    const [row] = await tx
      .select()
      .from(ingredients)
      .where(
        and(
          eq(ingredients.id, ingredientId),
          eq(ingredients.businessId, businessId),
          isNull(ingredients.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Ingredient not found");
    return row;
  }

  private async assertIngredientNotInUse(
    tx: TenantedDrizzleClient,
    businessId: string,
    ingredientId: string,
  ): Promise<void> {
    const [recipeReference] = await tx
      .select({ id: recipeLines.id })
      .from(recipeLines)
      .innerJoin(recipes, eq(recipeLines.recipeId, recipes.id))
      .where(
        and(
          eq(recipeLines.businessId, businessId),
          eq(recipeLines.ingredientId, ingredientId),
          eq(recipes.businessId, businessId),
          isNull(recipes.deletedAt),
        ),
      )
      .limit(1);
    if (recipeReference) {
      throw new ConflictException({
        type: "https://api.quickarte.ma/problems/ingredient-in-use",
        message: "Ingredient is used by an active recipe and cannot be deleted.",
      });
    }

    const [modifierReference] = await tx
      .select({ id: modifierValueIngredientDeltas.id })
      .from(modifierValueIngredientDeltas)
      .where(
        and(
          eq(modifierValueIngredientDeltas.businessId, businessId),
          eq(modifierValueIngredientDeltas.ingredientId, ingredientId),
        ),
      )
      .limit(1);
    if (modifierReference) {
      throw new ConflictException({
        type: "https://api.quickarte.ma/problems/ingredient-in-use",
        message: "Ingredient is used by a modifier stock delta and cannot be deleted.",
      });
    }
  }

  private async hydrateIngredients(
    tx: TenantedDrizzleClient,
    businessId: string,
    rows: Array<typeof ingredients.$inferSelect>,
  ) {
    const ids = rows.map((row) => row.id);
    const conversionsByIngredient = await this.listConversions(tx, businessId, ids);
    const tagsByIngredient = await this.listTags(tx, businessId, ids);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      localizedNames: row.localizedNames,
      category: row.category,
      stockUom: row.stockUom,
      currentCostPerUom: formatDecimalString(row.currentCostPerUom, 2),
      trackedInStock: row.trackedInStock,
      supplierId: row.supplierId,
      storageLocation: row.storageLocation,
      position: row.position,
      conversions: conversionsByIngredient.get(row.id) ?? [],
      tags: tagsByIngredient.get(row.id) ?? [],
    }));
  }

  private async listConversions(
    tx: TenantedDrizzleClient,
    businessId: string,
    ingredientIds: string[],
  ) {
    const map = new Map<string, Array<{
      id: string;
      altUom: string;
      qtyInStockUom: string;
    }>>();
    if (ingredientIds.length === 0) return map;
    const rows = await tx
      .select()
      .from(ingredientUnitConversions)
      .where(
        and(
          eq(ingredientUnitConversions.businessId, businessId),
          inArray(ingredientUnitConversions.ingredientId, ingredientIds),
        ),
      )
      .orderBy(asc(ingredientUnitConversions.altUom));
    for (const row of rows) {
      const bucket = map.get(row.ingredientId) ?? [];
      bucket.push({
        id: row.id,
        altUom: row.altUom,
        qtyInStockUom: row.qtyInStockUom,
      });
      map.set(row.ingredientId, bucket);
    }
    return map;
  }

  private async listTags(
    tx: TenantedDrizzleClient,
    businessId: string,
    ingredientIds: string[],
  ) {
    const map = new Map<string, Array<{
      id: string;
      kind: "dietary" | "allergen";
      code: string;
      localizedLabels: Record<string, string>;
      isSystem: boolean;
    }>>();
    if (ingredientIds.length === 0) return map;
    const rows = await tx
      .select({
        ingredientId: ingredientTags.ingredientId,
        tag: dietaryTags,
      })
      .from(ingredientTags)
      .innerJoin(dietaryTags, eq(ingredientTags.tagId, dietaryTags.id))
      .where(
        and(
          eq(ingredientTags.businessId, businessId),
          eq(dietaryTags.businessId, businessId),
          isNull(dietaryTags.deletedAt),
          inArray(ingredientTags.ingredientId, ingredientIds),
        ),
      )
      .orderBy(asc(dietaryTags.position), asc(dietaryTags.code));
    for (const row of rows) {
      const bucket = map.get(row.ingredientId) ?? [];
      bucket.push({
        id: row.tag.id,
        kind: row.tag.kind,
        code: row.tag.code,
        localizedLabels: row.tag.localizedLabels,
        isSystem: row.tag.isSystem,
      });
      map.set(row.ingredientId, bucket);
    }
    return map;
  }
}

function formatRequiredDecimalString(value: string, minimumScale: number): string {
  return formatDecimalString(value, minimumScale) ?? "0";
}

function formatDecimalString(value: string | null, minimumScale: number): string | null {
  if (value === null) return null;
  const [whole = "0", fraction = ""] = value.split(".");
  const trimmed = fraction.replace(/0+$/, "");
  const scale = Math.max(trimmed.length, minimumScale);
  if (scale === 0) return whole;
  return `${whole}.${trimmed.padEnd(scale, "0")}`;
}
