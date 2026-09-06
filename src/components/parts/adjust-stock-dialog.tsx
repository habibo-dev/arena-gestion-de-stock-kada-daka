"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowDown, ArrowUp, Equal } from "lucide-react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { InlineAlert } from "@/components/ui/states";
import { adjustStockAction } from "@/server/actions/parts";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";

const schema = z.object({
  mode: z.enum(["ADD", "REMOVE", "SET"]),
  quantity: z.coerce.number().int("Entier attendu.").min(0, "Quantité invalide."),
  type: z.enum(["AJUSTEMENT", "RETOUR_CLIENT", "RETOUR_FOURNISSEUR", "INVENTAIRE"]),
  reason: z.string().trim().min(3, "Indiquez un motif (3 caractères minimum)."),
});
type Values = z.output<typeof schema>;
type FormInput = z.input<typeof schema>;

const REASONS: Record<Values["mode"], string[]> = {
  ADD: ["Retour client", "Erreur de saisie précédente", "Pièce retrouvée en rayon", "Réception hors bon d'achat"],
  REMOVE: ["Casse / pièce endommagée", "Retour fournisseur", "Vol ou perte constatée", "Usage interne atelier", "Erreur de saisie précédente"],
  SET: ["Inventaire physique", "Recomptage du rayon", "Régularisation après import"],
};

export function AdjustStockDialog({ open, onOpenChange, part, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; part: { id: number; reference: string; designation: string; quantity: number; unit: string }; onDone?: () => void }) {
  const form = useForm<FormInput, unknown, Values>({ resolver: zodResolver(schema), defaultValues: { mode: "ADD", quantity: 1, type: "AJUSTEMENT", reason: "" } });
  const mode = form.watch("mode");
  const qty = Number(form.watch("quantity")) || 0;
  const type = form.watch("type");
  const newQty = mode === "SET" ? qty : mode === "ADD" ? part.quantity + qty : part.quantity - qty;
  const negative = newQty < 0;

  const { run, pending } = useAction(adjustStockAction, {
    success: (r) => `Stock mis à jour : ${r.previousQuantity} → ${r.newQuantity} ${part.unit}`,
    onSuccess: () => {
      onOpenChange(false);
      onDone?.();
    },
  });

  React.useEffect(() => {
    // keep type coherent with mode
    if (mode === "SET") form.setValue("type", "INVENTAIRE");
    else if (type === "INVENTAIRE") form.setValue("type", "AJUSTEMENT");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const submit = form.handleSubmit(async (values) => {
    await run({ partId: part.id, ...values });
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent
        title="Ajuster le stock"
        description={
          <>
            <span className="font-mono font-medium text-ink">{part.reference}</span> · {part.designation}
          </>
        }
      >
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Type d'ajustement">
            {(
              [
                { v: "ADD", label: "Ajouter", icon: ArrowUp, cls: "data-[on=true]:border-success-600 data-[on=true]:bg-success-50 data-[on=true]:text-success-700" },
                { v: "REMOVE", label: "Retirer", icon: ArrowDown, cls: "data-[on=true]:border-danger-600 data-[on=true]:bg-danger-50 data-[on=true]:text-danger-700" },
                { v: "SET", label: "Fixer à", icon: Equal, cls: "data-[on=true]:border-brand-600 data-[on=true]:bg-brand-50 data-[on=true]:text-brand-700" },
              ] as const
            ).map((o) => (
              <button key={o.v} type="button" role="radio" aria-checked={mode === o.v} data-on={mode === o.v} onClick={() => form.setValue("mode", o.v)} className={cn("flex h-10 items-center justify-center gap-1.5 rounded-lg border border-line-strong text-[13px] font-medium text-ink-secondary transition-colors hover:bg-slate-50 focus-ring", o.cls)}>
                <o.icon className="size-4" /> {o.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={mode === "SET" ? "Nouvelle quantité" : "Quantité"} htmlFor="adj-qty" error={form.formState.errors.quantity?.message} required>
              <Input id="adj-qty" type="number" min={0} step={1} inputMode="numeric" autoFocus {...form.register("quantity")} invalid={Boolean(form.formState.errors.quantity)} />
            </Field>
            <Field label="Nature du mouvement" htmlFor="adj-type">
              <Select id="adj-type" {...form.register("type")} disabled={mode === "SET"}>
                {mode === "SET" ? (
                  <option value="INVENTAIRE">Inventaire</option>
                ) : (
                  <>
                    <option value="AJUSTEMENT">Ajustement</option>
                    {mode === "ADD" ? <option value="RETOUR_CLIENT">Retour client</option> : <option value="RETOUR_FOURNISSEUR">Retour fournisseur</option>}
                    <option value="INVENTAIRE">Inventaire</option>
                  </>
                )}
              </Select>
            </Field>
          </div>

          <Field label="Motif" htmlFor="adj-reason" error={form.formState.errors.reason?.message} required hint="Le motif est enregistré dans le journal des mouvements.">
            <Textarea id="adj-reason" rows={2} {...form.register("reason")} invalid={Boolean(form.formState.errors.reason)} placeholder="Ex. : inventaire du rayon B2, 2 pièces abîmées…" />
            <div className="mt-1.5 flex flex-wrap gap-1">
              {REASONS[mode].map((r) => (
                <button key={r} type="button" onClick={() => form.setValue("reason", r, { shouldValidate: true })} className="rounded-md border border-line bg-slate-50 px-1.5 py-0.5 text-[11.5px] text-ink-secondary hover:border-line-strong hover:bg-white">
                  {r}
                </button>
              ))}
            </div>
          </Field>

          <div className={cn("flex items-center justify-between rounded-lg border px-3 py-2 text-[13px]", negative ? "border-danger-100 bg-danger-50 text-danger-700" : "border-line bg-slate-50 text-ink-secondary")}>
            <span>Stock actuel</span>
            <span className="font-mono tabular">
              {part.quantity} → <span className={cn("font-semibold", !negative && "text-ink")}>{newQty}</span> {part.unit}
            </span>
          </div>
          {negative ? <InlineAlert variant="danger">Le stock deviendrait négatif. Ce mouvement sera refusé sauf si le stock négatif est autorisé dans les paramètres.</InlineAlert> : null}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" loading={pending} variant={mode === "REMOVE" ? "danger" : "primary"}>
              Enregistrer le mouvement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
