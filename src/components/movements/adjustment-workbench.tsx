"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import type { MovementListItem } from "@/server/services/movements";
import { PartPicker, type PickedPart } from "@/components/parts/part-picker";
import { AdjustStockDialog } from "@/components/parts/adjust-stock-dialog";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PartThumb, Money } from "@/components/ui/misc";
import { QuantityChip, StockBadge } from "@/components/ui/stock-badge";
import { MovementsTable } from "./movements-table";

export function AdjustmentWorkbench({ initialPart, recent }: { initialPart: PickedPart | null; recent: MovementListItem[] }) {
  const router = useRouter();
  const [part, setPart] = React.useState<PickedPart | null>(initialPart);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => setPart(initialPart), [initialPart]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="1. Choisir la pièce" />
        <CardBody className="space-y-4">
          <PartPicker value={part?.id ?? null} selected={part} onPick={(p) => { setPart(p); if (p) router.replace(`/mouvements/ajustement?piece=${p.id}`, { scroll: false }); }} showPrice="purchase" />
          {part ? (
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-slate-50 p-3">
              <PartThumb imagePath={part.imagePath} alt="" size="lg" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <Link href={`/pieces/${part.id}`} className="font-mono text-[14px] font-semibold hover:underline">
                    {part.reference}
                  </Link>
                  {part.brand ? <span className="text-[12.5px] text-ink-muted">{part.brand}</span> : null}
                  <StockBadge quantity={part.quantity} minStock={part.minStock} size="sm" />
                </p>
                <p className="text-[13px] text-ink-secondary">{part.designation}</p>
                <p className="mt-1 text-[12px] text-ink-muted">
                  {part.location ? `Rayon ${part.location} · ` : ""}Prix d&apos;achat <Money value={part.purchasePrice} className="text-ink" /> · min. {part.minStock}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wide text-ink-faint">Stock actuel</p>
                  <QuantityChip quantity={part.quantity} minStock={part.minStock} className="text-[15px]" />
                </div>
                <Button onClick={() => setOpen(true)}>
                  <SlidersHorizontal /> 2. Ajuster
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-ink-muted">Recherchez une pièce par référence, référence OEM, désignation ou marque pour commencer.</p>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Rappels" />
        <CardBody className="space-y-2 text-[13px] text-ink-secondary">
          <p><span className="font-medium text-ink">Ajouter / Retirer</span> : corrige le stock d&apos;une quantité donnée (casse, retour, erreur).</p>
          <p><span className="font-medium text-ink">Fixer à</span> : inventaire physique — vous saisissez la quantité comptée, l&apos;écart est calculé.</p>
          <p><span className="font-medium text-ink">Motif obligatoire</span> : il apparaît dans le journal et les rapports.</p>
          <p>Les ventes et les achats ne se saisissent pas ici : ils génèrent leurs propres mouvements à la confirmation / réception.</p>
        </CardBody>
      </Card>
      <Card className="lg:col-span-3">
        <CardHeader title="Derniers ajustements manuels" />
        <MovementsTable rows={recent} compact emptyTitle="Aucun ajustement manuel récent" />
      </Card>
      {part && open ? <AdjustStockDialog open onOpenChange={setOpen} part={part} onDone={() => router.refresh()} /> : null}
    </div>
  );
}
