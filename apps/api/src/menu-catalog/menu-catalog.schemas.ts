import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const decimalStringSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Expected a positive decimal string")
  .meta({ description: "Decimal string money value, never a JS number" });

export const localizedTextSchema = z.record(z.string().min(2), z.string().min(1));

export const variantKindSchema = z.enum([
  "size",
  "protein",
  "topping",
  "market",
  "custom",
]);
export const pricingModeSchema = z.enum(["fixed", "variable_pos"]);
export const modifierSourceSchema = z.enum(["product", "category"]);
export const modifierAttachScopeSchema = z.enum(["product", "category"]);
export const dietaryTagKindSchema = z.enum(["dietary", "allergen"]);

export const dietaryTagSchema = z
  .object({
    id: z.uuid(),
    kind: dietaryTagKindSchema,
    code: z.string(),
    localizedLabels: localizedTextSchema,
    position: z.number().int(),
    isSystem: z.boolean(),
  })
  .meta({ id: "DietaryTag" });

export const availabilityWindowSchema = z
  .object({
    id: z.uuid(),
    dayOfWeek: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(0).max(1439),
  })
  .meta({ id: "ProductAvailabilityWindow" });

export const menuVariantSchema = z
  .object({
    id: z.uuid().nullable(),
    name: z.string().min(1),
    price: decimalStringSchema.nullable(),
    isDefault: z.boolean(),
    available: z.boolean(),
    position: z.number().int().min(0),
    variantKind: variantKindSchema,
    pricingMode: pricingModeSchema,
    displayPriceLabel: z.string().nullable(),
    displayPriceMin: decimalStringSchema.nullable(),
    displayPriceMax: decimalStringSchema.nullable(),
    unitLabel: z.string().nullable(),
    synthetic: z.boolean(),
  })
  .meta({ id: "MenuVariant" });

export const productImageSchema = z
  .object({
    id: z.uuid().nullable(),
    url: z.string().min(1),
    altText: z.string().nullable(),
    position: z.number().int().min(0),
    isPrimary: z.boolean(),
  })
  .meta({ id: "MenuProductImage" });

export const modifierValueSchema = z
  .object({
    id: z.uuid().nullable(),
    templateValueId: z.uuid().nullable(),
    name: z.string(),
    localizedNames: localizedTextSchema,
    priceAddition: decimalStringSchema,
    position: z.number().int().min(0),
    available: z.boolean(),
    recipeHookKey: z.string().nullable(),
  })
  .meta({ id: "MenuModifierValue" });

export const modifierGroupSchema = z
  .object({
    id: z.uuid(),
    templateId: z.uuid().nullable(),
    name: z.string(),
    localizedNames: localizedTextSchema,
    type: z.enum(["single_select", "multi_select"]),
    required: z.boolean(),
    minSelect: z.number().int().min(0),
    maxSelect: z.number().int().min(0).nullable(),
    freeQuantity: z.number().int().min(0),
    extraPrice: decimalStringSchema.nullable(),
    attachScope: modifierAttachScopeSchema,
    reusable: z.boolean(),
    source: modifierSourceSchema,
    sourceCategoryId: z.uuid().nullable(),
    sourceCategoryName: z.string().nullable(),
    position: z.number().int().min(0),
    values: z.array(modifierValueSchema),
  })
  .meta({ id: "MenuModifierGroup" });

export const modifierGroupTemplateSchema = modifierGroupSchema
  .omit({
    templateId: true,
    source: true,
    sourceCategoryId: true,
    sourceCategoryName: true,
  })
  .extend({
    id: z.uuid(),
    values: z.array(modifierValueSchema),
  })
  .meta({ id: "MenuModifierGroupTemplate" });

const categoryBaseSchema = z
  .object({
    id: z.uuid(),
    parentId: z.uuid().nullable(),
    name: z.string(),
    slug: z.string().nullable(),
    description: z.string().nullable(),
    localizedNames: localizedTextSchema,
    localizedDescriptions: localizedTextSchema,
    colorTag: z.string().nullable(),
    position: z.number().int(),
    visible: z.boolean(),
  })
  .meta({ id: "MenuCategoryBase" });

export const categorySchema = categoryBaseSchema
  .extend({
    children: z.array(categoryBaseSchema).default([]),
  })
  .meta({ id: "MenuCategory" });

export const productSchema = z
  .object({
    id: z.uuid(),
    categoryId: z.uuid().nullable(),
    name: z.string(),
    description: z.string().nullable(),
    basePrice: decimalStringSchema,
    image: z.string().nullable(),
    sku: z.string().nullable(),
    itemCode: z.string().nullable(),
    colorTag: z.string().nullable(),
    featured: z.boolean(),
    hidden: z.boolean(),
    available: z.boolean(),
    channels: z.object({
      dineIn: z.boolean(),
      takeaway: z.boolean(),
      delivery: z.boolean(),
      qr: z.boolean(),
      online: z.boolean(),
    }),
    localizedNames: localizedTextSchema,
    localizedDescriptions: localizedTextSchema,
    spiceLevel: z.number().int().min(0).max(3).nullable(),
    position: z.number().int(),
    variants: z.array(menuVariantSchema),
    images: z.array(productImageSchema),
    modifiers: z.array(modifierGroupSchema),
    tags: z.array(dietaryTagSchema),
    availabilityWindows: z.array(availabilityWindowSchema),
  })
  .meta({ id: "MenuProduct" });

export const categoriesResponseSchema = z.object({
  categories: z.array(categorySchema),
});
export const productsResponseSchema = z.object({
  products: z.array(productSchema),
});
export const productResponseSchema = z.object({
  product: productSchema,
});
export const variantsResponseSchema = z.object({
  variants: z.array(menuVariantSchema),
});
export const imagesResponseSchema = z.object({
  images: z.array(productImageSchema),
});
export const deleteResponseSchema = z.object({ deleted: z.literal(true) });
export const modifierGroupsResponseSchema = z.object({
  groups: z.array(modifierGroupTemplateSchema),
});
export const modifierGroupResponseSchema = z.object({
  group: modifierGroupTemplateSchema,
});
export const effectiveModifierGroupsResponseSchema = z.object({
  groups: z.array(modifierGroupSchema),
});
export const tagsResponseSchema = z.object({
  tags: z.array(dietaryTagSchema),
});
export const tagResponseSchema = z.object({
  tag: dietaryTagSchema,
});
export const availabilityWindowsResponseSchema = z.object({
  windows: z.array(availabilityWindowSchema),
});

export const localeSettingsResponseSchema = z.object({
  activeLocales: z.array(z.string()),
  defaultLocale: z.string(),
  availableLocales: z.array(z.string()),
});

const baseCategoryWriteSchema = z.object({
  parentId: z.uuid().nullable().optional(),
  name: z.string().min(1).optional(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).nullable().optional(),
  description: z.string().nullable().optional(),
  localizedNames: localizedTextSchema.optional(),
  localizedDescriptions: localizedTextSchema.optional(),
  colorTag: z.string().nullable().optional(),
  visible: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

export const createCategoryBodySchema = baseCategoryWriteSchema.extend({
  localizedNames: localizedTextSchema,
});
export const updateCategoryBodySchema = baseCategoryWriteSchema;
export const reorderCategoriesBodySchema = z.object({
  categories: z.array(
    z.object({
      id: z.uuid(),
      parentId: z.uuid().nullable(),
      position: z.number().int().min(0),
    }),
  ),
});

const variantWriteSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().min(1),
  price: decimalStringSchema.nullable(),
  isDefault: z.boolean().default(false),
  available: z.boolean().default(true),
  position: z.number().int().min(0),
  variantKind: variantKindSchema.default("custom"),
  pricingMode: pricingModeSchema.default("fixed"),
  displayPriceLabel: z.string().nullable().optional(),
  displayPriceMin: decimalStringSchema.nullable().optional(),
  displayPriceMax: decimalStringSchema.nullable().optional(),
  unitLabel: z.string().nullable().optional(),
});

const modifierValueWriteSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().min(1),
  localizedNames: localizedTextSchema,
  priceAddition: decimalStringSchema.default("0.00"),
  position: z.number().int().min(0),
  available: z.boolean().default(true),
  recipeHookKey: z.string().nullable().optional(),
});

export const modifierGroupWriteSchema = z.object({
  name: z.string().min(1).optional(),
  localizedNames: localizedTextSchema,
  type: z.enum(["single_select", "multi_select"]).default("single_select"),
  required: z.boolean().default(false),
  minSelect: z.number().int().min(0).default(0),
  maxSelect: z.number().int().min(0).nullable().optional(),
  freeQuantity: z.number().int().min(0).default(0),
  extraPrice: decimalStringSchema.nullable().optional(),
  attachScope: modifierAttachScopeSchema.default("product"),
  reusable: z.boolean().default(true),
  values: z.array(modifierValueWriteSchema),
});

const imageWriteSchema = z.object({
  id: z.uuid().optional(),
  url: z.string().min(1),
  altText: z.string().nullable().optional(),
  position: z.number().int().min(0),
  isPrimary: z.boolean().default(false),
});

export const createProductBodySchema = z.object({
  categoryId: z.uuid().nullable().optional(),
  localizedNames: localizedTextSchema,
  localizedDescriptions: localizedTextSchema.optional(),
  basePrice: decimalStringSchema,
  sku: z.string().nullable().optional(),
  itemCode: z.string().nullable().optional(),
  colorTag: z.string().nullable().optional(),
  featured: z.boolean().default(false),
  hidden: z.boolean().default(false),
  available: z.boolean().default(true),
  spiceLevel: z.number().int().min(0).max(3).nullable().optional(),
  channels: z.object({
    dineIn: z.boolean().default(true),
    takeaway: z.boolean().default(true),
    delivery: z.boolean().default(true),
    qr: z.boolean().default(true),
    online: z.boolean().default(true),
  }),
  position: z.number().int().min(0).default(0),
  variants: z.array(variantWriteSchema).default([]),
  images: z.array(imageWriteSchema).default([]),
});

export const updateProductBodySchema = createProductBodySchema.partial();
export const listProductsQuerySchema = z.object({
  categoryId: z.uuid().optional(),
  search: z.string().optional(),
  hidden: z.enum(["true", "false"]).optional(),
});
export const replaceVariantsBodySchema = z.object({
  variants: z.array(variantWriteSchema),
});
export const replaceImagesBodySchema = z.object({
  images: z.array(imageWriteSchema),
});
export const reorderProductsBodySchema = z.object({
  products: z.array(
    z.object({
      id: z.uuid(),
      categoryId: z.uuid().nullable(),
      position: z.number().int().min(0),
    }),
  ),
});
export const updateLocaleSettingsBodySchema = z.object({
  activeLocales: z.array(z.string().min(2)).min(1),
  defaultLocale: z.string().min(2),
});
export const attachModifierGroupsBodySchema = z.object({
  groupTemplateIds: z.array(z.uuid()),
});
export const updateModifierGroupBodySchema = modifierGroupWriteSchema.partial();
export const createTagBodySchema = z.object({
  kind: dietaryTagKindSchema,
  code: z.string().regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/),
  localizedLabels: localizedTextSchema,
  position: z.number().int().min(0).default(0),
});
export const updateTagBodySchema = z.object({
  kind: dietaryTagKindSchema.optional(),
  code: z.string().regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/).optional(),
  localizedLabels: localizedTextSchema.optional(),
  position: z.number().int().min(0).optional(),
});
export const replaceProductTagsBodySchema = z.object({
  tagIds: z.array(z.uuid()),
});
const availabilityWindowWriteSchema = z.object({
  id: z.uuid().optional(),
  dayOfWeek: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(0).max(1439),
});
export const replaceAvailabilityWindowsBodySchema = z.object({
  windows: z.array(availabilityWindowWriteSchema),
});

export class MenuCategoryResponseDto extends createZodDto(categorySchema) {}
export class MenuCategoriesResponseDto extends createZodDto(categoriesResponseSchema) {}
export class MenuProductResponseDto extends createZodDto(productResponseSchema) {}
export class MenuProductsResponseDto extends createZodDto(productsResponseSchema) {}
export class MenuVariantsResponseDto extends createZodDto(variantsResponseSchema) {}
export class MenuImagesResponseDto extends createZodDto(imagesResponseSchema) {}
export class MenuDeleteResponseDto extends createZodDto(deleteResponseSchema) {}
export class MenuLocaleSettingsResponseDto extends createZodDto(localeSettingsResponseSchema) {}
export class MenuModifierGroupsResponseDto extends createZodDto(modifierGroupsResponseSchema) {}
export class MenuModifierGroupResponseDto extends createZodDto(modifierGroupResponseSchema) {}
export class MenuEffectiveModifierGroupsResponseDto extends createZodDto(effectiveModifierGroupsResponseSchema) {}
export class MenuTagsResponseDto extends createZodDto(tagsResponseSchema) {}
export class MenuTagResponseDto extends createZodDto(tagResponseSchema) {}
export class MenuAvailabilityWindowsResponseDto extends createZodDto(availabilityWindowsResponseSchema) {}

export class CreateMenuCategoryDto extends createZodDto(createCategoryBodySchema) {}
export class UpdateMenuCategoryDto extends createZodDto(updateCategoryBodySchema) {}
export class ReorderMenuCategoriesDto extends createZodDto(reorderCategoriesBodySchema) {}
export class CreateMenuProductDto extends createZodDto(createProductBodySchema) {}
export class UpdateMenuProductDto extends createZodDto(updateProductBodySchema) {}
export class ListMenuProductsQueryDto extends createZodDto(listProductsQuerySchema) {}
export class ReorderMenuProductsDto extends createZodDto(reorderProductsBodySchema) {}
export class ReplaceMenuVariantsDto extends createZodDto(replaceVariantsBodySchema) {}
export class ReplaceProductImagesDto extends createZodDto(replaceImagesBodySchema) {}
export class UpdateMenuLocaleSettingsDto extends createZodDto(updateLocaleSettingsBodySchema) {}
export class CreateModifierGroupDto extends createZodDto(modifierGroupWriteSchema) {}
export class UpdateModifierGroupDto extends createZodDto(updateModifierGroupBodySchema) {}
export class AttachModifierGroupsDto extends createZodDto(attachModifierGroupsBodySchema) {}
export class CreateDietaryTagDto extends createZodDto(createTagBodySchema) {}
export class UpdateDietaryTagDto extends createZodDto(updateTagBodySchema) {}
export class ReplaceProductTagsDto extends createZodDto(replaceProductTagsBodySchema) {}
export class ReplaceProductAvailabilityWindowsDto extends createZodDto(replaceAvailabilityWindowsBodySchema) {}

export type CategoryResponse = z.infer<typeof categorySchema>;
export type ProductResponse = z.infer<typeof productSchema>;
export type VariantResponse = z.infer<typeof menuVariantSchema>;
export type ImageResponse = z.infer<typeof productImageSchema>;
export type ModifierGroupResponse = z.infer<typeof modifierGroupSchema>;
export type ModifierGroupTemplateResponse = z.infer<typeof modifierGroupTemplateSchema>;
export type DietaryTagResponse = z.infer<typeof dietaryTagSchema>;
export type AvailabilityWindowResponse = z.infer<typeof availabilityWindowSchema>;
export type CreateProductInput = z.infer<typeof createProductBodySchema>;
export type UpdateProductInput = z.infer<typeof updateProductBodySchema>;
export type ListProductsQueryInput = z.infer<typeof listProductsQuerySchema>;
export type CreateCategoryInput = z.infer<typeof createCategoryBodySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategoryBodySchema>;
export type ReplaceVariantsInput = z.infer<typeof replaceVariantsBodySchema>;
export type ReplaceImagesInput = z.infer<typeof replaceImagesBodySchema>;
export type UpdateLocaleSettingsInput = z.infer<typeof updateLocaleSettingsBodySchema>;
export type ModifierGroupInput = z.infer<typeof modifierGroupWriteSchema>;
export type UpdateModifierGroupInput = z.infer<typeof updateModifierGroupBodySchema>;
export type AttachModifierGroupsInput = z.infer<typeof attachModifierGroupsBodySchema>;
export type CreateTagInput = z.infer<typeof createTagBodySchema>;
export type UpdateTagInput = z.infer<typeof updateTagBodySchema>;
export type ReplaceProductTagsInput = z.infer<typeof replaceProductTagsBodySchema>;
export type ReplaceAvailabilityWindowsInput = z.infer<typeof replaceAvailabilityWindowsBodySchema>;
