import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/session";
import { hasPermission } from "@/lib/permissions";
import { listImportBatches } from "@/server/services/excel-import";
import { formatDateTime, formatInteger } from "@/lib/format";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, InlineAlert } from "@/components/ui/states";
import { ImportWizard } from "@/components/import-export/import-wizard";
import { ExportPanel } from "@/components/import-export/export-panel";

export const metadata: Metadata = { title: "Import / Export" };

export default async function ImportExportPage() {
  const user = await requirePagePermission("export.run");
  const canImport = hasPermission(user.role, "import.run");
  const batches = canImport ? listImportBatches(15) : [];
  return (
    <>
      <PageHeader title="Import / Export" description="Reprise de votre fichier Excel existant et exports de sauvegarde. La base de données reste la seule source de vérité." />
      <div className="space-y-4">
        {canImport ? (
          <ImportWizard />
        ) : (
          <InlineAlert variant="info" title="Import réservé aux gérants et administrateurs">Vous pouvez exporter les données ci-dessous.</InlineAlert>
        )}
        <ExportPanel canExport={hasPermission(user.role, "export.run")} />
        {canImport ? (
          <Card>
            <CardHeader title="Historique des imports" description="Chaque import est tracé ; les mouvements de stock associés portent le numéro du lot." />
            {batches.length === 0 ? (
              <EmptyState compact title="Aucun import pour le moment" description="Votre premier import apparaîtra ici." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-[13px]">
                  <thead>
                    <tr className="border-b border-line bg-slate-50/80 text-left text-[11.5px] uppercase tracking-wide text-ink-muted">
                      <th className="px-4 py-2 font-semibold">Lot</th>
                      <th className="px-3 py-2 font-semibold">Date</th>
                      <th className="px-3 py-2 font-semibold">Fichier</th>
                      <th className="px-3 py-2 font-semibold">Feuille</th>
                      <th className="px-3 py-2 text-right font-semibold">Lignes</th>
                      <th className="px-3 py-2 text-right font-semibold">Créées</th>
                      <th className="px-3 py-2 text-right font-semibold">Mises à jour</th>
                      <th className="px-3 py-2 text-right font-semibold">Ignorées</th>
                      <th className="px-4 py-2 font-semibold">Par</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {batches.map((b) => (
                      <tr key={b.id}>
                        <td className="px-4 py-1.5 font-mono text-ink-secondary">#{b.id}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 tabular text-ink-secondary">{formatDateTime(b.createdAt)}</td>
                        <td className="max-w-[240px] truncate px-3 py-1.5 font-medium">{b.fileName}</td>
                        <td className="px-3 py-1.5 text-ink-secondary">{b.sheetName}</td>
                        <td className="px-3 py-1.5 text-right font-mono tabular">{formatInteger(b.totalRows)}</td>
                        <td className="px-3 py-1.5 text-right font-mono tabular text-success-700">{formatInteger(b.importedRows)}</td>
                        <td className="px-3 py-1.5 text-right font-mono tabular text-info-700">{formatInteger(b.updatedRows)}</td>
                        <td className="px-3 py-1.5 text-right font-mono tabular text-ink-muted">{formatInteger(b.skippedRows)}</td>
                        <td className="px-4 py-1.5 text-ink-secondary">{b.userName ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : null}
      </div>
    </>
  );
}
