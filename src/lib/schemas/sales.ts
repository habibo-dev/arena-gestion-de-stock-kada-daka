import { z } from "zod";

export const saleSchema = z.object({
  customerId: z.coerce.number().int().positive().nullable().optional(),
  customerName: z.string().trim().max(120).nullable().optional(),
  customerPhone: z.string().trim().max(30).nullable().optional(),
  priceTier: z.enum(["DETAIL", "GROS"]),
  paymentMethod: z.enum(["ESPECES", "CARTE", "VIREMENT", "CHEQUE", "CREDIT"]),
  discountType: z.enum(["NONE", "PERCENT", "AMOUNT"]),
  discountValue: z.coerce.number().min(0).max(100_000_000).default(0),
  notes: z.string().trim().max(1000).nullable().optional(),
  items: z
    .array(
      z.object({
        partId: z.coerce.number().int().positive(),
        quantity: z.coerce.number().int("Quantité entière requise.").positive("La quantité doit être au moins 1."),
        unitPrice: z.coerce.number().min(0),
      }),
    )
    .min(1, "Ajoutez au moins une pièce."),
});

export type SaleFormValues = z.input<typeof saleSchema>;
export type SaleFormOutput = z.output<typeof saleSchema>;

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Le nom est obligatoire.").max(120),
  phone: z.string().trim().max(30).nullable().optional(),
  customerType: z.enum(["PARTICULIER", "PROFESSIONNEL"]).default("PARTICULIER"),
  address: z.string().trim().max(200).nullable().optional(),
});
export type CustomerFormValues = z.input<typeof customerSchema>;
