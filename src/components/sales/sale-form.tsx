"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Check, Minus, Plus, Save, Trash2, UserPlus, X } from "lucide-react";
import { createSaleAction, updateSaleAction, createCustomerAction, searchCustomersAction } from "@/server/actions/sales";
import type { SaleFormValues } from "@/lib/schemas/sales";
import { PartPicker, type PickedPart } from "@/components/parts/part-picker";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { ConfirmDialog, Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { EmptyState, InlineAlert } from "@/components/ui/states";
import { PartThumb, Money, SegmentedControl } from "@/components/ui/misc";
import { QuantityChip } from "@/components/ui/stock-badge";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { PAYMENT_METHOD_LABELS, PRICE_TIER_LABELS, computeDiscount, round2 } from "@/lib/stock";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

export type SaleLine = { part: PickedPart; quantity: number; unitPrice: number; priceEdited: boolean };

export type SaleFormInitial = {
  id?: number;
  number?: string;
  customerId: number | null;
  customerName: string;
  customerPhone: string;
  priceTier: "DETAIL" | "GROS";
  paymentMethod: keyof typeof PAYMENT_METHOD_LABELS;
  discountType: "NONE" | "PERCENT" | "AMOUNT";
  discountValue: number;
  notes: string;
  lines: SaleLine[];
};

type Props = {
  mode: "create" | "edit";
  initial: SaleFormInitial;
  allowNegativeStock: boolean;
  can: { confirm: boolean };
  prefillPart?: PickedPart | null;
};

const tierPrice = (p: PickedPart, tier: "DETAIL" | "GROS") => (tier === "GROS" ? p.wholesalePrice : p.retailPrice);

export function SaleForm({ mode, initial, allowNegativeStock, can, prefillPart }: Props) {
  const router = useRouter();
  const [lines, setLines] = React.useState<SaleLine[]>(() => {
    if (initial.lines.length) return initial.lines;
    if (prefillPart) return [{ part: prefillPart, quantity: 1, unitPrice: tierPrice(prefillPart, initial.priceTier), priceEdited: false }];
    return [];
  });
  const [priceTier, setPriceTier] = React.useState(initial.priceTier);
  const [paymentMethod, setPaymentMethod] = React.useState(initial.paymentMethod);
  const [discountType, setDiscountType] = React.useState(initial.discountType);
  const [discountValue, setDiscountValue] = React.useState(initial.discountValue);
  const [notes, setNotes] = React.useState(initial.notes);
  const [customerId, setCustomerId] = React.useState<number | null>(initial.customerId);
  const [customerOption, setCustomerOption] = React.useState<ComboOption<number> | null>(initial.customerId ? { value: initial.customerId, label: initial.customerName } : null);
  const [customerName, setCustomerName] = React.useState(initial.customerName);
  const [customerPhone, setCustomerPhone] = React.useState(initial.customerPhone);
  const [dirty, setDirty] = React.useState(Boolean(prefillPart));
  const [submitting, setSubmitting] = React.useState<null | "draft" | "confirm">(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = React.useState(false);
  const [leaveOpen, setLeaveOpen] = React.useState(false);
  useUnsavedChanges(dirty && !submitting);

  const touch = () => setDirty(true);

  const subtotal = round2(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0));
  const { discountAmount, total } = computeDiscount(subtotal, discountType, discountValue);
  const cost = lines.reduce((s, l) => s + l.quantity * l.part.purchasePrice, 0);
  const margin = total - cost;
  const overselling = lines.filter((l) => l.quantity > l.part.quantity);

  const addPart = (p: PickedPart | null) => {
    if (!p) return;
    touch();
    setLines((ls) => {
      const idx = ls.findIndex((l) => l.part.id === p.id);
      if (idx >= 0) return ls.map((l, i) => (i === idx ? { ...l, quantity: l.quantity + 1 } : l));
      return [...ls, { part: p, quantity: 1, unitPrice: tierPrice(p, priceTier), priceEdited: false }];
    });
  };
  const updateLine = (id: number, patch: Partial<SaleLine>) => {
    touch();
    setLines((ls) => ls.map((l) => (l.part.id === id ? { ...l, ...patch } : l)));
  };
  const removeLine = (id: number) => {
    touch();
    setLines((ls) => ls.filter((l) => l.part.id !== id));
  };
  const changeTier = (tier: "DETAIL" | "GROS") => {
    touch();
    setPriceTier(tier);
    setLines((ls) => ls.map((l) => (l.priceEdited ? l : { ...l, unitPrice: tierPrice(l.part, tier) })));
  };

  const loadCustomers = React.useCallback(async (q: string): Promise<ComboOption<number>[]> => {
    const res = await searchCustomersAction(q);
    if (!res.ok) return [];
    return res.data.map((c) => ({ value: c.id, label: c.name, description: [c.phone, c.customerType === "PROFESSIONNEL" ? "Professionnel" : "Particulier"].filter(Boolean).join(" · "), keywords: [c.phone ?? ""] }));
  }, []);

  const buildPayload = (): SaleFormValues => ({
    customerId,
    customerName: customerName || null,
    customerPhone: customerPhone || null,
    priceTier,
    paymentMethod,
    discountType,
    discountValue,
    notes: notes || null,
    items: lines.map((l) => ({ partId: l.part.id, quantity: l.quantity, unitPrice: l.unitPrice })),
  });

  const submit = async (confirm: boolean) => {
    if (lines.length === 0) {
      toast.error("Ajoutez au moins une pièce.");
      return;
    }
    setSubmitting(confirm ? "confirm" : "draft");
    try {
      const payload = buildPayload();
      const res = mode === "create" ? await createSaleAction(payload, confirm) : await updateSaleAction(initial.id!, payload, confirm);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDirty(false);
      const id = mode === "create" ? (res.data as { id: number }).id : initial.id!;
      toast.success(confirm ? "Vente confirmée : le stock a été mis à jour." : "Brouillon enregistré.");
      router.push(`/ventes/${id}`);
      router.refresh();
    } finally {
      setSubmitting(null);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <Card>
          <CardHeader
            title="Pièces vendues"
            description="Recherchez et ajoutez les pièces ; le prix se remplit selon le tarif choisi et reste modifiable ligne par ligne."
            actions={<SegmentedControl value={priceTier} onChange={changeTier} options={[{ value: "DETAIL", label: PRICE_TIER_LABELS.DETAIL }, { value: "GROS", label: PRICE_TIER_LABELS.GROS }]} />}
          />
          <CardBody className="space-y-3">
            <PartPicker value={null} onPick={addPart} showPrice={priceTier === "GROS" ? "wholesale" : "retail"} placeholder="Ajouter une pièce : référence, OEM, désignation, code-barres…" />
            {lines.length === 0 ? (
              <EmptyState compact title="Aucune pièce dans la vente" description="Utilisez la recherche ci-dessus. Astuce : scannez un code-barres dans le champ pour l'ajouter directement." />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[680px] text-[13px]">
                  <thead>
                    <tr className="border-b border-line bg-slate-50/80 text-left text-[11.5px] uppercase tracking-wide text-ink-muted">
                      <th className="px-3 py-2 font-semibold">Pièce</th>
                      <th className="px-3 py-2 text-right font-semibold">Stock</th>
                      <th className="px-3 py-2 text-center font-semibold">Qté</th>
                      <th className="px-3 py-2 text-right font-semibold">Prix unitaire</th>
                      <th className="px-3 py-2 text-right font-semibold">Total</th>
                      <th className="w-10 px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {lines.map((l) => {
                      const over = l.quantity > l.part.quantity;
                      const ref = tierPrice(l.part, priceTier);
                      return (
                        <tr key={l.part.id} className={cn(over && "bg-danger-50/40")}>
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
                              <input type="number" min={0} step="0.01" value={l.unitPrice} onChange={(e) => updateLine(l.part.id, { unitPrice: Math.max(0, Number(e.target.value) || 0), priceEdited: true })} className={cn("h-8 w-full rounded-lg border px-2 text-right font-mono text-[13px] tabular outline-none focus-ring", l.priceEdited && l.unitPrice !== ref ? "border-warning-600 bg-warning-50/50" : "border-line-strong")} aria-label="Prix unitaire" />
                              <span className="text-[11px] text-ink-muted">DA</span>
                            </div>
                            {l.priceEdited && l.unitPrice !== ref ? (
                              <button type="button" className="mt-0.5 text-[10.5px] text-brand-700 hover:underline" onClick={() => updateLine(l.part.id, { unitPrice: ref, priceEdited: false })}>
                                tarif {PRICE_TIER_LABELS[priceTier].toLowerCase()} : {formatAmount(ref)}
                              </button>
                            ) : null}
                            {l.unitPrice < l.part.purchasePrice ? <p className="mt-0.5 text-[10.5px] text-danger-700">sous le prix d&apos;achat ({formatAmount(l.part.purchasePrice)})</p> : null}
                          </td>
                          <td className="px-3 py-2 text-right font-medium">
                            <Money value={l.quantity * l.unitPrice} />
                          </td>
                          <td className="px-2 py-2">
                            <Button type="button" variant="ghost" size="icon-sm" aria-label="Retirer" onClick={() => removeLine(l.part.id)}>
                              <Trash2 />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {overselling.length ? (
              <InlineAlert variant={allowNegativeStock ? "warning" : "danger"} icon={<AlertTriangle />} title={allowNegativeStock ? "Quantité supérieure au stock" : "Stock insuffisant"}>
                {overselling.map((l) => (
                  <span key={l.part.id} className="block">
                    <span className="font-mono">{l.part.reference}</span> : {l.quantity} demandée{l.quantity > 1 ? "s" : ""} pour {l.part.quantity} en stock.
                  </span>
                ))}
                {allowNegativeStock ? "Le stock négatif est autorisé dans les paramètres : la confirmation passera mais le stock deviendra négatif." : "La confirmation sera refusée. Réduisez la quantité, réceptionnez un achat, ou autorisez le stock négatif dans les paramètres."}
              </InlineAlert>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Client" description="Facultatif : client enregistré ou simple nom de passage." />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Client enregistré" className="sm:col-span-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Combobox<number>
                    value={customerId}
                    selectedOption={customerOption}
                    onChange={(v, o) => {
                      touch();
                      setCustomerId(v);
                      setCustomerOption(o);
                      if (o) {
                        setCustomerName(o.label);
                        setCustomerPhone(o.description?.split(" · ")[0]?.match(/^[\d +().-]{6,}$/) ? o.description.split(" · ")[0]! : customerPhone);
                      }
                    }}
                    loadOptions={loadCustomers}
                    placeholder="Rechercher un client (nom, téléphone)"
                    clearable
                  />
                </div>
                <Button type="button" variant="secondary" onClick={() => setNewCustomerOpen(true)}>
                  <UserPlus /> Nouveau
                </Button>
              </div>
            </Field>
            <Field label="Nom (client de passage)" htmlFor="customerName">
              <Input id="customerName" value={customerName} onChange={(e) => { touch(); setCustomerName(e.target.value); }} placeholder="Ex. : Garage Belkacem" disabled={Boolean(customerId)} />
            </Field>
            <Field label="Téléphone" htmlFor="customerPhone">
              <Input id="customerPhone" value={customerPhone} onChange={(e) => { touch(); setCustomerPhone(e.target.value); }} placeholder="05 …" disabled={Boolean(customerId)} />
            </Field>
          </CardBody>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="xl:sticky xl:top-[72px]">
          <CardHeader title={mode === "edit" ? `Brouillon ${initial.number}` : "Récapitulatif"} />
          <CardBody className="space-y-4">
            <Field label="Mode de paiement" htmlFor="payment">
              <Select id="payment" value={paymentMethod} onChange={(e) => { touch(); setPaymentMethod(e.target.value as typeof paymentMethod); }}>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Remise">
              <div className="flex gap-2">
                <Select value={discountType} onChange={(e) => { touch(); setDiscountType(e.target.value as typeof discountType); setDiscountValue(0); }} className="w-36">
                  <option value="NONE">Aucune</option>
                  <option value="PERCENT">Pourcentage</option>
                  <option value="AMOUNT">Montant (DA)</option>
                </Select>
                <Input type="number" min={0} step={discountType === "PERCENT" ? 1 : 0.01} max={discountType === "PERCENT" ? 100 : undefined} value={discountValue} onChange={(e) => { touch(); setDiscountValue(Math.max(0, Number(e.target.value) || 0)); }} disabled={discountType === "NONE"} className="text-right tabular" rightSlot={<span className="text-xs text-ink-muted">{discountType === "PERCENT" ? "%" : "DA"}</span>} />
              </div>
            </Field>
            <Field label="Notes" htmlFor="notes">
              <Textarea id="notes" rows={2} value={notes} onChange={(e) => { touch(); setNotes(e.target.value); }} placeholder="Référence bon de commande client, remarques…" />
            </Field>

            <dl className="space-y-1.5 border-t border-line pt-3 text-[13px]">
              <div className="flex justify-between text-ink-secondary">
                <dt>Sous-total ({lines.reduce((s, l) => s + l.quantity, 0)} article{lines.reduce((s, l) => s + l.quantity, 0) > 1 ? "s" : ""})</dt>
                <dd>
                  <Money value={subtotal} />
                </dd>
              </div>
              {discountAmount > 0 ? (
                <div className="flex justify-between text-ink-secondary">
                  <dt>Remise {discountType === "PERCENT" ? `(${discountValue} %)` : ""}</dt>
                  <dd>
                    − <Money value={discountAmount} />
                  </dd>
                </div>
              ) : null}
              <div className="flex items-baseline justify-between border-t border-line pt-2 text-[15px] font-semibold">
                <dt>Total</dt>
                <dd>
                  <Money value={total} />
                </dd>
              </div>
              <div className={cn("flex justify-between text-[12px]", margin < 0 ? "text-danger-700" : "text-ink-muted")}>
                <dt>Marge estimée</dt>
                <dd className="tabular">
                  {margin >= 0 ? "+" : ""}
                  {formatAmount(margin)} DA {cost > 0 ? `(${((margin / cost) * 100).toFixed(0)} %)` : ""}
                </dd>
              </div>
            </dl>

            <div className="flex flex-col gap-2 pt-1">
              {can.confirm ? (
                <Button size="lg" onClick={() => setConfirmOpen(true)} disabled={lines.length === 0 || Boolean(submitting) || (overselling.length > 0 && !allowNegativeStock)} loading={submitting === "confirm"}>
                  <Check /> Confirmer la vente
                </Button>
              ) : null}
              <Button size="lg" variant="secondary" onClick={() => submit(false)} disabled={lines.length === 0 || Boolean(submitting)} loading={submitting === "draft"}>
                <Save /> Enregistrer en brouillon
              </Button>
              <Button variant="ghost" onClick={() => (dirty ? setLeaveOpen(true) : router.back())} disabled={Boolean(submitting)}>
                <ArrowLeft /> Annuler
              </Button>
            </div>
            <p className="text-[11.5px] text-ink-muted">La confirmation déduit immédiatement les quantités du stock et crée un mouvement « Sortie vente » par ligne. Un brouillon ne touche pas au stock.</p>
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirmer la vente ?"
        description={
          <>
            {lines.length} ligne{lines.length > 1 ? "s" : ""} · total <span className="font-semibold text-ink">{formatAmount(total)} DA</span> · {PAYMENT_METHOD_LABELS[paymentMethod]}. Le stock sera déduit et la vente ne pourra plus être modifiée (seulement annulée).
          </>
        }
        confirmLabel="Confirmer et déduire le stock"
        variant="success"
        loading={submitting === "confirm"}
        onConfirm={() => submit(true)}
      />
      <ConfirmDialog open={leaveOpen} onOpenChange={setLeaveOpen} title="Abandonner cette vente ?" description="Les lignes saisies seront perdues." confirmLabel="Abandonner" variant="danger" onConfirm={() => router.back()} />
      {newCustomerOpen ? (
        <NewCustomerDialog
          onOpenChange={setNewCustomerOpen}
          initialName={customerName}
          initialPhone={customerPhone}
          onCreated={(c) => {
            touch();
            setCustomerId(c.id);
            setCustomerOption({ value: c.id, label: c.name });
            setCustomerName(c.name);
            setCustomerPhone(c.phone ?? "");
          }}
        />
      ) : null}
    </div>
  );
}

function NewCustomerDialog({ onOpenChange, onCreated, initialName, initialPhone }: { onOpenChange: (o: boolean) => void; onCreated: (c: { id: number; name: string; phone: string | null }) => void; initialName: string; initialPhone: string }) {
  const [name, setName] = React.useState(initialName);
  const [phone, setPhone] = React.useState(initialPhone);
  const [type, setType] = React.useState<"PARTICULIER" | "PROFESSIONNEL">("PARTICULIER");
  const [address, setAddress] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const save = async () => {
    setPending(true);
    try {
      const res = await createCustomerAction({ name, phone: phone || null, customerType: type, address: address || null });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Client créé.");
      onCreated({ id: res.data.id, name: res.data.name, phone: res.data.phone ?? null });
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title="Nouveau client" size="sm">
        <div className="space-y-3">
          <Field label="Nom" htmlFor="nc-name" required>
            <Input id="nc-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Téléphone" htmlFor="nc-phone">
              <Input id="nc-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label="Type" htmlFor="nc-type">
              <Select id="nc-type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
                <option value="PARTICULIER">Particulier</option>
                <option value="PROFESSIONNEL">Professionnel (garage, revendeur)</option>
              </Select>
            </Field>
          </div>
          <Field label="Adresse" htmlFor="nc-address">
            <Input id="nc-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            <X /> Annuler
          </Button>
          <Button onClick={save} loading={pending} disabled={name.trim().length < 2}>
            Créer le client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
