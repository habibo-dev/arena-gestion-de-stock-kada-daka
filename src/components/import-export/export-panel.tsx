"use client";

import * as React from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { DateRangeFilter } from "@/components/ui/filter-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ExportDef = { kind: string; label: string; description: string; dated?: boolean; permission: "export" | "reports" };

const EXPORTS: ExportDef[] = [
  { kind: "stock", label: "Stock complet", description: "Toutes les références actives : quantités, prix d'achat / gros / détail, UM, rayon, références OEM et alternatives.", permission: "export" },
  { kind: "stock-faible", label: "Stock faible", description: "Pièces dont la quantité est inférieure ou égale au stock minimum.", permission: "export" },
  { kind: "ruptures", label: "Ruptures", description: "Pièces à quantité nulle, avec dernier fournisseur et prix d'achat.", permission: "export" },
  { kind: "valeur-stock", label: "Valeur du stock", description: "Valorisation par catégorie aux prix d'achat, gros et détail.", permission: "export" },
  { kind: "ventes", label: "Ventes", description: "Ventes confirmées de la période avec lignes, remises, marge et vendeur.", dated: true, permission: "export" },
  { kind: "achats", label: "Achats", description: "Commandes fournisseurs de la période, statut, réception et montants.", dated: true, permission: "export" },
  { kind: "mouvements", label: "Mouvements de stock", description: "Journal complet des entrées, sorties, ajustements et retours de la période.", dated: true, permission: "export" },
  { kind: "fournisseurs", label: "Fournisseurs", description: "Coordonnées, nombre de pièces fournies et volume d'achats.", permission: "export" },
  { kind: "top-ventes", label: "Top ventes", description: "Classement des pièces les plus vendues sur la période.", dated: true, permission: "export" },
  { kind: "rotation", label: "Rotation du stock", description: "Ventes, rythme journalier, couverture et classe de rotation par référence.", dated: true, permission: "export" },
];

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ExportPanel({ canExport }: { canExport: boolean }) {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const [from, setFrom] = React.useState(iso(monthStart));
  const [to, setTo] = React.useState(iso(today));
  const [busy, setBusy] = React.useState<string | null>(null);

  const download = (def: ExportDef) => {
    const url = `/api/export?kind=${def.kind}${def.dated ? `&from=${from}&to=${to}` : ""}`;
    setBusy(def.kind);
    // Plain navigation keeps the browser's native download UX; state resets shortly after.
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => setBusy(null), 1500);
  };

  return (
    <Card>
      <CardHeader title="Exporter vers Excel" description="Fichiers .xlsx avec en-têtes en français, prêts pour votre comptable ou une sauvegarde." />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-slate-50/60 px-3 py-2">
          <span className="text-[12.5px] font-medium text-ink-secondary">Période pour les exports datés :</span>
          <DateRangeFilter
            from={from}
            to={to}
            onChange={(r) => {
              setFrom(r.from);
              setTo(r.to);
            }}
          />
        </div>
        {!canExport ? <p className="text-[12.5px] text-ink-muted">Votre rôle ne permet pas d&apos;exporter des données.</p> : null}
        <ul className="grid gap-2 sm:grid-cols-2">
          {EXPORTS.map((e) => (
            <li key={e.kind} className="flex items-start gap-3 rounded-lg border border-line p-3">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-success-50 text-success-700">
                <FileSpreadsheet className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold">
                  {e.label}
                  {e.dated ? <span className="ml-1.5 text-[11px] font-normal text-ink-muted">période</span> : null}
                </p>
                <p className="text-[12px] text-ink-muted">{e.description}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => download(e)} disabled={!canExport} loading={busy === e.kind}>
                <Download /> .xlsx
              </Button>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
