import { z } from "zod";

const optionalInt = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.number().int().nullable());
const fuel = z.preprocess((v) => (v === "" ? null : v), z.enum(["Diesel", "Essence", "GPL", "Hybride", "Électrique"]).nullable());

export const vehicleSchema = z.object({
  makeName: z.string().trim().min(2, "La marque est obligatoire.").max(60),
  modelName: z.string().trim().min(1, "Le modèle est obligatoire.").max(60),
  generation: z.string().trim().max(40).nullable().optional(),
  modelYearFrom: optionalInt.optional(),
  modelYearTo: optionalInt.optional(),
  engineLabel: z.string().trim().min(2, "La motorisation est obligatoire (ex. 1.5 dCi 90).").max(60),
  displacement: z.string().trim().max(20).nullable().optional(),
  fuel: fuel.optional(),
  powerHp: optionalInt.optional(),
  engineCode: z.string().trim().max(40).nullable().optional(),
  yearFrom: optionalInt.optional(),
  yearTo: optionalInt.optional(),
});

export type VehicleFormValues = z.input<typeof vehicleSchema>;
