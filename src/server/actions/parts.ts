"use server";

import { revalidatePath } from "next/cache";
import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import sharp from "sharp";
import { requirePermission } from "@/server/auth/session";
import { runAction, safeRun } from "./utils";
import * as partsService from "@/server/services/parts";
import { adjustStock, transferStock } from "@/server/services/movements";
import { partSchema, adjustSchema, transferSchema, compatSchema } from "@/lib/schemas/parts";
import { BusinessError } from "@/lib/result";

export async function createPartAction(input: unknown) {
  return runAction(partSchema, input, async (data) => {
    const user = await requirePermission("parts.create");
    const { initialQuantity, ...rest } = data;
    const id = partsService.createPart(rest);
    if (initialQuantity && initialQuantity > 0) {
      adjustStock({ partId: id, mode: "ADD", quantity: initialQuantity, reason: "Stock initial à la création de la fiche", type: "INVENTAIRE", userId: user.id });
    }
    revalidatePath("/pieces");
    revalidatePath("/");
    return { id };
  });
}

export async function updatePartAction(id: number, input: unknown) {
  return runAction(partSchema, input, async (data) => {
    await requirePermission("parts.update");
    const { initialQuantity: _iq, ...rest } = data;
    void _iq;
    partsService.updatePart(id, rest);
    revalidatePath("/pieces");
    revalidatePath(`/pieces/${id}`);
    revalidatePath("/");
    return { id };
  });
}

export async function setPartActiveAction(id: number, isActive: boolean) {
  return safeRun(async () => {
    await requirePermission("parts.archive");
    partsService.setPartActive(id, isActive);
    revalidatePath("/pieces");
    revalidatePath(`/pieces/${id}`);
    return { id, isActive };
  });
}

export async function deletePartAction(id: number) {
  return safeRun(async () => {
    await requirePermission("parts.delete");
    partsService.deletePart(id);
    revalidatePath("/pieces");
    return { id };
  });
}

export async function adjustStockAction(input: unknown) {
  return runAction(adjustSchema, input, async (data) => {
    const user = await requirePermission("stock.adjust");
    if (data.mode !== "SET" && data.quantity === 0) throw new BusinessError("La quantité doit être supérieure à 0.");
    const res = adjustStock({ ...data, userId: user.id });
    revalidatePath("/pieces");
    revalidatePath(`/pieces/${data.partId}`);
    revalidatePath("/mouvements");
    revalidatePath("/");
    return res;
  });
}

export async function transferStockAction(input: unknown) {
  return runAction(transferSchema, input, async (data) => {
    const user = await requirePermission("stock.transfer");
    const res = transferStock({ ...data, userId: user.id });
    revalidatePath("/pieces");
    revalidatePath(`/pieces/${data.partId}`);
    revalidatePath("/mouvements");
    return res;
  });
}

export async function setCompatibilityAction(input: unknown) {
  return runAction(compatSchema, input, async (data) => {
    await requirePermission("compatibility.manage");
    partsService.setCompatibility(data.partId, data.vehicleId, data.status, data.note ?? null);
    revalidatePath(`/pieces/${data.partId}`);
    revalidatePath(`/vehicules/${data.vehicleId}`);
    revalidatePath("/compatibilite");
    return true;
  });
}

export async function removeCompatibilityAction(partId: number, vehicleId: number) {
  return safeRun(async () => {
    await requirePermission("compatibility.manage");
    partsService.removeCompatibility(partId, vehicleId);
    revalidatePath(`/pieces/${partId}`);
    revalidatePath(`/vehicules/${vehicleId}`);
    revalidatePath("/compatibilite");
    return true;
  });
}

/* ------------------------------- Images ----------------------------------- */

function uploadRoot(): string {
  const configured = process.env.UPLOAD_DIR ?? "./data/uploads";
  const dir = path.join(path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured), "parts");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function uploadPartImageAction(partId: number, formData: FormData) {
  return safeRun(async () => {
    await requirePermission("parts.update");
    const file = formData.get("file");
    if (!(file instanceof File)) throw new BusinessError("Aucun fichier reçu.");
    if (!file.type.startsWith("image/")) throw new BusinessError("Le fichier doit être une image.");
    if (file.size > 10 * 1024 * 1024) throw new BusinessError("Image trop volumineuse (max 10 Mo).");
    const bytes = Buffer.from(await file.arrayBuffer());
    const name = `${partId}-${nanoid(10)}.webp`;
    // Re-encode server-side: strips metadata, bounds dimensions, guarantees a real image.
    await sharp(bytes, { failOn: "none" }).rotate().resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(uploadRoot(), name));
    const previous = partsService.getPartDetail(partId)?.imagePath;
    partsService.setPartImage(partId, name);
    if (previous) {
      try {
        fs.unlinkSync(path.join(uploadRoot(), path.basename(previous)));
      } catch {
        /* ignore */
      }
    }
    revalidatePath(`/pieces/${partId}`);
    revalidatePath("/pieces");
    return { imagePath: name };
  });
}

export async function removePartImageAction(partId: number) {
  return safeRun(async () => {
    await requirePermission("parts.update");
    const previous = partsService.getPartDetail(partId)?.imagePath;
    partsService.setPartImage(partId, null);
    if (previous) {
      try {
        fs.unlinkSync(path.join(uploadRoot(), path.basename(previous)));
      } catch {
        /* ignore */
      }
    }
    revalidatePath(`/pieces/${partId}`);
    return true;
  });
}

/* ------------------------------- Lookups ---------------------------------- */

export async function partPickerSearchAction(q: string) {
  return safeRun(async () => {
    await requirePermission("parts.view");
    return partsService.pickerSearch(q, 12).map((p) => ({
      id: p.id,
      reference: p.reference,
      designation: p.designation,
      brand: p.brand,
      quantity: p.quantity,
      minStock: p.minStock,
      status: p.status,
      unit: p.unit,
      purchasePrice: p.purchasePrice,
      wholesalePrice: p.wholesalePrice,
      retailPrice: p.retailPrice,
      location: p.location,
      imagePath: p.imagePath,
    }));
  });
}

export async function getPartsByIdsAction(ids: number[]) {
  return safeRun(async () => {
    await requirePermission("parts.view");
    return partsService.getPartsByIds(ids.slice(0, 100));
  });
}
