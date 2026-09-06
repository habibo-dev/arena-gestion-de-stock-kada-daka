import Link from "next/link";
import type { MovementListItem } from "@/server/services/movements";
import { DocumentLink, MovementTypeBadge, SignedQuantity } from "./movement-badge";
import { formatDateTime } from "@/lib/format";
import { EmptyState } from "@/components/ui/states";
import { cn } from "@/lib/utils";

/** Server-renderable movements table (used on part detail, vehicle, and the journal). */
export function MovementsTable({ rows, showPart = true, compact, emptyTitle = "Aucun mouvement" }: { rows: MovementListItem[]; showPart?: boolean; compact?: boolean; emptyTitle?: string }) {
  if (rows.length === 0) return <EmptyState compact title={emptyTitle} description="Les entrées, sorties et ajustements apparaîtront ici." />;
  return (
    <>
      {/* Mobile cards */}
      <ul className="divide-y divide-line md:hidden">
        {rows.map((m) => (
          <li key={m.id} className="px-4 py-3 text-[13px]">
            <div className="flex items-center justify-between gap-2">
              <MovementTypeBadge type={m.type} size="sm" />
              <span className="font-mono text-ink-muted tabular">
                {m.previousQuantity} → <span className="font-semibold text-ink">{m.newQuantity}</span>
              </span>
            </div>
            {showPart ? (
              <Link href={`/pieces/${m.partId}`} className="mt-1 block truncate font-medium">
                <span className="font-mono">{m.reference}</span> · {m.designation}
              </Link>
            ) : null}
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-ink-muted">
              <span>{formatDateTime(m.createdAt)}</span>
              <span>
                Qté <SignedQuantity value={m.quantity} />
              </span>
              <DocumentLink documentType={m.documentType} documentId={m.documentId} documentNumber={m.documentNumber} />
              {m.userName ? <span>{m.userName}</span> : null}
            </div>
            {m.reason ? <p className="mt-1 text-[12px] text-ink-secondary">{m.reason}</p> : null}
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-line bg-slate-50/80 text-[11.5px] uppercase tracking-wide text-ink-muted">
              <th className="px-4 py-2 font-semibold">Date</th>
              {showPart ? <th className="px-3 py-2 font-semibold">Pièce</th> : null}
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 text-right font-semibold">Qté</th>
              <th className="px-3 py-2 text-right font-semibold">Avant → Après</th>
              <th className="px-3 py-2 font-semibold">Motif</th>
              <th className="px-3 py-2 font-semibold">Document</th>
              <th className="px-4 py-2 font-semibold">Utilisateur</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50/60">
                <td className={cn("whitespace-nowrap px-4 text-ink-secondary tabular", compact ? "py-1.5" : "py-2.5")}>{formatDateTime(m.createdAt)}</td>
                {showPart ? (
                  <td className={cn("max-w-[300px] px-3", compact ? "py-1.5" : "py-2.5")}>
                    <Link href={`/pieces/${m.partId}`} className="block truncate hover:underline">
                      <span className="font-mono font-medium">{m.reference}</span> <span className="text-ink-secondary">· {m.designation}</span>
                    </Link>
                  </td>
                ) : null}
                <td className={cn("px-3", compact ? "py-1.5" : "py-2.5")}>
                  <MovementTypeBadge type={m.type} size="sm" />
                  {m.type === "TRANSFERT" && (m.fromLocation || m.toLocation) ? (
                    <span className="ml-1.5 font-mono text-[11.5px] text-ink-muted">
                      {m.fromLocation ?? "—"} → {m.toLocation ?? "—"}
                    </span>
                  ) : null}
                </td>
                <td className={cn("px-3 text-right", compact ? "py-1.5" : "py-2.5")}>
                  <SignedQuantity value={m.quantity} />
                </td>
                <td className={cn("px-3 text-right font-mono text-ink-muted tabular", compact ? "py-1.5" : "py-2.5")}>
                  {m.previousQuantity} → <span className="font-semibold text-ink">{m.newQuantity}</span>
                </td>
                <td className={cn("max-w-[260px] truncate px-3 text-ink-secondary", compact ? "py-1.5" : "py-2.5")} title={m.reason ?? undefined}>
                  {m.reason ?? <span className="text-ink-faint">—</span>}
                </td>
                <td className={cn("px-3", compact ? "py-1.5" : "py-2.5")}>
                  <DocumentLink documentType={m.documentType} documentId={m.documentId} documentNumber={m.documentNumber} />
                </td>
                <td className={cn("px-4 text-ink-secondary", compact ? "py-1.5" : "py-2.5")}>{m.userName ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
