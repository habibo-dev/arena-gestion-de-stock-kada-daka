"use client";

import * as React from "react";
import Link from "next/link";
import { BadgeCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/states";
import { removeCompatibilityAction, setCompatibilityAction } from "@/server/actions/parts";
import { useAction } from "@/hooks/use-action";
import { formatDate } from "@/lib/format";

export type ReviewRow = {
  partId: number;
  vehicleId: number;
  source: string | null;
  note: string | null;
  createdAt: string;
  reference: string;
  designation: string;
  brand: string | null;
  make: string;
  model: string;
  generation: string | null;
  engineLabel: string;
  engineCode: string | null;
};

const SOURCE_LABELS: Record<string, string> = { MANUAL: "Saisie manuelle", IMPORT: "Import Excel", CATALOG: "Catalogue", SEED: "Données de démonstration" };

export function CompatReviewList({ rows, canManage }: { rows: ReviewRow[]; canManage: boolean }) {
  const [removing, setRemoving] = React.useState<ReviewRow | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const verify = useAction(setCompatibilityAction, { success: "Compatibilité vérifiée." });
  const remove = useAction(removeCompatibilityAction, { success: "Compatibilité retirée.", onSuccess: () => setRemoving(null) });
  if (rows.length === 0) return <EmptyState compact title="Rien à vérifier" description="Toutes les compatibilités enregistrées sont vérifiées." />;
  return (
    <>
      <ul className="divide-y divide-line">
        {rows.map((r) => {
          const key = `${r.partId}-${r.vehicleId}`;
          return (
            <li key={key} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-[13px]">
              <div className="min-w-[220px] flex-1">
                <Link href={`/pieces/${r.partId}`} className="font-mono font-semibold text-brand-700 hover:underline">
                  {r.reference}
                </Link>
                <span className="ml-1.5 text-ink-secondary">{r.designation}</span>
                {r.brand ? <span className="ml-1.5 text-[11.5px] text-ink-muted">{r.brand}</span> : null}
              </div>
              <div className="min-w-[200px] flex-1">
                <Link href={`/vehicules/${r.vehicleId}`} className="font-medium hover:underline">
                  {[r.make, r.model, r.generation].filter(Boolean).join(" ")} <span className="text-ink-secondary">{r.engineLabel}</span>
                </Link>
                <p className="text-[11.5px] text-ink-muted">
                  {[r.engineCode, r.source ? SOURCE_LABELS[r.source] ?? r.source : null, formatDate(r.createdAt), r.note].filter(Boolean).join(" · ")}
                </p>
              </div>
              {canManage ? (
                <div className="flex items-center gap-1">
                  <Button
                    size="xs"
                    variant="success"
                    loading={busy === key && verify.pending}
                    onClick={async () => {
                      setBusy(key);
                      await verify.run({ partId: r.partId, vehicleId: r.vehicleId, status: "VERIFIED", note: r.note });
                      setBusy(null);
                    }}
                  >
                    <BadgeCheck /> Vérifier
                  </Button>
                  <Button size="icon-xs" variant="ghost" aria-label="Retirer" onClick={() => setRemoving(r)}>
                    <Trash2 />
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Retirer cette compatibilité ?"
        description={removing ? `${removing.reference} ne sera plus proposée pour ${removing.make} ${removing.model} ${removing.engineLabel}.` : undefined}
        confirmLabel="Retirer"
        variant="danger"
        loading={remove.pending}
        onConfirm={() => removing && remove.run(removing.partId, removing.vehicleId)}
      />
    </>
  );
}
