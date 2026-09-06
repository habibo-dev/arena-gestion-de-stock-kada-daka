"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { z } from "zod";
import type { SettingsFormValues } from "@/lib/schemas/auth";
import { saveSettingsAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/input";
import { InlineAlert } from "@/components/ui/states";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";

/* Flat field names: react-hook-form would treat "company.name" as a nested path. */
const localSchema = z.object({
  companyName: z.string().trim().min(1, "Le nom de l'entreprise est requis.").max(120),
  companyAddress: z.string().trim().max(200),
  companyPhone: z.string().trim().max(40),
  allowNegative: z.boolean(),
  defaultTier: z.enum(["DETAIL", "GROS"]),
  salePrefix: z.string().trim().toUpperCase().min(1, "Requis.").max(8).regex(/^[A-Z0-9]+$/, "Majuscules et chiffres uniquement."),
  purchasePrefix: z.string().trim().toUpperCase().min(1, "Requis.").max(8).regex(/^[A-Z0-9]+$/, "Majuscules et chiffres uniquement."),
});
type LocalValues = z.input<typeof localSchema>;

function toLocal(s: SettingsFormValues): LocalValues {
  return { companyName: s["company.name"], companyAddress: s["company.address"], companyPhone: s["company.phone"], allowNegative: s["stock.allowNegative"] === "true", defaultTier: s["sales.defaultPriceTier"], salePrefix: s["sales.numberPrefix"], purchasePrefix: s["purchases.numberPrefix"] };
}
function toSettings(v: z.output<typeof localSchema>): SettingsFormValues {
  return { "company.name": v.companyName, "company.address": v.companyAddress, "company.phone": v.companyPhone, "stock.allowNegative": v.allowNegative ? "true" : "false", "sales.defaultPriceTier": v.defaultTier, "sales.numberPrefix": v.salePrefix, "purchases.numberPrefix": v.purchasePrefix };
}

export function SettingsForm({ initial, readOnly }: { initial: SettingsFormValues; readOnly: boolean }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const defaults = React.useMemo(() => toLocal(initial), [initial]);
  const form = useForm<LocalValues, unknown, z.output<typeof localSchema>>({ resolver: zodResolver(localSchema), defaultValues: defaults });
  useUnsavedChanges(form.formState.isDirty && !pending);
  const allowNegative = form.watch("allowNegative");
  const err = form.formState.errors;

  const submit = form.handleSubmit(async (values) => {
    setPending(true);
    try {
      const res = await saveSettingsAction(toSettings(values));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Paramètres enregistrés.");
      form.reset(values);
      router.refresh();
    } finally {
      setPending(false);
    }
  });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <fieldset disabled={readOnly} className="space-y-4">
        <Card>
          <CardHeader title="Entreprise" description="Affiché dans l'en-tête des exports et des documents imprimés." />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom de l'entreprise" htmlFor="s-company" required error={err.companyName?.message}>
              <Input id="s-company" {...form.register("companyName")} />
            </Field>
            <Field label="Téléphone" htmlFor="s-phone" error={err.companyPhone?.message}>
              <Input id="s-phone" {...form.register("companyPhone")} placeholder="025 00 00 00" />
            </Field>
            <Field label="Adresse" htmlFor="s-address" error={err.companyAddress?.message} className="sm:col-span-2">
              <Textarea id="s-address" rows={2} {...form.register("companyAddress")} placeholder="Rue, ville, wilaya" />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Stock" />
          <CardBody className="space-y-3">
            <Switch checked={allowNegative} onCheckedChange={(v) => form.setValue("allowNegative", v, { shouldDirty: true })} disabled={readOnly} label="Autoriser le stock négatif" description="Si activé, une vente peut être confirmée même si la quantité en stock est insuffisante : la quantité devient négative et doit être régularisée. Désactivé, la confirmation est bloquée (recommandé)." />
            {allowNegative ? <InlineAlert variant="warning" title="Stock négatif autorisé">Les alertes de rupture continueront d&apos;apparaître ; pensez à régulariser par une réception ou un inventaire.</InlineAlert> : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Ventes & achats" />
          <CardBody className="grid gap-4 sm:grid-cols-3">
            <Field label="Tarif par défaut des ventes" htmlFor="s-tier" error={err.defaultTier?.message} hint="Pré-sélectionné à la création d'une vente ; modifiable ligne par ligne.">
              <Select id="s-tier" {...form.register("defaultTier")}>
                <option value="DETAIL">Prix détail</option>
                <option value="GROS">Prix gros</option>
              </Select>
            </Field>
            <Field label="Préfixe des n° de vente" htmlFor="s-vte" error={err.salePrefix?.message} hint="Ex. VTE → VTE-2026-0001">
              <Input id="s-vte" {...form.register("salePrefix")} className="font-mono uppercase" maxLength={8} />
            </Field>
            <Field label="Préfixe des n° d'achat" htmlFor="s-ach" error={err.purchasePrefix?.message} hint="Ex. ACH → ACH-2026-0001">
              <Input id="s-ach" {...form.register("purchasePrefix")} className="font-mono uppercase" maxLength={8} />
            </Field>
          </CardBody>
        </Card>
      </fieldset>

      {!readOnly ? (
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => form.reset(defaults)} disabled={!form.formState.isDirty || pending}>
            Annuler les modifications
          </Button>
          <Button type="submit" loading={pending} disabled={!form.formState.isDirty}>
            <Save /> Enregistrer
          </Button>
        </div>
      ) : null}
    </form>
  );
}
