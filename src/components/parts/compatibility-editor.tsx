"use client";

import * as React from "react";
import Link from "next/link";
import { BadgeCheck, CircleHelp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/states";
import { vehicleOptionsAction } from "@/server/actions/vehicles";
import { removeCompatibilityAction, setCompatibilityAction } from "@/server/actions/parts";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";

export type CompatRow = {
  vehicleId: number;
  status: string;
  source: string | null;
  note: string | null;
  make: string;
  model: string;
  generation: string | null;
  engineLabel: string;
  engineCode: string | null;
  fuel: string | null;
  powerHp: number | null;
  yearFrom: number | null;
  yearTo: number | null;
};

export function CompatStatusBadge({ status, size = "sm" }: { status: string; size?: "sm" | "md" }) {
  const verified = status === "VERIFIED";
  return (
    <Tooltip content={verified ? "Compatibilité vérifiée par votre équipe ou une source fiable." : "Compatibilité déclarée mais non vérifiée : à confirmer avant de garantir le montage."}>
      <span>
        <Badge variant={verified ? "success" : "warning"} size={size}>
          {verified ? <BadgeCheck /> : <CircleHelp />}
          {verified ? "Vérifiée" : "Non vérifiée"}
        </Badge>
      </span>
    </Tooltip>
  );
}

export function CompatibilityEditor({ partId, rows, canManage }: { partId: number; rows: CompatRow[]; canManage: boolean }) {
  const [addOpen, setAddOpen] = React.useState(false);
  const [removing, setRemoving] = React.useState<CompatRow | null>(null);
  const remove = useAction(removeCompatibilityAction, { success: "Compatibilité retirée.", onSuccess: () => setRemoving(null) });
  const toggle = useAction(setCompatibilityAction, { success: "Statut mis à jour." });

  const grouped = React.useMemo(() => {
    const map = new Map<string, CompatRow[]>();
    for (const r of rows) {
      const key = `${r.make} ${r.model}${r.generation ? ` ${r.generation}` : ""}`;
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()];
  }, [rows]);

  return (
    <div>
      {rows.length === 0 ? (
        <EmptyState
          compact
          title="Aucun véhicule associé"
          description="Aucune donnée de compatibilité n'est disponible pour cette pièce. Nous n'inventons pas de compatibilités : ajoutez-les à partir de vos catalogues ou de votre expérience."
          action={
            canManage ? (
              <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
                <Plus /> Associer un véhicule
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ul className="divide-y divide-line">
            {grouped.map(([label, items]) => (
              <li key={label} className="px-4 py-3">
                <p className="text-[13px] font-semibold text-ink">{label}</p>
                <ul className="mt-1.5 space-y-1.5">
                  {items.map((r) => (
                    <li key={r.vehicleId} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
                      <Link href={`/vehicules/${r.vehicleId}`} className="font-medium text-brand-700 hover:underline">
                        {r.engineLabel}
                      </Link>
                      <span className="text-ink-muted">
                        {[r.engineCode, r.fuel, r.powerHp ? `${r.powerHp} ch` : null, r.yearFrom ? `${r.yearFrom}–${r.yearTo ?? "…"}` : null].filter(Boolean).join(" · ")}
                      </span>
                      <span className="ml-auto flex items-center gap-1.5">
                        <CompatStatusBadge status={r.status} />
                        {r.note ? <span className="max-w-48 truncate text-[11.5px] text-ink-muted" title={r.note}>{r.note}</span> : null}
                        {canManage ? (
                          <>
                            <Button size="xs" variant="ghost" onClick={() => toggle.run({ partId, vehicleId: r.vehicleId, status: r.status === "VERIFIED" ? "UNVERIFIED" : "VERIFIED", note: r.note })} title={r.status === "VERIFIED" ? "Marquer non vérifiée" : "Marquer vérifiée"}>
                              {r.status === "VERIFIED" ? "Déclasser" : "Vérifier"}
                            </Button>
                            <Button size="icon-xs" variant="ghost" aria-label="Retirer" onClick={() => setRemoving(r)}>
                              <Trash2 />
                            </Button>
                          </>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          {canManage ? (
            <div className="border-t border-line px-4 py-2.5">
              <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
                <Plus /> Associer un véhicule
              </Button>
            </div>
          ) : null}
        </>
      )}

      {addOpen ? <AddCompatDialog partId={partId} existing={rows.map((r) => r.vehicleId)} onOpenChange={setAddOpen} /> : null}
      <ConfirmDialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)} title="Retirer cette compatibilité ?" description={removing ? `${removing.make} ${removing.model} ${removing.engineLabel} ne sera plus proposé pour cette pièce.` : undefined} confirmLabel="Retirer" variant="danger" loading={remove.pending} onConfirm={() => removing && remove.run(partId, removing.vehicleId)} />
    </div>
  );
}

function AddCompatDialog({ partId, existing, onOpenChange }: { partId: number; existing: number[]; onOpenChange: (o: boolean) => void }) {
  const [vehicleId, setVehicleId] = React.useState<number | null>(null);
  const [selected, setSelected] = React.useState<ComboOption<number> | null>(null);
  const [status, setStatus] = React.useState<"VERIFIED" | "UNVERIFIED">("UNVERIFIED");
  const [note, setNote] = React.useState("");
  const { run, pending } = useAction(setCompatibilityAction, { success: "Véhicule associé.", onSuccess: () => onOpenChange(false) });

  const load = React.useCallback(
    async (q: string) => {
      const res = await vehicleOptionsAction(q);
      if (!res.ok) return [];
      return res.data.map((v) => ({ value: v.id, label: v.label, description: v.sub || undefined, disabled: existing.includes(v.id) }));
    },
    [existing],
  );

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title="Associer un véhicule" description="Recherchez par marque, modèle, motorisation ou code moteur." size="sm">
        <div className="space-y-4">
          <Field label="Véhicule" required>
            <Combobox<number> value={vehicleId} onChange={(v, o) => { setVehicleId(v); setSelected(o); }} loadOptions={load} selectedOption={selected} placeholder="Ex. : Clio 4 1.5 dCi" searchPlaceholder="Marque, modèle, moteur…" />
          </Field>
          <Field label="Statut" hint="Ne marquez « Vérifiée » que si le montage est confirmé (catalogue constructeur, expérience atelier).">
            <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="UNVERIFIED">Non vérifiée (à confirmer)</option>
              <option value="VERIFIED">Vérifiée</option>
            </Select>
          </Field>
          <Field label="Note / source" htmlFor="compat-note">
            <Input id="compat-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. : catalogue Bosch 2024, monté chez client X" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            Annuler
          </Button>
          <Button loading={pending} disabled={!vehicleId} onClick={() => vehicleId && run({ partId, vehicleId, status, note: note || null })} className={cn(!vehicleId && "opacity-60")}>
            Associer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
