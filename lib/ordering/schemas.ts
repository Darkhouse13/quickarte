import { z } from "zod";
import { frenchPhoneSchema } from "@/lib/utils/phone";

export const placeOrderSchema = z
  .object({
    customerName: z.string().trim().min(1, "Le nom est requis"),
    customerPhone: frenchPhoneSchema,
    orderType: z.enum(["dine_in", "takeaway"]),
    tableNumber: z.coerce
      .number({ invalid_type_error: "Numéro de table invalide" })
      .int()
      .positive()
      .optional(),
    notes: z
      .string()
      .trim()
      .transform((v) => (v.length === 0 ? undefined : v))
      .optional(),
    items: z
      .array(
        z.object({
          productId: z.string().uuid("Produit invalide"),
          quantity: z
            .number({ invalid_type_error: "Quantité invalide" })
            .int()
            .positive(),
        }),
      )
      .min(1, "Panier vide"),
    businessId: z.string().uuid(),
  })
  .refine(
    (data) => data.orderType !== "dine_in" || data.tableNumber !== undefined,
    {
      message: "Numéro de table requis pour sur place",
      path: ["tableNumber"],
    },
  );

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
