import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ingredientUnitConversions,
  ingredients,
  productVariants,
  products,
  recipeLines,
  recipes,
  unitsOfMeasure,
} from "@quickarte/db-schema";
import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { DatabaseService, type TenantedDrizzleClient } from "../database/database.service";
import {
  calculateIngredientLineCost,
  calculateRecipeTotals,
  calculateSubRecipeLineCost,
  RecipeCostError,
  type LineCost,
} from "./recipe-cost";
import type {
  CreateRecipeInput,
  ReplaceRecipeLinesInput,
  UpdateRecipeInput,
} from "./recipes.schemas";

@Injectable()
export class RecipesService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  async listRecipes(businessId: string) {
    return this.databaseService.withTenant(businessId, async (tx) => {
      const rows = await tx
        .select()
        .from(recipes)
        .where(and(eq(recipes.businessId, businessId), isNull(recipes.deletedAt)))
        .orderBy(asc(recipes.name));
      return { recipes: await this.hydrateRecipes(tx, businessId, rows) };
    });
  }

  async getRecipe(businessId: string, recipeId: string) {
    return this.databaseService.withTenant(businessId, async (tx) => {
      const recipe = await this.findRecipe(tx, businessId, recipeId);
      const [hydrated] = await this.hydrateRecipes(tx, businessId, [recipe]);
      if (!hydrated) throw new NotFoundException("Recipe not found");
      return { recipe: hydrated };
    });
  }

  async getRecipeByVariant(businessId: string, variantId: string) {
    return this.databaseService.withTenant(businessId, async (tx) => {
      await this.findVariantPrice(tx, businessId, variantId);
      const [recipe] = await tx
        .select()
        .from(recipes)
        .where(
          and(
            eq(recipes.businessId, businessId),
            eq(recipes.variantId, variantId),
            isNull(recipes.deletedAt),
          ),
        )
        .limit(1);
      if (!recipe) throw new NotFoundException("Recipe not found");
      const [hydrated] = await this.hydrateRecipes(tx, businessId, [recipe]);
      if (!hydrated) throw new NotFoundException("Recipe not found");
      return { recipe: hydrated };
    });
  }

  async createRecipe(businessId: string, input: CreateRecipeInput) {
    return this.databaseService.withTenant(businessId, async (tx) => {
      if (input.variantId) {
        await this.findVariantPrice(tx, businessId, input.variantId);
      }
      if (!input.variantId && !input.yieldUom) {
        throw new BadRequestException({
          type: "https://api.quickarte.ma/problems/recipe-yield-uom-required",
          message: "Sub-recipes require yield_uom.",
          error: "Bad Request",
        });
      }

      try {
        const [created] = await tx
          .insert(recipes)
          .values({
            businessId,
            variantId: input.variantId ?? null,
            name: input.name.trim(),
            localizedNames: input.localizedNames ?? {},
            yieldQty: input.yieldQty ?? "1.0000",
            yieldUom: input.yieldUom ?? null,
            prepNotes: input.prepNotes?.trim() || null,
            photoUrl: input.photoUrl?.trim() || null,
          })
          .returning();
        if (!created) throw new Error("Failed to create recipe");
        await this.recomputeRecipeAndAncestorsInTransaction(tx, businessId, created.id);
        const refreshed = await this.findRecipe(tx, businessId, created.id);
        const [hydrated] = await this.hydrateRecipes(tx, businessId, [refreshed]);
        if (!hydrated) throw new Error("Failed to hydrate recipe");
        return { recipe: hydrated };
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictException({
            type: "https://api.quickarte.ma/problems/recipe-variant-already-exists",
            message: "A recipe already exists for this variant.",
            error: "Conflict",
          });
        }
        throw error;
      }
    });
  }

  async updateRecipe(
    businessId: string,
    recipeId: string,
    input: UpdateRecipeInput,
  ) {
    return this.databaseService.withTenant(businessId, async (tx) => {
      const existing = await this.findRecipe(tx, businessId, recipeId);
      const variantId = input.variantId === undefined ? existing.variantId : input.variantId;
      const yieldUom = input.yieldUom === undefined ? existing.yieldUom : input.yieldUom;
      if (variantId) {
        await this.findVariantPrice(tx, businessId, variantId);
      }
      if (!variantId && !yieldUom) {
        throw new BadRequestException({
          type: "https://api.quickarte.ma/problems/recipe-yield-uom-required",
          message: "Sub-recipes require yield_uom.",
          error: "Bad Request",
        });
      }

      try {
        const [updated] = await tx
          .update(recipes)
          .set({
            ...(input.variantId !== undefined ? { variantId: input.variantId } : {}),
            ...(input.name !== undefined ? { name: input.name.trim() } : {}),
            ...(input.localizedNames !== undefined
              ? { localizedNames: input.localizedNames }
              : {}),
            ...(input.yieldQty !== undefined ? { yieldQty: input.yieldQty } : {}),
            ...(input.yieldUom !== undefined ? { yieldUom: input.yieldUom } : {}),
            ...(input.prepNotes !== undefined
              ? { prepNotes: input.prepNotes?.trim() || null }
              : {}),
            ...(input.photoUrl !== undefined
              ? { photoUrl: input.photoUrl?.trim() || null }
              : {}),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(recipes.id, recipeId),
              eq(recipes.businessId, businessId),
              isNull(recipes.deletedAt),
            ),
          )
          .returning();
        if (!updated) throw new NotFoundException("Recipe not found");
        await this.recomputeRecipeAndAncestorsInTransaction(tx, businessId, recipeId);
        const refreshed = await this.findRecipe(tx, businessId, recipeId);
        const [hydrated] = await this.hydrateRecipes(tx, businessId, [refreshed]);
        if (!hydrated) throw new Error("Failed to hydrate recipe");
        return { recipe: hydrated };
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictException({
            type: "https://api.quickarte.ma/problems/recipe-variant-already-exists",
            message: "A recipe already exists for this variant.",
            error: "Conflict",
          });
        }
        throw error;
      }
    });
  }

  async deleteRecipe(businessId: string, recipeId: string) {
    return this.databaseService.withTenant(businessId, async (tx) => {
      await this.findRecipe(tx, businessId, recipeId);
      const [reference] = await tx
        .select({ id: recipeLines.id })
        .from(recipeLines)
        .innerJoin(recipes, eq(recipeLines.recipeId, recipes.id))
        .where(
          and(
            eq(recipeLines.businessId, businessId),
            eq(recipeLines.subRecipeId, recipeId),
            eq(recipes.businessId, businessId),
            isNull(recipes.deletedAt),
          ),
        )
        .limit(1);
      if (reference) {
        throw new ConflictException({
          type: "https://api.quickarte.ma/problems/recipe-in-use",
          message: "Sub-recipe is referenced by an active recipe.",
          error: "Conflict",
        });
      }

      await tx
        .update(recipes)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(recipes.id, recipeId), eq(recipes.businessId, businessId)));
    });
  }

  async replaceLines(
    businessId: string,
    recipeId: string,
    input: ReplaceRecipeLinesInput,
  ) {
    return this.databaseService.withTenant(businessId, async (tx) => {
      await this.findRecipe(tx, businessId, recipeId);
      const normalizedLines = input.lines.map((line, index) => ({
        componentType: line.componentType,
        ingredientId: line.componentType === "ingredient" ? line.ingredientId ?? null : null,
        subRecipeId: line.componentType === "sub_recipe" ? line.subRecipeId ?? null : null,
        quantity: line.quantity,
        uom: line.uom,
        yieldPct: line.yieldPct ?? null,
        quantityIsCooked: line.quantityIsCooked ?? false,
        position: line.position ?? index,
      }));
      await this.validateLineReferences(tx, businessId, recipeId, normalizedLines);
      await this.assertNoCycle(tx, businessId, recipeId, normalizedLines);

      await tx
        .delete(recipeLines)
        .where(
          and(
            eq(recipeLines.businessId, businessId),
            eq(recipeLines.recipeId, recipeId),
          ),
        );
      if (normalizedLines.length > 0) {
        await tx.insert(recipeLines).values(
          normalizedLines.map((line) => ({
            businessId,
            recipeId,
            componentType: line.componentType,
            ingredientId: line.ingredientId,
            subRecipeId: line.subRecipeId,
            quantity: line.quantity,
            uom: line.uom,
            yieldPct: line.yieldPct,
            quantityIsCooked: line.quantityIsCooked,
            position: line.position,
          })),
        );
      }

      await this.recomputeRecipeAndAncestorsInTransaction(tx, businessId, recipeId);
      const refreshed = await this.findRecipe(tx, businessId, recipeId);
      const [hydrated] = await this.hydrateRecipes(tx, businessId, [refreshed]);
      if (!hydrated) throw new Error("Failed to hydrate recipe");
      return { recipe: hydrated };
    });
  }

  async recomputeRecipesForIngredientInTransaction(
    tx: TenantedDrizzleClient,
    businessId: string,
    ingredientId: string,
  ) {
    const rows = await tx
      .select({ recipeId: recipeLines.recipeId })
      .from(recipeLines)
      .innerJoin(recipes, eq(recipeLines.recipeId, recipes.id))
      .where(
        and(
          eq(recipeLines.businessId, businessId),
          eq(recipeLines.ingredientId, ingredientId),
          eq(recipes.businessId, businessId),
          isNull(recipes.deletedAt),
        ),
      );
    await this.recomputeAffectedRecipesInTransaction(
      tx,
      businessId,
      rows.map((row) => row.recipeId),
    );
  }

  private async recomputeRecipeAndAncestorsInTransaction(
    tx: TenantedDrizzleClient,
    businessId: string,
    recipeId: string,
  ) {
    await this.recomputeAffectedRecipesInTransaction(tx, businessId, [recipeId]);
  }

  private async recomputeAffectedRecipesInTransaction(
    tx: TenantedDrizzleClient,
    businessId: string,
    changedRecipeIds: string[],
  ) {
    const affectedIds = await this.collectAffectedRecipeIds(
      tx,
      businessId,
      changedRecipeIds,
    );
    if (affectedIds.size === 0) return;

    const affectedList = [...affectedIds];
    const dependencyEdges = await tx
      .select({
        recipeId: recipeLines.recipeId,
        subRecipeId: recipeLines.subRecipeId,
      })
      .from(recipeLines)
      .where(
        and(
          eq(recipeLines.businessId, businessId),
          inArray(recipeLines.recipeId, affectedList),
          inArray(recipeLines.subRecipeId, affectedList),
        ),
      );
    const indegree = new Map<string, number>();
    const parentsByChild = new Map<string, Set<string>>();
    for (const id of affectedIds) {
      indegree.set(id, 0);
    }
    for (const edge of dependencyEdges) {
      if (!edge.subRecipeId) continue;
      indegree.set(edge.recipeId, (indegree.get(edge.recipeId) ?? 0) + 1);
      const parents = parentsByChild.get(edge.subRecipeId) ?? new Set<string>();
      parents.add(edge.recipeId);
      parentsByChild.set(edge.subRecipeId, parents);
    }

    const ready = [...indegree.entries()]
      .filter(([, count]) => count === 0)
      .map(([id]) => id);
    const recomputed = new Set<string>();
    while (ready.length > 0) {
      const recipeId = ready.shift()!;
      if (recomputed.has(recipeId)) continue;
      await this.recomputeSingleRecipe(tx, businessId, recipeId);
      recomputed.add(recipeId);
      for (const parentId of parentsByChild.get(recipeId) ?? []) {
        const nextCount = (indegree.get(parentId) ?? 0) - 1;
        indegree.set(parentId, nextCount);
        if (nextCount === 0) {
          ready.push(parentId);
        }
      }
    }

    if (recomputed.size !== affectedIds.size) {
      throw new ConflictException({
        type: "https://api.quickarte.ma/problems/recipe-cycle-detected",
        message: "Recipe dependency graph contains a cycle.",
        error: "Conflict",
        recipe_ids: [...affectedIds].filter((id) => !recomputed.has(id)),
      });
    }
  }

  private async collectAffectedRecipeIds(
    tx: TenantedDrizzleClient,
    businessId: string,
    changedRecipeIds: string[],
  ): Promise<Set<string>> {
    const affectedIds = new Set<string>();
    const queue = [...new Set(changedRecipeIds)];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (affectedIds.has(currentId)) continue;
      affectedIds.add(currentId);
      const parents = await tx
        .select({ recipeId: recipeLines.recipeId })
        .from(recipeLines)
        .innerJoin(recipes, eq(recipeLines.recipeId, recipes.id))
        .where(
          and(
            eq(recipeLines.businessId, businessId),
            eq(recipeLines.subRecipeId, currentId),
            eq(recipes.businessId, businessId),
            isNull(recipes.deletedAt),
          ),
        );
      for (const parent of parents) {
        if (!affectedIds.has(parent.recipeId)) {
          queue.push(parent.recipeId);
        }
      }
    }
    return affectedIds;
  }
  private async recomputeSingleRecipe(
    tx: TenantedDrizzleClient,
    businessId: string,
    recipeId: string,
  ) {
    const recipe = await this.findRecipe(tx, businessId, recipeId);
    const lines = await tx
      .select()
      .from(recipeLines)
      .where(
        and(eq(recipeLines.businessId, businessId), eq(recipeLines.recipeId, recipeId)),
      )
      .orderBy(asc(recipeLines.position));
    const units = await tx.select().from(unitsOfMeasure);
    const lineCosts: LineCost[] = [];

    const ingredientIds = lines
      .map((line) => line.ingredientId)
      .filter((id): id is string => id !== null);
    const ingredientRows =
      ingredientIds.length === 0
        ? []
        : await tx
            .select()
            .from(ingredients)
            .where(
              and(
                eq(ingredients.businessId, businessId),
                inArray(ingredients.id, ingredientIds),
                isNull(ingredients.deletedAt),
              ),
            );
    const ingredientsById = new Map(ingredientRows.map((row) => [row.id, row]));
    const conversionRows =
      ingredientIds.length === 0
        ? []
        : await tx
            .select()
            .from(ingredientUnitConversions)
            .where(
              and(
                eq(ingredientUnitConversions.businessId, businessId),
                inArray(ingredientUnitConversions.ingredientId, ingredientIds),
              ),
            );
    const conversionsByIngredient = new Map<
      string,
      Array<{ altUom: string; qtyInStockUom: string }>
    >();
    for (const conversion of conversionRows) {
      const bucket = conversionsByIngredient.get(conversion.ingredientId) ?? [];
      bucket.push({
        altUom: conversion.altUom,
        qtyInStockUom: conversion.qtyInStockUom,
      });
      conversionsByIngredient.set(conversion.ingredientId, bucket);
    }

    const subRecipeIds = lines
      .map((line) => line.subRecipeId)
      .filter((id): id is string => id !== null);
    const subRecipeRows =
      subRecipeIds.length === 0
        ? []
        : await tx
            .select()
            .from(recipes)
            .where(
              and(
                eq(recipes.businessId, businessId),
                inArray(recipes.id, subRecipeIds),
                isNull(recipes.deletedAt),
              ),
            );
    const subRecipesById = new Map(subRecipeRows.map((row) => [row.id, row]));

    for (const line of lines) {
      try {
        if (line.componentType === "ingredient") {
          const ingredient = line.ingredientId
            ? ingredientsById.get(line.ingredientId)
            : undefined;
          if (!ingredient) throw new NotFoundException("Ingredient not found");
          lineCosts.push(
            calculateIngredientLineCost({
              quantity: line.quantity,
              uom: line.uom,
              quantityIsCooked: line.quantityIsCooked,
              yieldPct: line.yieldPct,
              ingredient: {
                stockUom: ingredient.stockUom,
                currentCostPerUom: ingredient.currentCostPerUom,
                conversions: conversionsByIngredient.get(ingredient.id) ?? [],
              },
              units,
            }),
          );
        } else {
          const subRecipe = line.subRecipeId
            ? subRecipesById.get(line.subRecipeId)
            : undefined;
          if (!subRecipe || !subRecipe.yieldUom) {
            throw new BadRequestException("Sub-recipe yield unit is missing");
          }
          lineCosts.push(
            calculateSubRecipeLineCost({
              quantity: line.quantity,
              uom: line.uom,
              subRecipe: {
                computedCost: subRecipe.computedCost,
                yieldQty: subRecipe.yieldQty,
                yieldUom: subRecipe.yieldUom,
                costIsComplete: subRecipe.costIsComplete,
              },
              units,
            }),
          );
        }
      } catch (error) {
        if (error instanceof RecipeCostError) {
          throw new BadRequestException({
            type: "https://api.quickarte.ma/problems/recipe-cost-invalid",
            message: error.message,
            error: "Bad Request",
            code: error.code,
          });
        }
        throw error;
      }
    }

    const variantPrice = recipe.variantId
      ? await this.findVariantPrice(tx, businessId, recipe.variantId)
      : null;
    const totals = calculateRecipeTotals({ lineCosts, variantPrice });
    await tx
      .update(recipes)
      .set({
        computedCost: totals.computedCost,
        costIsComplete: totals.costIsComplete,
        foodCostPct: totals.foodCostPct,
        updatedAt: new Date(),
      })
      .where(and(eq(recipes.id, recipeId), eq(recipes.businessId, businessId)));
  }

  private async validateLineReferences(
    tx: TenantedDrizzleClient,
    businessId: string,
    recipeId: string,
    lines: NormalizedRecipeLineInput[],
  ) {
    for (const line of lines) {
      if (line.componentType === "ingredient") {
        if (!line.ingredientId) {
          throw new BadRequestException("Ingredient lines require ingredient_id.");
        }
        if (line.quantityIsCooked && line.yieldPct === null) {
          throw new BadRequestException("Cooked ingredient lines require yield_pct.");
        }
        const [ingredient] = await tx
          .select({ id: ingredients.id })
          .from(ingredients)
          .where(
            and(
              eq(ingredients.businessId, businessId),
              eq(ingredients.id, line.ingredientId),
              isNull(ingredients.deletedAt),
            ),
          )
          .limit(1);
        if (!ingredient) throw new NotFoundException("Ingredient not found");
      } else {
        if (!line.subRecipeId) {
          throw new BadRequestException("Sub-recipe lines require sub_recipe_id.");
        }
        if (line.subRecipeId === recipeId) {
          await this.throwCycle(tx, businessId, [recipeId, line.subRecipeId]);
        }
        const subRecipe = await this.findRecipe(tx, businessId, line.subRecipeId);
        if (subRecipe.variantId !== null || !subRecipe.yieldUom) {
          throw new BadRequestException("Recipe line must reference a sub-recipe.");
        }
      }
    }
  }

  private async assertNoCycle(
    tx: TenantedDrizzleClient,
    businessId: string,
    recipeId: string,
    lines: NormalizedRecipeLineInput[],
  ) {
    const existingEdges = await tx
      .select({
        recipeId: recipeLines.recipeId,
        subRecipeId: recipeLines.subRecipeId,
      })
      .from(recipeLines)
      .innerJoin(recipes, eq(recipeLines.recipeId, recipes.id))
      .where(
        and(
          eq(recipeLines.businessId, businessId),
          eq(recipes.businessId, businessId),
          isNull(recipes.deletedAt),
          ne(recipeLines.recipeId, recipeId),
        ),
      );
    const graph = new Map<string, string[]>();
    for (const edge of existingEdges) {
      if (!edge.subRecipeId) continue;
      const bucket = graph.get(edge.recipeId) ?? [];
      bucket.push(edge.subRecipeId);
      graph.set(edge.recipeId, bucket);
    }
    graph.set(
      recipeId,
      lines
        .filter((line) => line.componentType === "sub_recipe" && line.subRecipeId)
        .map((line) => line.subRecipeId!),
    );

    const visited = new Set<string>();
    const stack: string[] = [];
    const visit = (currentId: string): string[] | null => {
      if (currentId === recipeId && stack.length > 0) return [...stack, currentId];
      if (visited.has(currentId)) return null;
      visited.add(currentId);
      stack.push(currentId);
      for (const child of graph.get(currentId) ?? []) {
        const cycle = visit(child);
        if (cycle) return cycle;
      }
      stack.pop();
      return null;
    };

    for (const child of graph.get(recipeId) ?? []) {
      stack.length = 0;
      const cycle = visit(child);
      if (cycle) {
        await this.throwCycle(tx, businessId, [recipeId, ...cycle]);
      }
    }
  }

  private async throwCycle(
    tx: TenantedDrizzleClient,
    businessId: string,
    cycleIds: string[],
  ): Promise<never> {
    const uniqueIds = [...new Set(cycleIds)];
    const rows =
      uniqueIds.length === 0
        ? []
        : await tx
            .select({ id: recipes.id, name: recipes.name })
            .from(recipes)
            .where(and(eq(recipes.businessId, businessId), inArray(recipes.id, uniqueIds)));
    const names = new Map(rows.map((row) => [row.id, row.name]));
    const cycleNames = uniqueIds.map((id) => names.get(id) ?? id);
    throw new ConflictException({
      type: "https://api.quickarte.ma/problems/recipe-cycle-detected",
      message: `Recipe cycle detected: ${cycleNames.join(" -> ")}`,
      error: "Conflict",
      recipe_ids: uniqueIds,
      recipe_names: cycleNames,
    });
  }

  private async findRecipe(
    tx: TenantedDrizzleClient,
    businessId: string,
    recipeId: string,
  ) {
    const [row] = await tx
      .select()
      .from(recipes)
      .where(
        and(
          eq(recipes.id, recipeId),
          eq(recipes.businessId, businessId),
          isNull(recipes.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Recipe not found");
    return row;
  }

  private async findVariantPrice(
    tx: TenantedDrizzleClient,
    businessId: string,
    variantId: string,
  ): Promise<string> {
    const [row] = await tx
      .select({
        priceOverride: productVariants.priceOverride,
        productPrice: products.price,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(
        and(
          eq(productVariants.id, variantId),
          eq(products.businessId, businessId),
          isNull(products.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Variant not found");
    return row.priceOverride ?? row.productPrice;
  }

  private async hydrateRecipes(
    tx: TenantedDrizzleClient,
    businessId: string,
    rows: Array<typeof recipes.$inferSelect>,
  ) {
    const ids = rows.map((row) => row.id);
    const lines =
      ids.length === 0
        ? []
        : await tx
            .select()
            .from(recipeLines)
            .where(
              and(
                eq(recipeLines.businessId, businessId),
                inArray(recipeLines.recipeId, ids),
              ),
            )
            .orderBy(asc(recipeLines.position));
    const linesByRecipe = new Map<string, Array<typeof recipeLines.$inferSelect>>();
    for (const line of lines) {
      const bucket = linesByRecipe.get(line.recipeId) ?? [];
      bucket.push(line);
      linesByRecipe.set(line.recipeId, bucket);
    }

    return rows.map((row) => ({
      id: row.id,
      variantId: row.variantId,
      name: row.name,
      localizedNames: row.localizedNames,
      yieldQty: formatDecimalString(row.yieldQty, 4),
      yieldUom: row.yieldUom,
      prepNotes: row.prepNotes,
      photoUrl: row.photoUrl,
      computedCost: formatDecimalString(row.computedCost, 4),
      costIsComplete: row.costIsComplete,
      foodCostPct: formatNullableDecimalString(row.foodCostPct, 4),
      lines: (linesByRecipe.get(row.id) ?? []).map((line) => ({
        id: line.id,
        componentType: line.componentType,
        ingredientId: line.ingredientId,
        subRecipeId: line.subRecipeId,
        quantity: formatDecimalString(line.quantity, 4),
        uom: line.uom,
        yieldPct: formatNullableDecimalString(line.yieldPct, 4),
        quantityIsCooked: line.quantityIsCooked,
        position: line.position,
      })),
    }));
  }
}

type NormalizedRecipeLineInput = {
  componentType: "ingredient" | "sub_recipe";
  ingredientId: string | null;
  subRecipeId: string | null;
  quantity: string;
  uom: string;
  yieldPct: string | null;
  quantityIsCooked: boolean;
  position: number;
};

function formatNullableDecimalString(
  value: string | null,
  scale: number,
): string | null {
  if (value === null) return null;
  return formatDecimalString(value, scale);
}

function formatDecimalString(value: string, scale: number): string {
  const [whole = "0", fraction = ""] = value.split(".");
  const trimmed = fraction.replace(/0+$/, "");
  const outputScale = Math.max(trimmed.length, scale);
  return outputScale === 0 ? whole : `${whole}.${trimmed.padEnd(outputScale, "0")}`;
}

function isUniqueViolation(error: unknown): boolean {
  if (
    typeof error === "object" &&
    error !== null &&
    "cause" in error &&
    isUniqueViolation((error as { cause?: unknown }).cause)
  ) {
    return true;
  }
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}
