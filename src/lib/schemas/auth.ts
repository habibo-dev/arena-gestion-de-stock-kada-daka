import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Identifiant requis.").max(60),
  password: z.string().min(1, "Mot de passe requis.").max(200),
});

export const userSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "3 caractères minimum.")
    .max(30)
    .regex(/^[a-z0-9._-]+$/, "Lettres minuscules, chiffres, point, tiret uniquement."),
  fullName: z.string().trim().min(2, "Nom complet requis.").max(80),
  email: z.union([z.literal(""), z.email("Adresse e-mail invalide.")]).nullable().optional(),
  role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]),
  password: z.string().min(6, "6 caractères minimum.").max(200).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export type UserFormValues = z.input<typeof userSchema>;

export const settingsSchema = z.object({
  "company.name": z.string().trim().min(1, "Le nom de l'entreprise est requis.").max(120),
  "company.address": z.string().trim().max(200),
  "company.phone": z.string().trim().max(40),
  "stock.allowNegative": z.enum(["true", "false"]),
  "sales.defaultPriceTier": z.enum(["DETAIL", "GROS"]),
  "sales.numberPrefix": z.string().trim().min(1).max(8).regex(/^[A-Z0-9]+$/, "Majuscules et chiffres uniquement."),
  "purchases.numberPrefix": z.string().trim().min(1).max(8).regex(/^[A-Z0-9]+$/, "Majuscules et chiffres uniquement."),
});

export type SettingsFormValues = z.input<typeof settingsSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Mot de passe actuel requis."),
    newPassword: z.string().min(6, "6 caractères minimum.").max(200),
    confirm: z.string(),
  })
  .refine((d) => d.newPassword === d.confirm, { message: "Les mots de passe ne correspondent pas.", path: ["confirm"] });
export type ChangePasswordValues = z.input<typeof changePasswordSchema>;
