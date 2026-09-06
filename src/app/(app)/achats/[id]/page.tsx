import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/server/auth/session";
import { hasPermission } from "@/lib/permissions";
import { getPurchase } from "@/server/services/purchases";
import { listMovements } from "@/server/services/movements";
import { formatDate, formatDateTime } from "@/lib/format";
import { PageHeader, Money, PartThumb } from "@/components/ui/misc";
import { Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/card";
import { InlineAlert } from "@/components/ui/states";
import { PurchaseActions } from "@/components/purchases/purchase-actions";
import { PurchaseStatusBadge } from "@/components/sales/status-badges";
import { MovementsTable } from "@/components/movements/movements-table";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const purchase = getPurchase(Number(id));
  return { title: purchase ? `Achat ${purchase.number}` : "Achat introuvable" };
}

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("purchases.view");
  const { id } = await params;
  const purchaseId = Number(id);
  if (!Number.isInteger(purchaseId)) notFound();
  const purchase = getPurchase(purchaseId);
  if (!purchase) notFound();
  const movements = purchase.receivedAt ? listMovements({ q: purchase.number, pageSize: 100 }).items.filter((m) => m.documentType === "PURCHASE" && m.documentId === purchase.id) : [];
  const units = purchase.items.reduce((acc, i) => acc + i.quantity, 0);

  const steps: { key: string; label: string; date: string | null }[] = [
    { key: "BROUILLON", label: "Brouillon", date: purchase.createdAt },
    { key: "COMMANDEE", label: "Commandée", date: purchase.orderedAt },
    { key: "RECUE", label: "Reçue", date: purchase.receivedAt },
  ];
  const reached = purchase.status === "ANNULEE" ? (purchase.receivedAt ? 3 : purchase.orderedAt ? 2 : 1) : purchase.status === "RECUE" ? 3 : purchase.status === "COMMANDEE" ? 2 : 1;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Achats", href: "/achats" }, { label: purchase.number }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{purchase.number}</span>
            <PurchaseStatusBadge status={purchase.status} size="lg" />
          </span>
        }
        description={`${formatDateTime(purchase.purchaseDate)} · ${purchase.supplier?.name ?? "—"}`}
        actions={
          <PurchaseActions
            purchase={{ id: purchase.id, number: purchase.number, status: purchase.status, lineCount: purchase.items.length, units }}
            can={{ create: hasPermission(user.role, "purchases.create"), receive: hasPermission(user.role, "purchases.receive"), cancel: hasPermission(user.role, "purchases.cancel") }}
          />
        }
      />

      {purchase.status === "ANNULEE" ? (
        <InlineAlert variant="danger" className="mb-4" title={`Achat annulé le ${purchase.cancelledAt ? formatDateTime(purchase.cancelledAt) : "—"}.`}>
          {purchase.receivedAt ? "Les quantités réceptionnées ont été retirées du stock (mouvements « Retour fournisseur »)." : "Aucun impact sur le stock : l'achat n'avait pas été réceptionné."}
        </InlineAlert>
      ) : (
        <ol className="mb-4 grid grid-cols-3 gap-2">
          {steps.map((s, i) => {
            const done = i < reached;
            const current = i === reached - 1;
            return (
              <li key={s.key} className={`rounded-lg border px-3 py-2 text-[12.5px] ${done ? (current ? "border-brand-200 bg-brand-50 text-brand-800" : "border-success-100 bg-success-50 text-success-700") : "border-line bg-white text-ink-muted"}`}>
                <p className="font-semibold">
                  {i + 1}. {s.label}
                </p>
                <p className="text-[11.5px] opacity-80">{done && s.date ? formatDateTime(s.date) : "—"}</p>
              </li>
            );
          })}
        </ol>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Pièces" description={`${purchase.items.length} ligne${purchase.items.length > 1 ? "s" : ""} · ${units} article${units > 1 ? "s" : ""}`} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-slate-50/80 text-[11.5px] uppercase tracking-wide text-ink-muted">
                    <th className="px-4 py-2 font-semibold">Pièce</th>
                    <th className="px-3 py-2 text-right font-semibold">Qté</th>
                    <th className="px-3 py-2 text-right font-semibold">Prix d&apos;achat</th>
                    <th className="px-3 py-2 text-right font-semibold">Stock actuel</th>
                    <th className="px-4 py-2 text-right font-semibold">Total ligne</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {purchase.items.map((it) => (
                    <tr key={it.id}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <PartThumb imagePath={it.part?.imagePath} alt="" size="sm" />
                          <div className="min-w-0">
                            <Link href={`/pieces/${it.partId}`} className="font-mono text-[12.5px] font-semibold text-brand-700 hover:underline">
                              {it.reference}
                            </Link>
                            <p className="truncate text-ink-secondary">{it.designation}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular">
                        {it.quantity} <span className="text-[11px] text-ink-faint">{it.part?.unit ?? ""}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular">
                        <Money value={it.unitCost} />
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular text-ink-secondary">{it.part?.quantity ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right font-medium tabular">
                        <Money value={it.lineTotal} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CardBody className="border-t border-line bg-slate-50/50">
              <dl className="ml-auto grid max-w-xs gap-1.5 text-[13px]">
                <div className="flex justify-between text-[15px] font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular">
                    <Money value={purchase.total} />
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          {purchase.receivedAt ? (
            <Card>
              <CardHeader title="Mouvements de stock liés" description="La réception génère une entrée par ligne ; une annulation après réception génère un retour fournisseur." />
              <MovementsTable rows={movements} compact />
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Fournisseur" />
            <CardBody>
              <DescriptionList
                columns={1}
                items={[
                  {
                    label: "Nom",
                    value: purchase.supplier ? (
                      <Link href={`/fournisseurs/${purchase.supplier.id}`} className="font-medium text-brand-700 hover:underline">
                        {purchase.supplier.name}
                      </Link>
                    ) : (
                      "—"
                    ),
                  },
                  { label: "Contact", value: purchase.supplier?.contactName ?? "—" },
                  { label: "Téléphone", value: purchase.supplier?.phone ?? "—" },
                  { label: "N° facture / BL", value: purchase.supplierInvoiceNumber ?? "—", mono: true },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Suivi" />
            <CardBody>
              <DescriptionList
                columns={1}
                items={[
                  { label: "Saisi par", value: purchase.user?.fullName ?? "—" },
                  { label: "Créé le", value: formatDateTime(purchase.createdAt) },
                  { label: "Commandé le", value: purchase.orderedAt ? formatDateTime(purchase.orderedAt) : "—" },
                  { label: "Livraison prévue", value: purchase.expectedAt ? formatDate(purchase.expectedAt) : "—" },
                  { label: "Reçu le", value: purchase.receivedAt ? formatDateTime(purchase.receivedAt) : "—" },
                ]}
              />
            </CardBody>
          </Card>
          {purchase.notes ? (
            <Card>
              <CardHeader title="Notes" />
              <CardBody>
                <p className="whitespace-pre-wrap text-[13px] text-ink-secondary">{purchase.notes}</p>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
