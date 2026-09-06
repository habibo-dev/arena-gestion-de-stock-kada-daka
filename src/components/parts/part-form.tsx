"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Plus, Trash2, Save, ArrowLeft, Info } from "lucide-react";
import { partSchema } from "@/lib/schemas/parts";
import { createPartAction, updatePartAction } from "@/server/actions/parts";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/input";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { InlineAlert } from "@/components/ui/states";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { UNITS, REFERENCE_TYPE_LABELS } from "@/lib/stock";
import { formatAmount } from "@/lib/format";
import { splitReferences } from "@/lib/references";
import { toast } from "sonner";

type FormInput = z.input<typeof partSchema>;
type FormOutput = z.output<typeof partSchema>;

export type PartFormRefData = {
  brands: { id: number; name: string }[];
  categories: { id: number; name: string }[];
  locations: { id: number; code: string; label?: string | null }[];
  suppliers: { id: number; name: string; isActive: boolean }[];
};

export type PartFormInitial = Partial<FormInput> & { id?: number; quantity?: number };

export function PartForm({ mode, initial, refData, duplicateOf }: { mode: "create" | "edit"; initial?: PartFormInitial; refData: PartFormRefData; duplicateOf?: { id: number; reference: string } | null }) {
  const router = useRouter();
  const [brands, setBrands] = React.useState(refData.brands);
  const [locations, setLocations] = React.useState(refData.locations);
  const [leaveOpen, setLeaveOpen] = React.useState(false);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(partSchema),
    defaultValues: {
      reference: initial?.reference ?? "",
      designation: initial?.designation ?? "",
      description: initial?.description ?? "",
      brandId: initial?.brandId ?? null,
      brandName: initial?.brandName ?? "",
      categoryId: initial?.categoryId ?? null,
      locationId: initial?.locationId ?? null,
      locationCode: initial?.locationCode ?? "",
      supplierId: initial?.supplierId ?? null,
      unit: initial?.unit ?? UNITS[0],
      purchasePrice: initial?.purchasePrice ?? 0,
      wholesalePrice: initial?.wholesalePrice ?? 0,
      retailPrice: initial?.retailPrice ?? 0,
      minStock: initial?.minStock ?? 0,
      barcode: initial?.barcode ?? "",
      notes: initial?.notes ?? "",
      keywords: initial?.keywords ?? "",
      isActive: initial?.isActive ?? true,
      references: initial?.references ?? [],
      initialQuantity: 0,
    },
  });
  const { register, control, handleSubmit, formState, watch, setValue } = form;
  const refs = useFieldArray({ control, name: "references" });
  useUnsavedChanges(formState.isDirty && !formState.isSubmitSuccessful);

  const purchase = Number(watch("purchasePrice")) || 0;
  const wholesale = Number(watch("wholesalePrice")) || 0;
  const retail = Number(watch("retailPrice")) || 0;
  const marginW = purchase > 0 ? ((wholesale - purchase) / purchase) * 100 : null;
  const marginR = purchase > 0 ? ((retail - purchase) / purchase) * 100 : null;

  // Brand / location pickers: existing rows are "id:<n>", inline-created ones are "new:<label>"
  const brandId = watch("brandId");
  const brandName = watch("brandName");
  const locationId = watch("locationId");
  const locationCode = watch("locationCode");
  const brandChoice = brandId ? `id:${brandId}` : brandName ? `new:${brandName}` : null;
  const locationChoice = locationId ? `id:${locationId}` : locationCode ? `new:${locationCode}` : null;
  const brandOptions = React.useMemo(() => brands.map((b) => (b.id ? { value: `id:${b.id}`, label: b.name } : { value: `new:${b.name}`, label: `${b.name} (nouvelle)` })), [brands]);
  const locationOptions = React.useMemo(() => locations.map((l) => (l.id ? { value: `id:${l.id}`, label: l.code, description: l.label ?? undefined } : { value: `new:${l.code}`, label: `${l.code} (nouveau)` })), [locations]);

  const onSubmit = handleSubmit(async (values) => {
    const res = mode === "create" ? await createPartAction(values) : await updatePartAction(initial!.id!, values);
    if (!res.ok) {
      if (res.fieldErrors) {
        for (const [k, msgs] of Object.entries(res.fieldErrors)) form.setError(k as keyof FormInput, { message: msgs[0] });
      }
      toast.error(res.error);
      return;
    }
    toast.success(mode === "create" ? "Pièce créée." : "Pièce mise à jour.");
    router.push(`/pieces/${res.data.id}`);
    router.refresh();
  });

  /** Paste "A / B ; C" into the reference add box → several rows. */
  const [newRef, setNewRef] = React.useState("");
  const [newRefType, setNewRefType] = React.useState<"OEM" | "ALTERNATIVE" | "SUPPLIER" | "BARCODE">("OEM");
  const addRefs = () => {
    const parts = splitReferences(newRef);
    if (parts.length === 0) return;
    for (const p of parts) refs.append({ type: newRefType, reference: p });
    setNewRef("");
  };

  const back = () => {
    if (formState.isDirty && !formState.isSubmitSuccessful) setLeaveOpen(true);
    else router.back();
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {duplicateOf ? (
        <InlineAlert variant="info" icon={<Info />}>
          Formulaire pré-rempli à partir de <span className="font-mono font-medium">{duplicateOf.reference}</span>. Saisissez une nouvelle référence ; le stock démarre à 0.
        </InlineAlert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Identification" description="Champs de votre fichier Excel : Référence, Désignation, Marque, UM, Rayon" />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label="Référence" htmlFor="reference" required error={formState.errors.reference?.message} hint="Référence principale (fabricant ou interne). Unique.">
                <Input id="reference" {...register("reference")} invalid={Boolean(formState.errors.reference)} className="font-mono" autoFocus={mode === "create"} placeholder="Ex. : 0986494090" />
              </Field>
              <Field label="Code-barres (EAN)" htmlFor="barcode" error={formState.errors.barcode?.message}>
                <Input id="barcode" {...register("barcode")} className="font-mono" placeholder="Ex. : 4047024551831" inputMode="numeric" />
              </Field>
              <Field label="Désignation" htmlFor="designation" required error={formState.errors.designation?.message} className="sm:col-span-2">
                <Input id="designation" {...register("designation")} invalid={Boolean(formState.errors.designation)} placeholder="Ex. : Plaquettes de frein avant" />
              </Field>
              <Field label="Marque" htmlFor="brand" error={formState.errors.brandId?.message ?? formState.errors.brandName?.message}>
                <Combobox<string>
                  id="brand"
                  value={brandChoice}
                  onChange={(v) => {
                    if (v === null) {
                      setValue("brandId", null, { shouldDirty: true });
                      setValue("brandName", "", { shouldDirty: true });
                    } else if (v.startsWith("id:")) {
                      setValue("brandId", Number(v.slice(3)), { shouldDirty: true });
                      setValue("brandName", "", { shouldDirty: true });
                    } else {
                      setValue("brandId", null, { shouldDirty: true });
                      setValue("brandName", v.slice(4), { shouldDirty: true });
                    }
                  }}
                  options={brandOptions}
                  placeholder="Choisir une marque"
                  clearable
                  onCreate={(label) => {
                    // The brand is created server-side (by name) when the form is saved.
                    setBrands((b) => [...b, { id: 0, name: label }]);
                    setValue("brandId", null, { shouldDirty: true });
                    setValue("brandName", label, { shouldDirty: true });
                  }}
                  createLabel={(q) => `Créer la marque « ${q} »`}
                />
              </Field>
              <Field label="Catégorie" htmlFor="category">
                <Controller control={control} name="categoryId" render={({ field }) => <Combobox id="category" value={(field.value as number | null) ?? null} onChange={(v) => field.onChange(v)} options={refData.categories.map((c) => ({ value: c.id, label: c.name }))} placeholder="Choisir une catégorie" clearable />} />
              </Field>
              <Field label="Rayon (emplacement)" htmlFor="location" hint="Code du rayon tel qu'utilisé dans le magasin (ex. A1, B3).">
                <Combobox<string>
                  id="location"
                  value={locationChoice}
                  onChange={(v) => {
                    if (v === null) {
                      setValue("locationId", null, { shouldDirty: true });
                      setValue("locationCode", "", { shouldDirty: true });
                    } else if (v.startsWith("id:")) {
                      setValue("locationId", Number(v.slice(3)), { shouldDirty: true });
                      setValue("locationCode", "", { shouldDirty: true });
                    } else {
                      setValue("locationId", null, { shouldDirty: true });
                      setValue("locationCode", v.slice(4), { shouldDirty: true });
                    }
                  }}
                  options={locationOptions}
                  placeholder="Choisir un rayon"
                  clearable
                  onCreate={(label) => {
                    const code = label.toUpperCase();
                    setLocations((ls) => [...ls, { id: 0, code }]);
                    setValue("locationId", null, { shouldDirty: true });
                    setValue("locationCode", code, { shouldDirty: true });
                  }}
                  createLabel={(q) => `Créer le rayon « ${q.toUpperCase()} »`}
                />
              </Field>
              <Field label="UM (unité)" htmlFor="unit">
                <Select id="unit" {...register("unit")}>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Fournisseur habituel" htmlFor="supplier" className="sm:col-span-2">
                <Controller control={control} name="supplierId" render={({ field }) => <Combobox id="supplier" value={(field.value as number | null) ?? null} onChange={(v) => field.onChange(v)} options={refData.suppliers.filter((s) => s.isActive || s.id === field.value).map((s) => ({ value: s.id, label: s.name }))} placeholder="Aucun fournisseur associé" clearable />} />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Références OEM et alternatives" description="Une pièce peut porter plusieurs références (constructeur, équivalences, fournisseur). Toutes sont recherchables." />
            <CardBody className="space-y-3">
              {refs.fields.length === 0 ? <p className="text-[13px] text-ink-muted">Aucune référence secondaire. Collez une cellule Excel du type « 7703800107 / 8200651172 » : elle sera découpée automatiquement.</p> : null}
              <ul className="space-y-2">
                {refs.fields.map((f, i) => (
                  <li key={f.id} className="flex items-center gap-2">
                    <Select {...register(`references.${i}.type` as const)} className="w-44 shrink-0">
                      {Object.entries(REFERENCE_TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </Select>
                    <Input {...register(`references.${i}.reference` as const)} className="font-mono" invalid={Boolean(formState.errors.references?.[i]?.reference)} />
                    <Button type="button" variant="ghost" size="icon" aria-label="Supprimer" onClick={() => refs.remove(i)}>
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-2 rounded-lg border border-dashed border-line-strong bg-slate-50/60 p-2.5 sm:flex-row sm:items-center">
                <Select value={newRefType} onChange={(e) => setNewRefType(e.target.value as typeof newRefType)} className="w-full sm:w-44">
                  {Object.entries(REFERENCE_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
                <Input
                  value={newRef}
                  onChange={(e) => setNewRef(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addRefs();
                    }
                  }}
                  placeholder="Ex. : 7701208265 / 8200651172"
                  className="font-mono"
                  aria-label="Nouvelle référence"
                />
                <Button type="button" variant="secondary" onClick={addRefs} disabled={!newRef.trim()}>
                  <Plus /> Ajouter
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Description et notes" />
            <CardBody className="grid gap-4">
              <Field label="Description" htmlFor="description">
                <Textarea id="description" rows={3} {...register("description")} placeholder="Caractéristiques techniques, dimensions, position (avant/arrière)…" />
              </Field>
              <Field label="Mots-clés de recherche" htmlFor="keywords" hint="Synonymes utilisés par vos clients, séparés par des virgules (ex. : plaquettes, garnitures, frein AV).">
                <Input id="keywords" {...register("keywords")} />
              </Field>
              <Field label="Notes internes" htmlFor="notes">
                <Textarea id="notes" rows={2} {...register("notes")} />
              </Field>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Prix (DA)" description="Terminologie de votre fichier : Prix d'Achat, Prix Gros, Prix Détail" />
            <CardBody className="grid gap-4">
              <Field label="Prix d'achat" htmlFor="purchasePrice" required error={formState.errors.purchasePrice?.message}>
                <Input id="purchasePrice" type="number" step="0.01" min={0} inputMode="decimal" {...register("purchasePrice")} invalid={Boolean(formState.errors.purchasePrice)} className="text-right tabular" rightSlot={<span className="text-xs text-ink-muted">DA</span>} />
              </Field>
              <Field label="Prix gros" htmlFor="wholesalePrice" required error={formState.errors.wholesalePrice?.message} hint={marginW !== null ? `Marge ${marginW >= 0 ? "+" : ""}${marginW.toFixed(1)} % (${formatAmount(wholesale - purchase)} DA)` : undefined}>
                <Input id="wholesalePrice" type="number" step="0.01" min={0} inputMode="decimal" {...register("wholesalePrice")} invalid={Boolean(formState.errors.wholesalePrice)} className="text-right tabular" rightSlot={<span className="text-xs text-ink-muted">DA</span>} />
              </Field>
              <Field label="Prix détail" htmlFor="retailPrice" required error={formState.errors.retailPrice?.message} hint={marginR !== null ? `Marge ${marginR >= 0 ? "+" : ""}${marginR.toFixed(1)} % (${formatAmount(retail - purchase)} DA)` : undefined}>
                <Input id="retailPrice" type="number" step="0.01" min={0} inputMode="decimal" {...register("retailPrice")} invalid={Boolean(formState.errors.retailPrice)} className="text-right tabular" rightSlot={<span className="text-xs text-ink-muted">DA</span>} />
              </Field>
              {wholesale > 0 && retail > 0 && wholesale > retail ? <InlineAlert variant="warning">Le prix gros est supérieur au prix détail : vérifiez la saisie.</InlineAlert> : null}
              {purchase > 0 && retail > 0 && retail < purchase ? <InlineAlert variant="danger">Le prix détail est inférieur au prix d'achat (vente à perte).</InlineAlert> : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Stock" />
            <CardBody className="grid gap-4">
              {mode === "create" ? (
                <Field label="Quantité initiale" htmlFor="initialQuantity" hint="Crée un mouvement « Inventaire » traçable. Laissez 0 si le stock arrivera par un achat." error={formState.errors.initialQuantity?.message}>
                  <Input id="initialQuantity" type="number" min={0} step={1} inputMode="numeric" {...register("initialQuantity")} className="text-right tabular" />
                </Field>
              ) : (
                <div className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-[13px]">
                  <span className="text-ink-muted">Quantité actuelle : </span>
                  <span className="font-mono font-semibold">{initial?.quantity ?? 0}</span>
                  <p className="mt-1 text-[11.5px] text-ink-muted">La quantité ne se modifie pas ici : utilisez « Ajuster le stock » pour garder une trace du mouvement.</p>
                </div>
              )}
              <Field label="Stock minimum (alerte)" htmlFor="minStock" hint="En dessous ou égal à ce seuil, la pièce passe en « Stock faible ». 0 = pas d'alerte." error={formState.errors.minStock?.message}>
                <Input id="minStock" type="number" min={0} step={1} inputMode="numeric" {...register("minStock")} className="text-right tabular" />
              </Field>
              {mode === "edit" ? <Checkbox label="Pièce active (visible dans le catalogue et la recherche)" {...register("isActive")} /> : null}
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-line bg-white/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <Button type="button" variant="ghost" onClick={back}>
          <ArrowLeft /> Retour
        </Button>
        <div className="flex items-center gap-2">
          {formState.isDirty && !formState.isSubmitting ? <span className="hidden text-[12.5px] text-ink-muted sm:inline">Modifications non enregistrées</span> : null}
          <Button type="submit" loading={formState.isSubmitting}>
            <Save /> {mode === "create" ? "Créer la pièce" : "Enregistrer"}
          </Button>
        </div>
      </div>

      <ConfirmDialog open={leaveOpen} onOpenChange={setLeaveOpen} title="Quitter sans enregistrer ?" description="Les modifications apportées à cette fiche seront perdues." confirmLabel="Quitter" variant="danger" onConfirm={() => router.back()} />
    </form>
  );
}
