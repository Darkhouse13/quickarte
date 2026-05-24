import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  branches,
  ingredientUnitConversions,
  ingredients,
  modifierValueIngredientDeltas,
  optionValues,
  productOptions,
  productVariants,
  products,
  recipeLines,
  recipes,
  stockLevels,
  stockMovements,
  unitsOfMeasure,
} from "@quickarte/db-schema";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  convertToStockUom,
  UnitConversionError,
  type UnitDefinition,
} from "../ingredients/unit-conversion";
import { DatabaseService, type TenantedDrizzleClient } from "../database/database.service";
import {
  addDecimalStrings,
  applyYieldToCookedQuantity,
  assertPositiveDecimal,
  compareDecimal,
  divideDecimalStrings,
  multiplyDecimalStrings,
  negateDecimalString,
  normalizeDecimal,
  StockDecimalError,
} from "./stock-decimal";
import type { CreateStockAdjustmentInput, StockDeductionLineInput } from "./stock.schemas";

const MAX_RECIPE_DEPTH = 64;

@Injectable()
export class StockService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  async listLevels(businessId: string, branchId: string) {
    return this.databaseService.withTenant(businessId, async (tx) => {
      await this.assertBranchBelongsToTenant(tx, businessId, branchId);
      const rows = await tx
        .select({
          level: stockLevels,
          ingredientName: ingredients.name,
          stockUom: ingredients.stockUom,
        })
        .from(stockLevels)
        .leftJoin(ingredients, eq(stockLevels.ingredientId, ingredients.id))
        .where(
          and(eq(stockLevels.businessId, businessId), eq(stockLevels.branchId, branchId)),
        )
        .orderBy(asc(ingredients.name), asc(stockLevels.ingredientId));
      return {
        levels: rows.map((row) =>
          this.formatLevel(row.level, row.ingredientName, row.stockUom),
        ),
      };
    });
  }

  async listMovements(
    businessId: string,
    branchId: string,
    input: { ingredientId?: string },
  ) {
    return this.databaseService.withTenant(businessId, async (tx) => {
      await this.assertBranchBelongsToTenant(tx, businessId, branchId);
      const conditions = [
        eq(stockMovements.businessId, businessId),
        eq(stockMovements.branchId, branchId),
      ];
      if (input.ingredientId) {
        conditions.push(eq(stockMovements.ingredientId, input.ingredientId));
      }
      const rows = await tx
        .select()
        .from(stockMovements)
        .where(and(...conditions))
        .orderBy(asc(stockMovements.createdAt), asc(stockMovements.id));
      return { movements: rows.map((row) => this.formatMovement(row)) };
    });
  }

  async adjustStock(input: {
    businessId: string;
    branchId: string;
    ingredientId: string;
    quantityDelta: string;
    reason: string;
    createdBy: string | null;
  }) {
    return this.databaseService.withTenant(input.businessId, async (tx) =>
      this.adjustStockInTransaction(tx, input),
    );
  }

  async adjustStockFromDto(
    businessId: string,
    branchId: string,
    createdBy: string | null,
    input: CreateStockAdjustmentInput,
  ) {
    return this.adjustStock({
      businessId,
      branchId,
      ingredientId: input.ingredientId,
      quantityDelta: input.quantityDelta,
      reason: input.reason,
      createdBy,
    });
  }

  async deductForSale(input: DeductForSaleInput): Promise<StockDeductionSummary> {
    return this.databaseService.withTenant(input.businessId, async (tx) =>
      this.deductForSaleInTransaction(tx, input),
    );
  }

  async deductForSaleInTransaction(
    tx: TenantedDrizzleClient,
    input: DeductForSaleInput,
  ): Promise<StockDeductionSummary> {
    await this.assertBranchBelongsToTenant(tx, input.businessId, input.branchId);
    const existing = await tx
      .select({ id: stockMovements.id })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.businessId, input.businessId),
          eq(stockMovements.movementType, "sale_deduction"),
          eq(stockMovements.referenceType, input.referenceType),
          eq(stockMovements.referenceId, input.referenceId),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      return {
        alreadyDeducted: true,
        deductions: [],
        negatives: [],
        skipped: [],
        configurationWarnings: [],
      };
    }

    const units = await tx.select().from(unitsOfMeasure);
    const memo = new Map<string, IngredientQuantityMap>();
    const totals = new Map<string, string>();
    const ingredientOrigins = new Map<string, Set<string>>();
    const skipped: StockDeductionSkippedLine[] = [];
    const configurationWarnings: StockDeductionConfigurationWarning[] = [];

    for (const line of input.lines) {
      const saleQuantity = assertPositiveDecimal(line.quantity);
      const recipe = await this.findVariantRecipe(tx, input.businessId, line.variantId);
      if (!recipe) {
        skipped.push({ variantId: line.variantId, reason: "no_recipe" });
        continue;
      }
      const perYield = await this.explodeRecipePerYield(tx, input.businessId, recipe.id, units, memo, []);
      const scale = divideDecimalStrings(saleQuantity, recipe.yieldQty);
      const lineTotals = new Map<string, string>();
      this.addScaledMap(lineTotals, perYield, scale);
      await this.addModifierDeltasForLine(
        tx,
        input.businessId,
        line.variantId,
        line.selectedOptionValueIds ?? [],
        saleQuantity,
        units,
        lineTotals,
      );
      for (const [ingredientId, quantity] of [...lineTotals.entries()]) {
        if (compareDecimal(quantity, "0") < 0) {
          const selectedOptionValueId = line.selectedOptionValueIds?.[0] ?? null;
          configurationWarnings.push({
            variantId: line.variantId,
            optionValueId: selectedOptionValueId,
            ingredientId,
            reason: "modifier_delta_clamped_to_zero",
          });
          lineTotals.set(ingredientId, "0.0000");
        }
      }
      for (const [ingredientId, quantity] of lineTotals.entries()) {
        if (compareDecimal(quantity, "0") === 0) continue;
        addToMap(totals, ingredientId, quantity);
        const origins = ingredientOrigins.get(ingredientId) ?? new Set<string>();
        origins.add(line.variantId);
        ingredientOrigins.set(ingredientId, origins);
      }
    }

    if (totals.size === 0) {
      return {
        alreadyDeducted: false,
        deductions: [],
        negatives: [],
        skipped,
        configurationWarnings,
      };
    }

    const ingredientRows = await tx
      .select({
        id: ingredients.id,
        trackedInStock: ingredients.trackedInStock,
      })
      .from(ingredients)
      .where(
        and(
          eq(ingredients.businessId, input.businessId),
          inArray(ingredients.id, [...totals.keys()]),
          isNull(ingredients.deletedAt),
        ),
      );
    const ingredientById = new Map(ingredientRows.map((row) => [row.id, row]));

    const deductions: StockDeductionLineSummary[] = [];
    const negatives: StockNegativeSummary[] = [];
    for (const [ingredientId, deductedQty] of totals.entries()) {
      const ingredient = ingredientById.get(ingredientId);
      if (!ingredient) throw new NotFoundException("Ingredient not found");
      if (!ingredient.trackedInStock) {
        for (const variantId of ingredientOrigins.get(ingredientId) ?? []) {
          skipped.push({
            variantId,
            reason: "untracked_ingredient",
            ingredientId,
          });
        }
        continue;
      }

      const quantityDelta = negateDecimalString(deductedQty);
      await tx.insert(stockMovements).values({
        businessId: input.businessId,
        branchId: input.branchId,
        ingredientId,
        quantityDelta,
        movementType: "sale_deduction",
        reason: input.reason ?? "Sale deduction",
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        createdBy: input.createdBy,
      });
      const level = await this.applyLevelDelta(
        tx,
        input.businessId,
        input.branchId,
        ingredientId,
        quantityDelta,
      );
      const deduction = {
        ingredientId,
        deductedQty: normalizeDecimal(deductedQty),
        resultingLevel: level.currentQty,
      };
      deductions.push(deduction);
      if (compareDecimal(level.currentQty, "0") < 0) {
        negatives.push({ ingredientId, resultingLevel: level.currentQty });
      }
    }

    return {
      alreadyDeducted: false,
      deductions,
      negatives,
      skipped: dedupeSkipped(skipped),
      configurationWarnings,
    };
  }

  async reverseForSale(input: ReverseForSaleInput): Promise<StockReversalSummary> {
    return this.databaseService.withTenant(input.businessId, async (tx) => {
      await this.assertBranchBelongsToTenant(tx, input.businessId, input.branchId);
      const reversalReferenceType = `reversal:${input.referenceType}`;
      const alreadyReversed = await tx
        .select({ id: stockMovements.id })
        .from(stockMovements)
        .where(
          and(
            eq(stockMovements.businessId, input.businessId),
            eq(stockMovements.referenceType, reversalReferenceType),
            eq(stockMovements.referenceId, input.referenceId),
          ),
        )
        .limit(1);
      if (alreadyReversed.length > 0) {
        return { reversed: false, deductions: [] };
      }

      const originalMovements = await tx
        .select()
        .from(stockMovements)
        .where(
          and(
            eq(stockMovements.businessId, input.businessId),
            eq(stockMovements.branchId, input.branchId),
            eq(stockMovements.movementType, "sale_deduction"),
            eq(stockMovements.referenceType, input.referenceType),
            eq(stockMovements.referenceId, input.referenceId),
          ),
        )
        .orderBy(asc(stockMovements.createdAt), asc(stockMovements.id));
      const deductions: StockDeductionLineSummary[] = [];
      for (const movement of originalMovements) {
        const positiveDelta = negateDecimalString(movement.quantityDelta);
        await tx.insert(stockMovements).values({
          businessId: input.businessId,
          branchId: input.branchId,
          ingredientId: movement.ingredientId,
          quantityDelta: positiveDelta,
          movementType: "adjustment",
          reason: `Reversal for ${input.referenceType}:${input.referenceId}`,
          referenceType: reversalReferenceType,
          referenceId: input.referenceId,
          createdBy: input.createdBy,
        });
        const level = await this.applyLevelDelta(
          tx,
          input.businessId,
          input.branchId,
          movement.ingredientId,
          positiveDelta,
        );
        deductions.push({
          ingredientId: movement.ingredientId,
          deductedQty: normalizeDecimal(positiveDelta),
          resultingLevel: level.currentQty,
        });
      }
      return { reversed: originalMovements.length > 0, deductions };
    });
  }

  async reconcileLevelsFromLedger(businessId: string, branchId: string) {
    return this.databaseService.withTenant(businessId, async (tx) => {
      await this.assertBranchBelongsToTenant(tx, businessId, branchId);
      await tx.delete(stockLevels).where(
        and(eq(stockLevels.businessId, businessId), eq(stockLevels.branchId, branchId)),
      );
      await tx.execute(sql`
        INSERT INTO stock_levels (business_id, branch_id, ingredient_id, current_qty, updated_at)
        SELECT business_id, branch_id, ingredient_id, coalesce(sum(quantity_delta), 0), now()
        FROM stock_movements
        WHERE business_id = ${businessId} AND branch_id = ${branchId}
        GROUP BY business_id, branch_id, ingredient_id
      `);
      const rows = await tx
        .select({
          level: stockLevels,
          ingredientName: ingredients.name,
          stockUom: ingredients.stockUom,
        })
        .from(stockLevels)
        .leftJoin(ingredients, eq(stockLevels.ingredientId, ingredients.id))
        .where(
          and(eq(stockLevels.businessId, businessId), eq(stockLevels.branchId, branchId)),
        )
        .orderBy(asc(ingredients.name), asc(stockLevels.ingredientId));
      return {
        levels: rows.map((row) =>
          this.formatLevel(row.level, row.ingredientName, row.stockUom),
        ),
      };
    });
  }

  private async adjustStockInTransaction(
    tx: TenantedDrizzleClient,
    input: {
      businessId: string;
      branchId: string;
      ingredientId: string;
      quantityDelta: string;
      reason: string;
      createdBy: string | null;
    },
  ) {
    await this.assertBranchBelongsToTenant(tx, input.businessId, input.branchId);
    await this.findIngredient(tx, input.businessId, input.ingredientId);
    const quantityDelta = normalizeDecimal(input.quantityDelta);
    if (compareDecimal(quantityDelta, "0") === 0) {
      throw new BadRequestException("Adjustment quantity cannot be zero");
    }
    const [movement] = await tx
      .insert(stockMovements)
      .values({
        businessId: input.businessId,
        branchId: input.branchId,
        ingredientId: input.ingredientId,
        quantityDelta,
        movementType: "adjustment",
        reason: input.reason.trim(),
        createdBy: input.createdBy,
      })
      .returning();
    if (!movement) throw new Error("Failed to write stock movement");
    const level = await this.applyLevelDelta(
      tx,
      input.businessId,
      input.branchId,
      input.ingredientId,
      quantityDelta,
    );
    return {
      movement: this.formatMovement(movement),
      level: this.formatLevel(level, null, null),
    };
  }

  private async explodeRecipePerYield(
    tx: TenantedDrizzleClient,
    businessId: string,
    recipeId: string,
    units: UnitDefinition[],
    memo: Map<string, IngredientQuantityMap>,
    stack: string[],
  ): Promise<IngredientQuantityMap> {
    const cached = memo.get(recipeId);
    if (cached) return new Map(cached);
    if (stack.includes(recipeId) || stack.length > MAX_RECIPE_DEPTH) {
      throw new ConflictException({
        type: "https://api.quickarte.ma/problems/recipe-cycle-detected",
        message: "Recipe dependency graph contains a cycle.",
        error: "Conflict",
        recipe_id: recipeId,
      });
    }

    const recipe = await this.findRecipe(tx, businessId, recipeId);
    const lines = await tx
      .select()
      .from(recipeLines)
      .where(and(eq(recipeLines.businessId, businessId), eq(recipeLines.recipeId, recipeId)))
      .orderBy(asc(recipeLines.position));
    const output = new Map<string, string>();
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
    const ingredientsById = new Map(ingredientRows.map((ingredient) => [ingredient.id, ingredient]));
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
    const conversionsByIngredient = new Map<string, Array<{ altUom: string; qtyInStockUom: string }>>();
    for (const conversion of conversionRows) {
      const bucket = conversionsByIngredient.get(conversion.ingredientId) ?? [];
      bucket.push({ altUom: conversion.altUom, qtyInStockUom: conversion.qtyInStockUom });
      conversionsByIngredient.set(conversion.ingredientId, bucket);
    }

    for (const line of lines) {
      try {
        if (line.componentType === "ingredient") {
          const ingredient = line.ingredientId ? ingredientsById.get(line.ingredientId) : undefined;
          if (!ingredient) throw new NotFoundException("Ingredient not found");
          const rawQuantity = line.quantityIsCooked
            ? applyYieldToCookedQuantity(line.quantity, line.yieldPct)
            : line.quantity;
          const converted = convertToStockUom(rawQuantity, line.uom, {
            stockUom: ingredient.stockUom,
            units,
            conversions: conversionsByIngredient.get(ingredient.id) ?? [],
          });
          addToMap(output, ingredient.id, converted);
        } else {
          const subRecipeId = line.subRecipeId;
          if (!subRecipeId) throw new BadRequestException("Sub-recipe line is missing sub_recipe_id");
          const subRecipe = await this.findRecipe(tx, businessId, subRecipeId);
          if (!subRecipe.yieldUom) throw new BadRequestException("Sub-recipe yield unit is missing");
          const convertedSubRecipeQty = convertToStockUom(line.quantity, line.uom, {
            stockUom: subRecipe.yieldUom,
            units,
            conversions: [],
          });
          const childPerYield = await this.explodeRecipePerYield(
            tx,
            businessId,
            subRecipeId,
            units,
            memo,
            [...stack, recipe.id],
          );
          const scale = divideDecimalStrings(convertedSubRecipeQty, subRecipe.yieldQty);
          this.addScaledMap(output, childPerYield, scale);
        }
      } catch (error) {
        if (error instanceof StockDecimalError || error instanceof UnitConversionError) {
          throw new BadRequestException({
            type: "https://api.quickarte.ma/problems/stock-deduction-invalid",
            message: error.message,
            error: "Bad Request",
          });
        }
        throw error;
      }
    }

    memo.set(recipe.id, new Map(output));
    return output;
  }

  private async addModifierDeltasForLine(
    tx: TenantedDrizzleClient,
    businessId: string,
    variantId: string,
    selectedOptionValueIds: string[],
    saleQuantity: string,
    units: UnitDefinition[],
    lineTotals: IngredientQuantityMap,
  ): Promise<void> {
    const uniqueOptionValueIds = [...new Set(selectedOptionValueIds)];
    if (uniqueOptionValueIds.length === 0) return;

    const optionRows = await tx
      .select({
        optionValueId: optionValues.id,
        templateValueId: optionValues.templateValueId,
      })
      .from(optionValues)
      .innerJoin(productOptions, eq(optionValues.optionId, productOptions.id))
      .innerJoin(productVariants, eq(productOptions.productId, productVariants.productId))
      .innerJoin(products, eq(productOptions.productId, products.id))
      .where(
        and(
          eq(products.businessId, businessId),
          eq(productVariants.id, variantId),
          inArray(optionValues.id, uniqueOptionValueIds),
          isNull(products.deletedAt),
        ),
      );
    const templateValueIds = optionRows
      .map((row) => row.templateValueId)
      .filter((id): id is string => id !== null);
    if (templateValueIds.length === 0) return;

    const deltaRows = await tx
      .select({
        delta: modifierValueIngredientDeltas,
        ingredient: ingredients,
      })
      .from(modifierValueIngredientDeltas)
      .innerJoin(ingredients, eq(modifierValueIngredientDeltas.ingredientId, ingredients.id))
      .where(
        and(
          eq(modifierValueIngredientDeltas.businessId, businessId),
          inArray(modifierValueIngredientDeltas.modifierValueTemplateId, templateValueIds),
          eq(ingredients.businessId, businessId),
          isNull(ingredients.deletedAt),
        ),
      )
      .orderBy(
        asc(modifierValueIngredientDeltas.modifierValueTemplateId),
        asc(modifierValueIngredientDeltas.position),
      );
    if (deltaRows.length === 0) return;

    const ingredientIds = [...new Set(deltaRows.map((row) => row.delta.ingredientId))];
    const conversionRows = await tx
      .select()
      .from(ingredientUnitConversions)
      .where(
        and(
          eq(ingredientUnitConversions.businessId, businessId),
          inArray(ingredientUnitConversions.ingredientId, ingredientIds),
        ),
      );
    const conversionsByIngredient = new Map<string, Array<{ altUom: string; qtyInStockUom: string }>>();
    for (const conversion of conversionRows) {
      const bucket = conversionsByIngredient.get(conversion.ingredientId) ?? [];
      bucket.push({ altUom: conversion.altUom, qtyInStockUom: conversion.qtyInStockUom });
      conversionsByIngredient.set(conversion.ingredientId, bucket);
    }

    for (const row of deltaRows) {
      try {
        const sign = compareDecimal(row.delta.quantityDelta, "0") < 0 ? "-" : "";
        const absoluteDelta = sign === "-"
          ? normalizeDecimal(row.delta.quantityDelta).slice(1)
          : normalizeDecimal(row.delta.quantityDelta);
        const rawQuantity = row.delta.quantityIsCooked
          ? applyYieldToCookedQuantity(absoluteDelta, row.delta.yieldPct)
          : absoluteDelta;
        const converted = convertToStockUom(rawQuantity, row.delta.uom, {
          stockUom: row.ingredient.stockUom,
          units,
          conversions: conversionsByIngredient.get(row.ingredient.id) ?? [],
        });
        const signedConverted = sign === "-" ? negateDecimalString(converted) : converted;
        addToMap(
          lineTotals,
          row.ingredient.id,
          multiplyDecimalStrings(signedConverted, saleQuantity),
        );
      } catch (error) {
        if (error instanceof StockDecimalError || error instanceof UnitConversionError) {
          throw new BadRequestException({
            type: "https://api.quickarte.ma/problems/stock-deduction-invalid",
            message: error.message,
            error: "Bad Request",
          });
        }
        throw error;
      }
    }
  }

  private async findVariantRecipe(
    tx: TenantedDrizzleClient,
    businessId: string,
    variantId: string,
  ) {
    const [variant] = await tx
      .select({ id: productVariants.id })
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
    if (!variant) throw new NotFoundException("Variant not found");

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
    return recipe ?? null;
  }

  private async findRecipe(
    tx: TenantedDrizzleClient,
    businessId: string,
    recipeId: string,
  ) {
    const [recipe] = await tx
      .select()
      .from(recipes)
      .where(and(eq(recipes.businessId, businessId), eq(recipes.id, recipeId), isNull(recipes.deletedAt)))
      .limit(1);
    if (!recipe) throw new NotFoundException("Recipe not found");
    return recipe;
  }

  private async findIngredient(
    tx: TenantedDrizzleClient,
    businessId: string,
    ingredientId: string,
  ) {
    const [ingredient] = await tx
      .select()
      .from(ingredients)
      .where(
        and(
          eq(ingredients.businessId, businessId),
          eq(ingredients.id, ingredientId),
          isNull(ingredients.deletedAt),
        ),
      )
      .limit(1);
    if (!ingredient) throw new NotFoundException("Ingredient not found");
    return ingredient;
  }

  private async assertBranchBelongsToTenant(
    tx: TenantedDrizzleClient,
    businessId: string,
    branchId: string,
  ) {
    const [branch] = await tx
      .select({ id: branches.id })
      .from(branches)
      .where(
        and(eq(branches.businessId, businessId), eq(branches.id, branchId), isNull(branches.deletedAt)),
      )
      .limit(1);
    if (!branch) throw new NotFoundException("Branch not found");
  }

  private addScaledMap(
    target: IngredientQuantityMap,
    source: IngredientQuantityMap,
    scale: string,
  ) {
    for (const [ingredientId, quantity] of source.entries()) {
      addToMap(target, ingredientId, multiplyDecimalStrings(quantity, scale));
    }
  }

  private async applyLevelDelta(
    tx: TenantedDrizzleClient,
    businessId: string,
    branchId: string,
    ingredientId: string,
    quantityDelta: string,
  ) {
    await tx
      .insert(stockLevels)
      .values({
        businessId,
        branchId,
        ingredientId,
        currentQty: quantityDelta,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [stockLevels.businessId, stockLevels.branchId, stockLevels.ingredientId],
        set: {
          currentQty: sql`${stockLevels.currentQty} + excluded.current_qty`,
          updatedAt: new Date(),
        },
      });
    const [level] = await tx
      .select()
      .from(stockLevels)
      .where(
        and(
          eq(stockLevels.businessId, businessId),
          eq(stockLevels.branchId, branchId),
          eq(stockLevels.ingredientId, ingredientId),
        ),
      )
      .limit(1);
    if (!level) throw new Error("Failed to update stock level");
    return level;
  }

  private formatMovement(row: typeof stockMovements.$inferSelect) {
    return {
      id: row.id,
      businessId: row.businessId,
      branchId: row.branchId,
      ingredientId: row.ingredientId,
      quantityDelta: normalizeDecimal(row.quantityDelta),
      movementType: row.movementType,
      reason: row.reason,
      referenceType: row.referenceType,
      referenceId: row.referenceId,
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy,
    };
  }

  private formatLevel(
    row: typeof stockLevels.$inferSelect,
    ingredientName: string | null,
    stockUom: string | null,
  ) {
    return {
      businessId: row.businessId,
      branchId: row.branchId,
      ingredientId: row.ingredientId,
      ingredientName,
      stockUom,
      currentQty: normalizeDecimal(row.currentQty),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

type IngredientQuantityMap = Map<string, string>;

export type DeductForSaleInput = {
  businessId: string;
  branchId: string;
  referenceType: string;
  referenceId: string;
  createdBy: string | null;
  reason?: string;
  lines: StockDeductionLineInput[];
};

export type ReverseForSaleInput = {
  businessId: string;
  branchId: string;
  referenceType: string;
  referenceId: string;
  createdBy: string | null;
};

export type StockDeductionSummary = {
  alreadyDeducted: boolean;
  deductions: StockDeductionLineSummary[];
  negatives: StockNegativeSummary[];
  skipped: StockDeductionSkippedLine[];
  configurationWarnings: StockDeductionConfigurationWarning[];
};

export type StockReversalSummary = {
  reversed: boolean;
  deductions: StockDeductionLineSummary[];
};

type StockDeductionLineSummary = {
  ingredientId: string;
  deductedQty: string;
  resultingLevel: string;
};

type StockNegativeSummary = {
  ingredientId: string;
  resultingLevel: string;
};

type StockDeductionSkippedLine =
  | { variantId: string; reason: "no_recipe" }
  | { variantId: string; reason: "untracked_ingredient"; ingredientId: string };

type StockDeductionConfigurationWarning = {
  variantId: string;
  optionValueId: string | null;
  ingredientId: string;
  reason: "modifier_delta_clamped_to_zero";
};

function addToMap(map: IngredientQuantityMap, ingredientId: string, quantity: string) {
  map.set(ingredientId, addDecimalStrings(map.get(ingredientId) ?? "0.0000", quantity));
}

function dedupeSkipped(rows: StockDeductionSkippedLine[]): StockDeductionSkippedLine[] {
  const seen = new Set<string>();
  const result: StockDeductionSkippedLine[] = [];
  for (const row of rows) {
    const key = `${row.variantId}:${row.reason}:${"ingredientId" in row ? row.ingredientId : ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result;
}
