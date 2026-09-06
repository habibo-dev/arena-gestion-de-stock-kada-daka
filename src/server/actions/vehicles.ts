"use server";

import { vehicleSchema } from "@/lib/schemas/vehicles";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/server/auth/session";
import { runAction, safeRun } from "./utils";
import * as vehiclesService from "@/server/services/vehicles";

export async function createVehicleAction(input: unknown) {
  return runAction(vehicleSchema, input, async (data) => {
    await requirePermission("vehicles.manage");
    const id = vehiclesService.createVehicle(data);
    revalidatePath("/vehicules");
    return { id };
  });
}

const vehicleUpdateSchema = vehicleSchema.omit({ makeName: true, modelName: true });

export async function updateVehicleAction(id: number, input: unknown) {
  return runAction(vehicleUpdateSchema, input, async (data) => {
    await requirePermission("vehicles.manage");
    vehiclesService.updateVehicle(id, data);
    revalidatePath("/vehicules");
    revalidatePath(`/vehicules/${id}`);
    return { id };
  });
}

export async function deleteVehicleAction(id: number) {
  return safeRun(async () => {
    await requirePermission("vehicles.manage");
    vehiclesService.deleteVehicle(id);
    revalidatePath("/vehicules");
    revalidatePath("/compatibilite");
    return { id };
  });
}

export async function vehicleOptionsAction(q: string) {
  return safeRun(async () => {
    await requirePermission("vehicles.view");
    return vehiclesService.vehicleOptions(q, 30);
  });
}
