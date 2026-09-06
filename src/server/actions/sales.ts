"use server";

import { saleSchema, customerSchema } from "@/lib/schemas/sales";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/server/auth/session";
import { runAction, safeRun } from "./utils";
import * as salesService from "@/server/services/sales";

function revalidateSales(id?: number) {
  revalidatePath("/ventes");
  if (id) revalidatePath(`/ventes/${id}`);
  revalidatePath("/pieces");
  revalidatePath("/mouvements");
  revalidatePath("/");
}

export async function createSaleAction(input: unknown, confirm: boolean) {
  return runAction(saleSchema, input, async (data) => {
    const user = await requirePermission(confirm ? "sales.confirm" : "sales.create");
    const res = salesService.createSale(data, user.id, confirm);
    revalidateSales(res.id);
    return res;
  });
}

export async function updateSaleAction(id: number, input: unknown, confirm: boolean) {
  return runAction(saleSchema, input, async (data) => {
    const user = await requirePermission(confirm ? "sales.confirm" : "sales.create");
    salesService.updateSale(id, data, user.id, confirm);
    revalidateSales(id);
    return { id };
  });
}

export async function confirmSaleAction(id: number) {
  return safeRun(async () => {
    const user = await requirePermission("sales.confirm");
    salesService.confirmSale(id, user.id);
    revalidateSales(id);
    return { id };
  });
}

export async function cancelSaleAction(id: number, reason?: string) {
  return safeRun(async () => {
    const user = await requirePermission("sales.cancel");
    salesService.cancelSale(id, user.id, reason);
    revalidateSales(id);
    return { id };
  });
}

export async function deleteDraftSaleAction(id: number) {
  return safeRun(async () => {
    await requirePermission("sales.cancel");
    salesService.deleteDraftSale(id);
    revalidateSales();
    return { id };
  });
}

export async function createCustomerAction(input: unknown) {
  return runAction(customerSchema, input, async (data) => {
    await requirePermission("sales.create");
    const id = salesService.createCustomer(data);
    return { id, ...data };
  });
}

export async function searchCustomersAction(q: string) {
  return safeRun(async () => {
    await requirePermission("sales.view");
    return salesService.listCustomers(q);
  });
}
