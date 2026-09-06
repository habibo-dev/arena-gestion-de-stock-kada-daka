"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { z } from "zod";
import { vehicleSchema, type VehicleFormValues } from "@/lib/schemas/vehicles";
import { createVehicleAction, deleteVehicleAction, updateVehicleAction } from "@/server/actions/vehicles";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";

const FUELS = ["Diesel", "Essence", "GPL", "Hybride", "Électrique"] as const;

export type VehicleFormSeed = {
  id?: number;
  makeName: string;
  modelName: string;
  generation: string | null;
  engineLabel: string;
  displacement: string | null;
  fuel: string | null;
  powerHp: number | null;
  engineCode: string | null;
  yearFrom: number | null;
  yearTo: number | null;
};

export function VehicleDialog({ open, onOpenChange, vehicle, makes, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; vehicle?: VehicleFormSeed | null; makes: string[]; onSaved?: (id: number) => void }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const isEdit = Boolean(vehicle?.id);
  const form = useForm<VehicleFormValues, unknown, z.output<typeof vehicleSchema>>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: { makeName: "", modelName: "", generation: "", engineLabel: "", displacement: "", fuel: "", powerHp: "", engineCode: "", yearFrom: "", yearTo: "" },
  });
  React.useEffect(() => {
    if (open) {
      form.reset({
        makeName: vehicle?.makeName ?? "",
        modelName: vehicle?.modelName ?? "",
        generation: vehicle?.generation ?? "",
        engineLabel: vehicle?.engineLabel ?? "",
        displacement: vehicle?.displacement ?? "",
        fuel: vehicle?.fuel ?? "",
        powerHp: vehicle?.powerHp ?? "",
        engineCode: vehicle?.engineCode ?? "",
        yearFrom: vehicle?.yearFrom ?? "",
        yearTo: vehicle?.yearTo ?? "",
      });
    }
  }, [open, vehicle, form]);

  const submit = form.handleSubmit(async (values) => {
    setPending(true);
    try {
      const res = isEdit ? await updateVehicleAction(vehicle!.id!, values) : await createVehicleAction(values);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(isEdit ? "Véhicule mis à jour." : "Véhicule ajouté.");
      onOpenChange(false);
      onSaved?.(res.data.id);
      router.refresh();
    } finally {
      setPending(false);
    }
  });
  const err = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={isEdit ? "Modifier la motorisation" : "Nouveau véhicule"} description={isEdit ? "La marque et le modèle d'une motorisation existante ne sont pas modifiables : créez une nouvelle entrée si besoin." : "Une entrée = une motorisation précise d'un modèle (ex. Renault Clio IV 1.5 dCi 90)."} size="lg">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Marque" htmlFor="v-make" required error={err.makeName?.message}>
            <Input id="v-make" list="v-make-list" {...form.register("makeName")} placeholder="Renault" disabled={isEdit} autoFocus={!isEdit} />
            <datalist id="v-make-list">
              {makes.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>
          <Field label="Modèle" htmlFor="v-model" required error={err.modelName?.message}>
            <Input id="v-model" {...form.register("modelName")} placeholder="Clio" disabled={isEdit} />
          </Field>
          <Field label="Génération" htmlFor="v-gen" error={err.generation?.message} hint="Ex. : IV, III Phase 2, (6R)…">
            <Input id="v-gen" {...form.register("generation")} placeholder="IV" disabled={isEdit} />
          </Field>
          <Field label="Motorisation" htmlFor="v-engine" required error={err.engineLabel?.message}>
            <Input id="v-engine" {...form.register("engineLabel")} placeholder="1.5 dCi 90" autoFocus={isEdit} />
          </Field>
          <Field label="Cylindrée" htmlFor="v-disp" error={err.displacement?.message}>
            <Input id="v-disp" {...form.register("displacement")} placeholder="1461 cm³" />
          </Field>
          <Field label="Carburant" htmlFor="v-fuel" error={err.fuel?.message}>
            <Select id="v-fuel" {...form.register("fuel")}>
              <option value="">— Non renseigné —</option>
              {FUELS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Puissance (ch)" htmlFor="v-hp" error={err.powerHp?.message}>
            <Input id="v-hp" type="number" min={1} {...form.register("powerHp")} placeholder="90" />
          </Field>
          <Field label="Code moteur" htmlFor="v-code" error={err.engineCode?.message}>
            <Input id="v-code" {...form.register("engineCode")} placeholder="K9K 608" className="font-mono" />
          </Field>
          <Field label="Année début" htmlFor="v-yf" error={err.yearFrom?.message}>
            <Input id="v-yf" type="number" min={1950} max={2100} {...form.register("yearFrom")} placeholder="2012" />
          </Field>
          <Field label="Année fin" htmlFor="v-yt" error={err.yearTo?.message} hint="Laisser vide si toujours produit.">
            <Input id="v-yt" type="number" min={1950} max={2100} {...form.register("yearTo")} placeholder="2019" />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={pending}>
              {isEdit ? <Pencil /> : <Plus />} {isEdit ? "Enregistrer" : "Ajouter le véhicule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewVehicleButton({ makes }: { makes: string[] }) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> Nouveau véhicule
      </Button>
      <VehicleDialog open={open} onOpenChange={setOpen} makes={makes} onSaved={(id) => router.push(`/vehicules/${id}`)} />
    </>
  );
}

export function VehicleHeaderActions({ vehicle, makes, partCount, canManage }: { vehicle: VehicleFormSeed & { id: number }; makes: string[]; partCount: number; canManage: boolean }) {
  const [edit, setEdit] = React.useState(false);
  const [del, setDel] = React.useState(false);
  const router = useRouter();
  const remove = useAction(deleteVehicleAction, { success: "Véhicule supprimé.", onSuccess: () => router.push("/vehicules") });
  if (!canManage) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="danger-outline" onClick={() => setDel(true)}>
        <Trash2 /> Supprimer
      </Button>
      <Button onClick={() => setEdit(true)}>
        <Pencil /> Modifier
      </Button>
      <VehicleDialog open={edit} onOpenChange={setEdit} vehicle={vehicle} makes={makes} />
      <ConfirmDialog
        open={del}
        onOpenChange={setDel}
        title="Supprimer cette motorisation ?"
        description={partCount > 0 ? `${partCount} compatibilité${partCount > 1 ? "s" : ""} pièce ↔ véhicule seront supprimées avec elle. Les pièces elles-mêmes ne sont pas affectées.` : "Aucune pièce n'est rattachée à cette motorisation."}
        confirmLabel="Supprimer"
        variant="danger"
        loading={remove.pending}
        onConfirm={() => remove.run(vehicle.id)}
      />
    </div>
  );
}
