"use server";

import { requirePermission } from "@/server/auth/session";
import { getVisionStatus, searchByImage } from "@/server/vision";
import { BusinessError } from "@/lib/result";
import { safeRun } from "./utils";

const MAX_BYTES = 10 * 1024 * 1024;

export async function imageSearchAction(formData: FormData) {
  return safeRun(async () => {
    await requirePermission("parts.view");
    const file = formData.get("file");
    if (!(file instanceof File)) throw new BusinessError("Aucune image reçue.");
    if (!file.type.startsWith("image/")) throw new BusinessError("Le fichier doit être une image (JPEG, PNG, WebP…).");
    if (file.size > MAX_BYTES) throw new BusinessError("Image trop volumineuse (10 Mo maximum).");
    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await searchByImage({ bytes, mimeType: file.type });
    // Strip heavy block data before sending to the client
    return {
      status: result.status,
      candidates: result.candidates,
      matches: result.matches,
      analysis: {
        provider: result.analysis.provider,
        rawText: result.analysis.rawText.slice(0, 2000),
        labels: result.analysis.labels,
        brands: result.analysis.brands,
        durationMs: result.analysis.durationMs,
        warnings: result.analysis.warnings,
        blockCount: result.analysis.blocks.length,
      },
    };
  });
}

export async function visionStatusAction() {
  return safeRun(async () => {
    await requirePermission("parts.view");
    return getVisionStatus();
  });
}
