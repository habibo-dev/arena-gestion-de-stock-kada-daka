import { z } from "zod";

export const purchaseSchema = z.object({
  supplierId: z.coerce.number().int().positive("Sélectionnez un fournisseur."),
  supplierInvoiceNumber: z.string().trim().max(60).nullable().optional(),
  expectedAt: z.string().trim().max(30).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  items: z
    .array(
      z.object({
        partId: z.coerce.number().int().positive(),
        quantity: z.coerce.number().int("Quantité entière requise.").positive("La quantité doit être au moins 1."),
        unitCost: z.coerce.number().min(0),
      }),
    )
    .min(1, "Ajoutez au moins une pièce."),
});

export type PurchaseFormValues = z.input<typeof purchaseSchema>;
export type PurchaseFormOutput = z.output<typeof purchaseSchema>;
