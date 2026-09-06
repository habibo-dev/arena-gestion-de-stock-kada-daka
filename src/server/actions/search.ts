"use server";

import { requireUser } from "@/server/auth/session";
import { quickSearch, searchParts } from "@/server/services/search";
import { safeRun } from "./utils";

export async function quickSearchAction(query: string) {
  return safeRun(async () => {
    await requireUser();
    const hits = quickSearch(query, 8);
    return hits.map((h) => ({
      id: h.id,
      reference: h.reference,
      designation: h.designation,
      brand: h.brand,
      quantity: h.quantity,
      minStock: h.minStock,
      status: h.status,
      location: h.location,
      retailPrice: h.retailPrice,
      wholesalePrice: h.wholesalePrice,
      imagePath: h.imagePath,
      matchedReference: h.matchedReference,
      matchReasons: h.matchReasons,
    }));
  });
}

export async function smartSearchAction(query: string, opts?: { onlyInStock?: boolean; limit?: number; offset?: number }) {
  return safeRun(async () => {
    await requireUser();
    return searchParts(query, { limit: opts?.limit ?? 40, offset: opts?.offset ?? 0, onlyInStock: opts?.onlyInStock });
  });
}
