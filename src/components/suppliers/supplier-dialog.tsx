"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil, Archive, ArchiveRestore } from "lucide-react";
import { supplierSchema, type SupplierFormValues } from "@/lib/schemas/suppliers";
import { createSupplierAction, setSupplierActiveAction, updateSupplierAction } from "@/server/actions/suppliers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import type { z } from "zod";

type SupplierValues = {
  id?: number;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
};

export function SupplierDialog({ open, onOpenChange, supplier, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; supplier?: SupplierValues | null; onSaved?: (id: number) => void }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const form = useForm<SupplierFormValues, unknown, z.output<typeof supplierSchema>>({
    resolver: zodResolver(supplierSchema),
    defaultValues: { name: "", contactName: "", phone: "", email: "", address: "", city: "", notes: "" },
  });
  React.useEffect(() => {
    if (open) {
      form.reset({
        name: supplier?.name ?? "",
        contactName: supplier?.contactName ?? "",
        phone: supplier?.phone ?? "",
        email: supplier?.email ?? "",
        address: supplier?.address ?? "",
        city: supplier?.city ?? "",
        notes: supplier?.notes ?? "",
      });
    }
  }, [open, supplier, form]);

  const submit = form.handleSubmit(async (values) => {
    setPending(true);
    try {
      const res = supplier?.id ? await updateSupplierAction(supplier.id, values) : await createSupplierAction(values);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(supplier?.id ? "Fournisseur mis à jour." : "Fournisseur créé.");
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
      <DialogContent title={supplier?.id ? "Modifier le fournisseur" : "Nouveau fournisseur"} size="lg">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Nom" htmlFor="s-name" required error={err.name?.message} className="sm:col-span-2">
            <Input id="s-name" {...form.register("name")} autoFocus placeholder="Ex. : SARL Auto Pièces Blida" />
          </Field>
          <Field label="Contact" htmlFor="s-contact" error={err.contactName?.message}>
            <Input id="s-contact" {...form.register("contactName")} placeholder="Nom du contact commercial" />
          </Field>
          <Field label="Téléphone" htmlFor="s-phone" error={err.phone?.message}>
            <Input id="s-phone" {...form.register("phone")} placeholder="0550 00 00 00" />
          </Field>
          <Field label="E-mail" htmlFor="s-email" error={err.email?.message}>
            <Input id="s-email" type="email" {...form.register("email")} placeholder="contact@fournisseur.dz" />
          </Field>
          <Field label="Ville" htmlFor="s-city" error={err.city?.message}>
            <Input id="s-city" {...form.register("city")} placeholder="Blida" />
          </Field>
          <Field label="Adresse" htmlFor="s-address" error={err.address?.message} className="sm:col-span-2">
            <Input id="s-address" {...form.register("address")} placeholder="Zone industrielle, lot n°…" />
          </Field>
          <Field label="Notes" htmlFor="s-notes" error={err.notes?.message} className="sm:col-span-2">
            <Textarea id="s-notes" rows={3} {...form.register("notes")} placeholder="Conditions de paiement, délais de livraison, remarques…" />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={pending}>
              {supplier?.id ? <Pencil /> : <Plus />} {supplier?.id ? "Enregistrer" : "Créer le fournisseur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewSupplierButton({ size = "sm" }: { size?: "sm" | "md" }) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>
        <Plus /> Nouveau fournisseur
      </Button>
      <SupplierDialog open={open} onOpenChange={setOpen} onSaved={(id) => router.push(`/fournisseurs/${id}`)} />
    </>
  );
}

export function SupplierHeaderActions({ supplier, canManage }: { supplier: SupplierValues & { id: number; isActive: boolean }; canManage: boolean }) {
  const [edit, setEdit] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);
  const toggle = useAction(setSupplierActiveAction, { success: supplier.isActive ? "Fournisseur désactivé." : "Fournisseur réactivé.", onSuccess: () => setConfirm(false) });
  if (!canManage) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant={supplier.isActive ? "danger-outline" : "secondary"} onClick={() => setConfirm(true)}>
        {supplier.isActive ? <Archive /> : <ArchiveRestore />} {supplier.isActive ? "Désactiver" : "Réactiver"}
      </Button>
      <Button onClick={() => setEdit(true)}>
        <Pencil /> Modifier
      </Button>
      <SupplierDialog open={edit} onOpenChange={setEdit} supplier={supplier} />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={supplier.isActive ? "Désactiver ce fournisseur ?" : "Réactiver ce fournisseur ?"}
        description={supplier.isActive ? "Il n'apparaîtra plus dans les listes de sélection (nouveaux achats, fiches pièces). L'historique est conservé." : "Il sera à nouveau proposé dans les listes de sélection."}
        confirmLabel={supplier.isActive ? "Désactiver" : "Réactiver"}
        variant={supplier.isActive ? "danger" : "primary"}
        loading={toggle.pending}
        onConfirm={() => toggle.run(supplier.id, !supplier.isActive)}
      />
    </div>
  );
}
