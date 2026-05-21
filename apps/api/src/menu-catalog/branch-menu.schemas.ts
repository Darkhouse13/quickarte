import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import {
  decimalStringSchema,
  availabilityWindowSchema,
  dietaryTagSchema,
  localizedTextSchema,
  modifierGroupSchema,
  pricingModeSchema,
  variantKindSchema,
} from "./menu-catalog.schemas";

export const menuChannelSchema = z.enum([
  "pos",
  "dine_in",
  "takeaway",
  "delivery",
  "qr",
  "online",
]);

export const branchOverrideSourceSchema = z.enum(["inherited", "overridden"]);
export const taxSourceSchema = z.enum([
  "product",
  "category",
  "branch_default",
  "fallback",
]);
export const printRouteSourceSchema = z.enum(["product", "category", "legacy", "all"]);

export const effectiveMenuVariantSchema = z
  .object({
    id: z.uuid().nullable(),
    name: z.string(),
    price: decimalStringSchema.nullable(),
    priceSource: branchOverrideSourceSchema,
    isDefault: z.boolean(),
    available: z.boolean(),
    position: z.number().int(),
    variantKind: variantKindSchema,
    pricingMode: pricingModeSchema,
    displayPriceLabel: z.string().nullable(),
    displayPriceMin: decimalStringSchema.nullable(),
    displayPriceMax: decimalStringSchema.nullable(),
    unitLabel: z.string().nullable(),
    synthetic: z.boolean(),
  })
  .meta({ id: "EffectiveMenuVariant" });

export const effectiveMenuProductSchema = z
  .object({
    id: z.uuid(),
    categoryId: z.uuid().nullable(),
    name: z.string(),
    localizedNames: localizedTextSchema,
    description: z.string().nullable(),
    localizedDescriptions: localizedTextSchema,
    image: z.string().nullable(),
    sku: z.string().nullable(),
    itemCode: z.string().nullable(),
    colorTag: z.string().nullable(),
    featured: z.boolean(),
    featuredSource: branchOverrideSourceSchema,
    hidden: z.boolean(),
    hiddenSource: branchOverrideSourceSchema,
    available: z.boolean(),
    availableSource: branchOverrideSourceSchema,
    is86d: z.boolean(),
    eightySixedAt: z.string().nullable(),
    eightySixedReason: z.string().nullable(),
    position: z.number().int(),
    positionSource: branchOverrideSourceSchema,
    channels: z.object({
      dineIn: z.boolean(),
      takeaway: z.boolean(),
      delivery: z.boolean(),
      qr: z.boolean(),
      online: z.boolean(),
    }),
    effectiveTaxRateId: z.string(),
    taxSource: taxSourceSchema,
    printStations: z.array(z.string()),
    printRouteSource: printRouteSourceSchema,
    tags: z.array(dietaryTagSchema),
    spiceLevel: z.number().int().min(0).max(3).nullable(),
    availabilityWindows: z.array(availabilityWindowSchema),
    availableNow: z.boolean(),
    variants: z.array(effectiveMenuVariantSchema),
    modifiers: z.array(modifierGroupSchema),
  })
  .meta({ id: "EffectiveMenuProduct" });

const effectiveMenuCategoryBaseSchema = z
  .object({
    id: z.uuid(),
    parentId: z.uuid().nullable(),
    name: z.string(),
    localizedNames: localizedTextSchema,
    description: z.string().nullable(),
    localizedDescriptions: localizedTextSchema,
    colorTag: z.string().nullable(),
    visible: z.boolean(),
    visibleSource: branchOverrideSourceSchema,
    position: z.number().int(),
    positionSource: branchOverrideSourceSchema,
    products: z.array(effectiveMenuProductSchema),
  })
  .meta({ id: "EffectiveMenuCategoryBase" });

export const effectiveMenuCategorySchema = effectiveMenuCategoryBaseSchema
  .extend({
    children: z.array(effectiveMenuCategoryBaseSchema).default([]),
  })
  .meta({ id: "EffectiveMenuCategory" });

export const effectiveMenuResponseSchema = z
  .object({
    branchId: z.uuid(),
    channel: menuChannelSchema,
    generatedAt: z.string(),
    defaultTaxRateId: z.string(),
    categories: z.array(effectiveMenuCategorySchema),
  })
  .meta({ id: "EffectiveMenuResponse" });

export const categoryOverrideSchema = z.object({
  categoryId: z.uuid(),
  visible: z.boolean().nullable(),
  position: z.number().int().min(0).nullable(),
});

export const productOverrideSchema = z.object({
  productId: z.uuid(),
  available: z.boolean().nullable(),
  is86d: z.boolean().default(false),
  eightySixedAt: z.string().nullable(),
  eightySixedByUserId: z.uuid().nullable(),
  eightySixedReason: z.string().nullable(),
  featured: z.boolean().nullable(),
  hidden: z.boolean().nullable(),
  channels: z.object({
    dineIn: z.boolean().nullable(),
    takeaway: z.boolean().nullable(),
    delivery: z.boolean().nullable(),
    qr: z.boolean().nullable(),
    online: z.boolean().nullable(),
  }),
  position: z.number().int().min(0).nullable(),
});

export const priceOverrideSchema = z.object({
  productId: z.uuid(),
  variantId: z.uuid(),
  price: decimalStringSchema,
});

export const optionValueOverrideSchema = z.object({
  optionValueId: z.uuid(),
  available: z.boolean().nullable(),
  priceAddition: decimalStringSchema.nullable(),
});

export const categoryTaxOverrideSchema = z.object({
  categoryId: z.uuid(),
  taxRateId: z.string().min(1),
});

export const productTaxOverrideSchema = z.object({
  productId: z.uuid(),
  taxRateId: z.string().min(1),
});

export const categoryPrintRouteSchema = z.object({
  categoryId: z.uuid(),
  stations: z.array(z.string().min(1).max(32)).min(1),
});

export const productPrintRouteSchema = z.object({
  productId: z.uuid(),
  stations: z.array(z.string().min(1).max(32)).min(1),
});

export const menuOverridesResponseSchema = z
  .object({
    categoryOverrides: z.array(categoryOverrideSchema),
    productOverrides: z.array(productOverrideSchema),
    priceOverrides: z.array(priceOverrideSchema),
    optionValueOverrides: z.array(optionValueOverrideSchema),
    categoryTaxOverrides: z.array(categoryTaxOverrideSchema),
    productTaxOverrides: z.array(productTaxOverrideSchema),
    categoryPrintRoutes: z.array(categoryPrintRouteSchema),
    productPrintRoutes: z.array(productPrintRouteSchema),
  })
  .meta({ id: "BranchMenuOverridesResponse" });

export const replaceMenuOverridesBodySchema = menuOverridesResponseSchema;

export const updateProductAvailabilityBodySchema = z.object({
  available: z.boolean().nullable().optional(),
  is86d: z.boolean().optional(),
  eightySixedReason: z.string().nullable().optional(),
  hidden: z.boolean().nullable().optional(),
  channels: z
    .object({
      dineIn: z.boolean().nullable().optional(),
      takeaway: z.boolean().nullable().optional(),
      delivery: z.boolean().nullable().optional(),
      qr: z.boolean().nullable().optional(),
      online: z.boolean().nullable().optional(),
    })
    .optional(),
});

export const replaceProductPricesBodySchema = z.object({
  prices: z.array(priceOverrideSchema.omit({ productId: true })),
});

export const replaceMenuTaxOverridesBodySchema = z.object({
  categoryTaxOverrides: z.array(categoryTaxOverrideSchema),
  productTaxOverrides: z.array(productTaxOverrideSchema),
});

export const replaceMenuPrintRoutesBodySchema = z.object({
  categoryPrintRoutes: z.array(categoryPrintRouteSchema),
  productPrintRoutes: z.array(productPrintRouteSchema),
});

export class EffectiveMenuResponseDto extends createZodDto(effectiveMenuResponseSchema) {}
export class BranchMenuOverridesResponseDto extends createZodDto(menuOverridesResponseSchema) {}
export class ReplaceBranchMenuOverridesDto extends createZodDto(replaceMenuOverridesBodySchema) {}
export class UpdateProductAvailabilityDto extends createZodDto(updateProductAvailabilityBodySchema) {}
export class ReplaceBranchProductPricesDto extends createZodDto(replaceProductPricesBodySchema) {}
export class ReplaceMenuTaxOverridesDto extends createZodDto(replaceMenuTaxOverridesBodySchema) {}
export class ReplaceMenuPrintRoutesDto extends createZodDto(replaceMenuPrintRoutesBodySchema) {}

export type MenuChannel = z.infer<typeof menuChannelSchema>;
export type EffectiveMenuResponse = z.infer<typeof effectiveMenuResponseSchema>;
export type BranchMenuOverridesResponse = z.infer<typeof menuOverridesResponseSchema>;
export type ReplaceBranchMenuOverridesInput = z.infer<typeof replaceMenuOverridesBodySchema>;
export type UpdateProductAvailabilityInput = z.infer<typeof updateProductAvailabilityBodySchema>;
export type ReplaceBranchProductPricesInput = z.infer<typeof replaceProductPricesBodySchema>;
export type ReplaceMenuTaxOverridesInput = z.infer<typeof replaceMenuTaxOverridesBodySchema>;
export type ReplaceMenuPrintRoutesInput = z.infer<typeof replaceMenuPrintRoutesBodySchema>;
