"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/server/auth/session";
import { runAction, safeRun } from "./utils";
import * as importService from "@/server/services/excel-import";
import { IMPORT_TARGET_FIELDS } from "@/lib/import-types";
import { BusinessError } from "@/lib/result";

const fieldKeys = IMPORT_TARGET_FIELDS.map((f) => f.key) as [string, ...string[]];
const mappingSchema = z.record(z.string(), z.union([z.enum(fieldKeys), z.literal("")]));

export async function uploadWorkbookAction(formData: FormData) {
  return safeRun(async () => {
    await requirePermission("import.run");
    const file = formData.get("file");
    if (!(file instanceof File)) throw new BusinessError("Aucun fichier reçu.");
    const bytes = Buffer.from(await file.arrayBuffer());
    return importService.storeUploadedWorkbook({ name: file.name, bytes });
  });
}

const validateSchema = z.object({ token: z.string().min(10), sheetName: z.string().min(1), mapping: mappingSchema });

export async function validateImportAction(input: unknown) {
  return runAction(validateSchema, input, async (data) => {
    await requirePermission("import.run");
    const mapping = Object.fromEntries(Object.entries(data.mapping).map(([k, v]) => [Number(k), v])) as Parameters<typeof importService.validateImport>[2];
    return importService.validateImport(data.token, data.sheetName, mapping);
  });
}

const commitSchema = validateSchema.extend({
  fileName: z.string().min(1).max(200),
  options: z.object({
    existingStrategy: z.enum(["update", "skip", "update-no-stock"]),
    applyQuantities: z.boolean(),
    strict: z.boolean(),
  }),
});

export async function commitImportAction(input: unknown) {
  return runAction(commitSchema, input, async (data) => {
    const user = await requirePermission("import.run");
    const mapping = Object.fromEntries(Object.entries(data.mapping).map(([k, v]) => [Number(k), v])) as Parameters<typeof importService.commitImport>[2];
    const res = await importService.commitImport(data.token, data.sheetName, mapping, data.options, user.id, data.fileName);
    revalidatePath("/pieces");
    revalidatePath("/mouvements");
    revalidatePath("/import-export");
    revalidatePath("/");
    return res;
  });
}
