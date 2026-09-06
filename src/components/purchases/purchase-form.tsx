"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Lightbulb, Minus, PackageCheck, Plus, Save, Send, Trash2 } from "lucide-react";
import { createPurchaseAction, updatePurchaseAction } from "@/server/actions/purchases";
import type { PurchaseFormValues } from "@/lib/schemas/purchases";
import { PartPicker, type PickedPart } from "@/components/parts/part-picker";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState, InlineAlert } from "@/components/ui/states";
import { PartThumb, Money } from "@/components/ui/misc";
import { QuantityChip } from "@/components/ui/stock-badge";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { round2 } from "@/lib/stock";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

export type PurchaseLine = { part: PickedPart; quantity: number; unitCost: number };
export type ReorderSuggestion = { part: PickedPart; supplierId: number | null; supplierName: string | null; suggestedQuantity: number };

export type PurchaseFormInitial = {
  id?: number;
  number?: string;
  status?: "BROUILLON" | "COMMANDEE";
  supplierId: number | null;
  supplierInvoiceNumber: string;
  expectedAt: string;
  notes: string;
  lines: PurchaseLine[];
};

type Props = {
  mode: "create" | "edit";
  initial: PurchaseFormInitial;
  suppliers: { id: number; name: string }[];
  suggestions: ReorderSuggestion[];
  can: { receive: boolean };
  prefillPart?: PickedPart | null;
};

type SubmitAction = "DRAFT" | "ORDER" | "RECEIVE";

export function PurchaseForm({ mode, initial, suppliers, suggestions, can, prefillPart }: Props) {
  const router = useRouter();
  const [supplierId, setSupplierId] = React.useState<number | null>(initial.supplierId);
  const [invoice, setInvoice] = React.useState(initial.supplierInvoiceNumber);
  const [expectedAt, setExpectedAt] = React.useState(initial.expectedAt);
  const [notes, setNotes] = React.useState(initial.notes);
  const [lines, setLines] = React.useState<PurchaseLine[]>(() => {
    if (initial.lines.length) return initial.lines;
    if (prefillPart) return [{ part: prefillPart, quantity: Math.max(1, prefillPart.minStock * 2 - prefillPart.quantity), unitCost: prefillPart.purchasePrice }];
    return [];
  });
  const [dirty, setDirty] = React.useState(Boolean(prefillPart));
  const [submitting, setSubmitting] = React.useState<SubmitAction | null>(null);
  const [receiveOpen, setReceiveOpen] = React.useState(false);
  const [leaveOpen, setLeaveOpen] = React.useState(false);
  useUnsavedChanges(dirty && !submitting);
  const touch = () => setDirty(true);

  const total = round2(lines.reduce((s, l) => s + l.quantity * l.unitCost, 0));
  const units = lines.reduce((s, l) => s + l.quantity, 0);
  const supplierSuggestions = suggestions.filter((s) => (supplierId ? s.supplierId === supplierId : true) && !lines.some((l) => l.part.id === s.part.id));

  const addPart = (p: PickedPart | null, qty = 1, cost?: number) => {
    if (!p) return;
    touch();
    setLines((ls) => {
      const idx = ls.findIndex((l) => l.part.id === p.id);
      if (idx >= 0) return ls.map((l, i) => (i === idx ? { ...l, quantity: l.quantity + qty } : l));
      return [...ls, { part: p, quantity: qty, unitCost: cost ?? p.purchasePrice }];
    });
  };
  const updateLine = (id: number, patch: Partial<PurchaseLine>) => {
    touch();
    setLines((ls) => ls.map((l) => (l.part.id === id ? { ...l, ...patch } : l)));
  };
  const removeLine = (id: number) => {
    touch();
    setLines((ls) => ls.filter((l) => l.part.id !== id));
  };

  const buildPayload = (): PurchaseFormValues => ({
    supplierId: supplierId ?? 0,
    supplierInvoiceNumber: invoice || null,
    expectedAt: expectedAt || null,
    notes: notes || null,
    items: lines.map((l) => ({ partId: l.part.id, quantity: l.quantity, unitCost: l.unitCost })),
  });

  const submit = async (action: SubmitAction) => {
    if (!supplierId) {
      toast.error("Sélectionnez un fournisseur.");
      return;
    }
    if (lines.length === 0) {
      toast.error("Ajoutez au moins une pièce.");
      return;
    }
    setSubmitting(action);
    try {
      const payload = buildPayload();
      const res = mode === "create" ? await createPurchaseAction(payload, action) : await updatePurchaseAction(initial.id!, payload, action);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDirty(false);
      const id = mode === "create" ? (res.data as { id: number }).id : initial.id!;
      toast.success(action === "RECEIVE" ? "Achat réceptionné : le stock a été augmenté." : action === "ORDER" ? "Commande enregistrée." : "Brouillon enregistré.");
      router.push(`/achats/${id}`);
      router.refresh();
    } finally {
      setSubmitting(null);
      setReceiveOpen(false);
    }
  };

  const isOrdered = initial.status === "COMMANDEE";

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <Card>
          <CardHeader title="Fournisseur" description="Chaque achat est rattaché à un fournisseur ; le prix d'achat des pièces est mis à jour à la réception." />
          <CardBody className="grid gap-4 sm:grid-cols-3">
            <Field label="Fournisseur" htmlFor="supplier" required className="sm:col-span-1">
              <Select id="supplier" value={supplierId ?? ""} onChange={(e) => { touch(); setSupplierId(e.target.value ? Number(e.target.value) : null); }}>
                <option value="">— Choisir —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="N° facture / BL fournisseur" htmlFor="invoice">
              <Input id="invoice" value={invoice} onChange={(e) => { touch(); setInvoice(e.target.value); }} placeholder="Ex. : FA-2026-0312" />
            </Field>
            <Field label="Livraison prévue" htmlFor="expected">
              <Input id="expected" type="date" value={expectedAt} onChange={(e) => { touch(); setExpectedAt(e.target.value); }} />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Pièces commandées" description="Le prix d'achat unitaire est pré-rempli avec le dernier prix connu et reste modifiable." />
          <CardBody className="space-y-3">
            <PartPicker value={null} onPick={(p) => addPart(p)} showPrice="purchase" placeholder="Ajouter une pièce : référence, OEM, désignation, code-barres…" />
            {lines.length === 0 ? (
              <EmptyState compact title="Aucune pièce dans l'achat" description="Recherchez une pièce ci-dessus ou utilisez les suggestions de réapprovisionnement." />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[680px] text-[13px]">
                  <thead>
                    <tr className="border-b border-line bg-slate-50/80 text-left text-[11.5px] uppercase tracking-wide text-ink-muted">
                      <th className="px-3 py-2 font-semibold">Pièce</th>
                      <th className="px-3 py-2 text-right font-semibold">Stock actuel</th>
                      <th className="px-3 py-2 text-center font-semibold">Qté</th>
                      <th className="px-3 py-2 text-right font-semibold">Prix d&apos;achat</th>
                      <th className="px-3 py-2 text-right font-semibold">Total</th>
                      <th className="w-10 px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {lines.map((l) => (
                      <tr key={l.part.id}>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2.5">
                            <PartThumb imagePath={l.part.imagePath} alt="" size="sm" />
                            <div className="min-w-0">
                              <p className="truncate">
                                <span className="font-mono font-semibold">{l.part.reference}</span>
                                {l.part.brand ? <span className="ml-1.5 text-[11.5px] text-ink-muted">{l.part.brand}</span> : null}
                              </p>
                              <p className="max-w-[300px] truncate text-[12px] text-ink-secondary">{l.part.designation}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <QuantityChip quantity={l.part.quantity} minStock={l.part.minStock} />
                          {l.part.minStock > 0 ? <p className="mt-0.5 text-[10.5px] text-ink-faint">min. {l.part.minStock}</p> : null}
                        </td>
                        <td className="px-3 py-2">
                          <div className="mx-auto flex w-28 items-center rounded-lg border border-line-strong">
                            <button type="button" className="flex h-8 w-8 items-center justify-center text-ink-muted hover:bg-slate-50 hover:text-ink disabled:opacity-40" onClick={() => updateLine(l.part.id, { quantity: Math.max(1, l.quantity - 1) })} disabled={l.quantity <= 1} aria-label="Diminuer">
                              <Minus className="size-3.5" />
                            </button>
                            <input type="number" min={1} step={1} value={l.quantity} onChange={(e) => updateLine(l.part.id, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} className="h-8 w-full border-x border-line-strong bg-white text-center font-mono text-[13px] tabular outline-none focus:bg-brand-50/40" aria-label="Quantité" />
                            <button type="button" className="flex h-8 w-8 items-center justify-center text-ink-muted hover:bg-slate-50 hover:text-ink" onClick={() => updateLine(l.part.id, { quantity: l.quantity + 1 })} aria-label="Augmenter">
                              <Plus className="size-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="ml-auto flex w-36 items-center justify-end gap-1">
                            <input type="number" min={0} step="0.01" value={l.unitCost} onChange={(e) => updateLine(l.part.id, { unitCost: Math.max(0, Number(e.target.value) || 0) })} className={cn("h-8 w-full rounded-lg border px-2 text-right font-mono text-[13px] tabular outline-none focus-ring", l.unitCost !== l.part.purchasePrice ? "border-warning-600 bg-warning-50/50" : "border-line-strong")} aria-label="Prix d'achat unitaire" />
                            <span className="text-[11px] text-ink-muted">DA</span>
                          </div>
                          {l.unitCost !== l.part.purchasePrice ? <p className="mt-0.5 text-[10.5px] text-ink-muted">dernier prix : {formatAmount(l.part.purchasePrice)}</p> : null}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          <Money value={l.quantity * l.unitCost} />
                        </td>
                        <td className="px-2 py-2">
                          <Button type="button" variant="ghost" size="icon-sm" aria-label="Retirer" onClick={() => removeLine(l.part.id)}>
                            <Trash2 />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        {supplierSuggestions.length > 0 ? (
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Lightbulb className="size-4 text-warning-600" /> Suggestions de réapprovisionnement
                </span>
              }
              description={supplierId ? "Pièces de ce fournisseur en rupture ou sous le stock minimum." : "Pièces en rupture ou sous le stock minimum (tous fournisseurs). Choisissez un fournisseur pour affiner."}
              actions={
                <Button type="button" variant="secondary" size="sm" onClick={() => supplierSuggestions.forEach((s) => addPart(s.part, s.suggestedQuantity))}>
                  <Plus /> Tout ajouter
                </Button>
              }
            />
            <ul className="divide-y divide-line">
              {supplierSuggestions.slice(0, 12).map((s) => (
                <li key={s.part.id} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                  <PartThumb imagePath={s.part.imagePath} alt="" size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      <span className="font-mono font-semibold">{s.part.reference}</span>
                      <span className="ml-1.5 text-ink-secondary">{s.part.designation}</span>
                    </p>
                    <p className="text-[11.5px] text-ink-muted">
                      {s.supplierName ?? "Sans fournisseur"} · stock {s.part.quantity} / min. {s.part.minStock}
                    </p>
                  </div>
                  <QuantityChip quantity={s.part.quantity} minStock={s.part.minStock} />
                  <Button type="button" variant="secondary" size="xs" onClick={() => addPart(s.part, s.suggestedQuantity)}>
                    <Plus /> {s.suggestedQuantity}
                  </Button>
                </li>
              ))}
            </ul>
            {supplierSuggestions.length > 12 ? <p className="px-4 py-2 text-[11.5px] text-ink-muted">+ {supplierSuggestions.length - 12} autres suggestions.</p> : null}
          </Card>
        ) : null}
      </div>

      <div className="space-y-4">
        <Card className="xl:sticky xl:top-[72px]">
          <CardHeader title={mode === "edit" ? `${isOrdered ? "Commande" : "Brouillon"} ${initial.number}` : "Récapitulatif"} />
          <CardBody className="space-y-4">
            <Field label="Notes" htmlFor="notes">
              <Textarea id="notes" rows={3} value={notes} onChange={(e) => { touch(); setNotes(e.target.value); }} placeholder="Conditions, transporteur, remarques…" />
            </Field>
            <dl className="space-y-1.5 border-t border-line pt-3 text-[13px]">
              <div className="flex justify-between text-ink-secondary">
                <dt>
                  {lines.length} ligne{lines.length > 1 ? "s" : ""} · {units} article{units > 1 ? "s" : ""}
                </dt>
                <dd />
              </div>
              <div className="flex items-baseline justify-between border-t border-line pt-2 text-[15px] font-semibold">
                <dt>Total achat</dt>
                <dd>
                  <Money value={total} />
                </dd>
              </div>
            </dl>
            {isOrdered ? <InlineAlert variant="info" title="Commande déjà passée">Vous pouvez encore ajuster les lignes avant la réception.</InlineAlert> : null}
            <div className="flex flex-col gap-2 pt-1">
              {can.receive ? (
                <Button size="lg" variant="success" onClick={() => setReceiveOpen(true)} disabled={lines.length === 0 || !supplierId || Boolean(submitting)} loading={submitting === "RECEIVE"}>
                  <PackageCheck /> Réceptionner maintenant
                </Button>
              ) : null}
              <Button size="lg" onClick={() => submit("ORDER")} disabled={lines.length === 0 || !supplierId || Boolean(submitting)} loading={submitting === "ORDER"}>
                <Send /> {isOrdered ? "Enregistrer la commande" : "Passer la commande"}
              </Button>
              {!isOrdered ? (
                <Button size="lg" variant="secondary" onClick={() => submit("DRAFT")} disabled={lines.length === 0 || Boolean(submitting)} loading={submitting === "DRAFT"}>
                  <Save /> Enregistrer en brouillon
                </Button>
              ) : null}
              <Button variant="ghost" onClick={() => (dirty ? setLeaveOpen(true) : router.back())} disabled={Boolean(submitting)}>
                <ArrowLeft /> Annuler
              </Button>
            </div>
            <p className="text-[11.5px] text-ink-muted">Seule la réception augmente le stock (mouvement « Entrée achat » par ligne) et met à jour le prix d&apos;achat des pièces.</p>
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={receiveOpen}
        onOpenChange={setReceiveOpen}
        title="Réceptionner cet achat ?"
        description={
          <>
            {units} article{units > 1 ? "s" : ""} sur {lines.length} ligne{lines.length > 1 ? "s" : ""} · total <span className="font-semibold text-ink">{formatAmount(total)} DA</span>. Le stock sera augmenté immédiatement et le prix d&apos;achat des pièces mis à jour.
          </>
        }
        confirmLabel="Réceptionner et entrer en stock"
        variant="success"
        loading={submitting === "RECEIVE"}
        onConfirm={() => submit("RECEIVE")}
      />
      <ConfirmDialog open={leaveOpen} onOpenChange={setLeaveOpen} title="Abandonner cet achat ?" description="Les lignes saisies seront perdues." confirmLabel="Abandonner" variant="danger" onConfirm={() => router.back()} />
    </div>
  );
}
