import { z } from "zod";

const moroccanPhoneRegex = /^(?:\+212|0)[5-7]\d{8}$/;

export const placeOrderSchema = z
  .object({
    customerName: z.string().trim().min(1, "Le nom est requis"),
    customerPhone: z
      .string()
      .trim()
      .transform((v) => v.replace(/\s+/g, ""))
      .refine(
        (v) => moroccanPhoneRegex.test(v),
        "Numéro invalide (ex: +212 6XX XXX XXX)",
      ),
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
