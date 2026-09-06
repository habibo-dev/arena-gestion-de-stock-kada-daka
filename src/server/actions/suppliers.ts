"use server";

import { supplierSchema } from "@/lib/schemas/suppliers";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/server/auth/session";
import { runAction, safeRun } from "./utils";
import * as suppliersService from "@/server/services/suppliers";

export async function createSupplierAction(input: unknown) {
  return runAction(supplierSchema, input, async (data) => {
    await requirePermission("suppliers.manage");
    const id = suppliersService.createSupplier({ ...data, email: data.email || null });
    revalidatePath("/fournisseurs");
    return { id };
  });
}

export async function updateSupplierAction(id: number, input: unknown) {
  return runAction(supplierSchema, input, async (data) => {
    await requirePermission("suppliers.manage");
    suppliersService.updateSupplier(id, { ...data, email: data.email || null });
    revalidatePath("/fournisseurs");
    revalidatePath(`/fournisseurs/${id}`);
    return { id };
  });
}

export async function setSupplierActiveAction(id: number, isActive: boolean) {
  return safeRun(async () => {
    await requirePermission("suppliers.manage");
    suppliersService.setSupplierActive(id, isActive);
    revalidatePath("/fournisseurs");
    revalidatePath(`/fournisseurs/${id}`);
    return { id, isActive };
  });
}
