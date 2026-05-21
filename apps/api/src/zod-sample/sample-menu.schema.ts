import { productVariants } from "@quickarte/db-schema";
import { createSelectSchema } from "drizzle-zod";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const decimalStringSchema = z
  .string()
  .regex(/^-?\d+(\.\d{1,2})?$/, "Expected a decimal string")
  .meta({ description: "Decimal string money value, never a JS number" });

const drizzleProductVariantSchema = createSelectSchema(productVariants);

export const sampleMenuQuerySchema = z
  .object({
    branchId: z.uuid(),
    channel: z.enum(["pos", "qr", "online"]).default("pos"),
  })
  .meta({ id: "SampleEffectiveMenuRequest" });

export const sampleMenuVariantSchema = z
  .object({
    id: drizzleProductVariantSchema.shape.id,
    name: drizzleProductVariantSchema.shape.name,
    effectivePrice: decimalStringSchema,
    pricingMode: z.enum(["fixed", "variable_pos"]),
  })
  .meta({ id: "SampleMenuVariant" });

export const sampleMenuProductSchema = z
  .object({
    id: z.uuid(),
    name: z.record(z.string(), z.string()),
    effectivePrice: decimalStringSchema,
    variants: z.array(sampleMenuVariantSchema),
  })
  .meta({ id: "SampleMenuProduct" });

export const sampleMenuCategorySchema = z
  .object({
    id: z.uuid(),
    name: z.record(z.string(), z.string()),
    products: z.array(sampleMenuProductSchema),
  })
  .meta({ id: "SampleMenuCategory" });

export const sampleEffectiveMenuResponseSchema = z
  .object({
    branchId: z.uuid(),
    generatedAt: z.iso.datetime(),
    categories: z.array(sampleMenuCategorySchema),
  })
  .meta({ id: "SampleEffectiveMenuResponse" });

export class SampleEffectiveMenuRequestDto extends createZodDto(
  sampleMenuQuerySchema,
) {}

export class SampleEffectiveMenuResponseDto extends createZodDto(
  sampleEffectiveMenuResponseSchema,
) {}

export type SampleEffectiveMenuResponse = z.infer<
  typeof sampleEffectiveMenuResponseSchema
>;
