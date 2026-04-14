import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis"),
  description: z
    .string()
    .trim()
    .transform((v) => (v.length === 0 ? undefined : v))
    .optional(),
  price: z.coerce
    .number({ invalid_type_error: "Prix invalide" })
    .positive("Le prix doit être positif"),
  categoryId: z.string().uuid("Catégorie invalide"),
  available: z
    .union([z.boolean(), z.literal("true"), z.literal("false"), z.literal("on")])
    .transform((v) => v === true || v === "true" || v === "on")
    .default(true),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
