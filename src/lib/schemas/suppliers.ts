import { z } from "zod";

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "Le nom est obligatoire.").max(120),
  contactName: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  email: z.union([z.literal(""), z.email("Adresse e-mail invalide.")]).nullable().optional(),
  address: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
});

export type SupplierFormValues = z.input<typeof supplierSchema>;
