import { z } from "zod";
import { UNITS } from "@/lib/stock";

const money = z.coerce.number().min(0, "Le prix ne peut pas être négatif.").max(100_000_000);
const optionalId = z.preprocess((v) => (v === "" || v === null || v === undefined || v === 0 || v === "0" ? null : v), z.coerce.number().int().positive().nullable());

export const partSchema = z.object({
  reference: z.string().trim().min(2, "La référence doit contenir au moins 2 caractères.").max(60),
  designation: z.string().trim().min(2, "La désignation est obligatoire.").max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  brandId: optionalId,
  brandName: z.string().trim().max(60).optional().nullable(),
  categoryId: optionalId,
  locationId: optionalId,
  locationCode: z.string().trim().max(30).optional().nullable(),
  supplierId: optionalId,
  unit: z.string().trim().min(1).max(20).default(UNITS[0]),
  purchasePrice: money,
  wholesalePrice: money,
  retailPrice: money,
  minStock: z.coerce.number().int("Le stock minimum doit être un entier.").min(0).max(1_000_000).default(0),
  barcode: z.string().trim().max(40).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  keywords: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  references: z
    .array(z.object({ type: z.enum(["OEM", "ALTERNATIVE", "SUPPLIER", "BARCODE"]), reference: z.string().trim().min(2).max(60) }))
    .max(50)
    .optional(),
  /** Initial quantity (creation only) → creates an IMPORT/adjustment movement. */
  initialQuantity: z.coerce.number().int().min(0).max(1_000_000).optional(),
});

export type PartFormValues = z.input<typeof partSchema>;

export const adjustSchema = z.object({
  partId: z.coerce.number().int().positive(),
  mode: z.enum(["ADD", "REMOVE", "SET"]),
  quantity: z.coerce.number().int("La quantité doit être un entier.").min(0).max(1_000_000),
  reason: z.string().trim().min(3, "Indiquez un motif (3 caractères minimum).").max(300),
  type: z.enum(["AJUSTEMENT", "RETOUR_CLIENT", "RETOUR_FOURNISSEUR", "INVENTAIRE"]).default("AJUSTEMENT"),
});
export type AdjustFormValues = z.input<typeof adjustSchema>;

export const transferSchema = z.object({
  partId: z.coerce.number().int().positive(),
  toLocationId: z.coerce.number().int().positive(),
  reason: z.string().trim().min(3).max(300),
});

export const compatSchema = z.object({
  partId: z.coerce.number().int().positive(),
  vehicleId: z.coerce.number().int().positive(),
  status: z.enum(["VERIFIED", "UNVERIFIED"]).default("UNVERIFIED"),
  note: z.string().trim().max(300).optional().nullable(),
});
