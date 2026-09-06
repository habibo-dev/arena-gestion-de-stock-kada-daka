"use server";

import { purchaseSchema } from "@/lib/schemas/purchases";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/server/auth/session";
import { runAction, safeRun } from "./utils";
import * as purchasesService from "@/server/services/purchases";

type Action = "DRAFT" | "ORDER" | "RECEIVE";

function revalidatePurchases(id?: number) {
  revalidatePath("/achats");
  if (id) revalidatePath(`/achats/${id}`);
  revalidatePath("/pieces");
  revalidatePath("/mouvements");
  revalidatePath("/fournisseurs");
  revalidatePath("/");
}

export async function createPurchaseAction(input: unknown, action: Action) {
  return runAction(purchaseSchema, input, async (data) => {
    const user = await requirePermission(action === "RECEIVE" ? "purchases.receive" : "purchases.create");
    const res = purchasesService.createPurchase(data, user.id, action);
    revalidatePurchases(res.id);
    return res;
  });
}

export async function updatePurchaseAction(id: number, input: unknown, action: Action) {
  return runAction(purchaseSchema, input, async (data) => {
    const user = await requirePermission(action === "RECEIVE" ? "purchases.receive" : "purchases.create");
    purchasesService.updatePurchase(id, data, user.id, action);
    revalidatePurchases(id);
    return { id };
  });
}

export async function markPurchaseOrderedAction(id: number) {
  return safeRun(async () => {
    await requirePermission("purchases.create");
    purchasesService.markPurchaseOrdered(id);
    revalidatePurchases(id);
    return { id };
  });
}

export async function receivePurchaseAction(id: number) {
  return safeRun(async () => {
    const user = await requirePermission("purchases.receive");
    purchasesService.receivePurchase(id, user.id);
    revalidatePurchases(id);
    return { id };
  });
}

export async function cancelPurchaseAction(id: number, reason?: string) {
  return safeRun(async () => {
    const user = await requirePermission("purchases.cancel");
    purchasesService.cancelPurchase(id, user.id, reason);
    revalidatePurchases(id);
    return { id };
  });
}

export async function deleteDraftPurchaseAction(id: number) {
  return safeRun(async () => {
    await requirePermission("purchases.cancel");
    purchasesService.deleteDraftPurchase(id);
    revalidatePurchases();
    return { id };
  });
}
