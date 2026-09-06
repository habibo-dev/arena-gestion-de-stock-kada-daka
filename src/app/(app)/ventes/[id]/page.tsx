import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/server/auth/session";
import { hasPermission } from "@/lib/permissions";
import { getSale } from "@/server/services/sales";
import { listMovements } from "@/server/services/movements";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { PageHeader, Money, PartThumb } from "@/components/ui/misc";
import { Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/card";
import { InlineAlert } from "@/components/ui/states";
import { SaleActions } from "@/components/sales/sale-actions";
import { PaymentBadge, SaleStatusBadge, TierBadge } from "@/components/sales/status-badges";
import { MovementsTable } from "@/components/movements/movements-table";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const sale = getSale(Number(id));
  return { title: sale ? `Vente ${sale.number}` : "Vente introuvable" };
}

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("sales.view");
  const { id } = await params;
  const saleId = Number(id);
  if (!Number.isInteger(saleId)) notFound();
  const sale = getSale(saleId);
  if (!sale) notFound();
  const movements = sale.status === "BROUILLON" ? [] : listMovements({ q: sale.number, pageSize: 100 }).items.filter((m) => m.documentType === "SALE" && m.documentId === sale.id);
  const lineCount = sale.items.reduce((acc, i) => acc + i.quantity, 0);
  const margin = sale.items.reduce((acc, i) => acc + (i.unitPrice - i.unitCost) * i.quantity, 0) - sale.discountAmount;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Ventes", href: "/ventes" }, { label: sale.number }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{sale.number}</span>
            <SaleStatusBadge status={sale.status} size="lg" />
          </span>
        }
        description={`${formatDateTime(sale.saleDate)} · ${sale.user?.fullName ?? "—"}`}
        actions={<SaleActions sale={{ id: sale.id, number: sale.number, status: sale.status }} can={{ confirm: hasPermission(user.role, "sales.confirm"), cancel: hasPermission(user.role, "sales.cancel"), edit: hasPermission(user.role, "sales.create") }} />}
      />

      {sale.status === "BROUILLON" ? <InlineAlert variant="warning" className="mb-4" title="Brouillon : le stock n'a pas encore été déduit.">Confirmez la vente pour enregistrer les sorties de stock, ou modifiez-la tant qu'elle est en brouillon.</InlineAlert> : null}
      {sale.status === "ANNULEE" ? <InlineAlert variant="danger" className="mb-4" title={`Vente annulée le ${sale.cancelledAt ? formatDateTime(sale.cancelledAt) : "—"}.`}>{sale.confirmedAt ? "Les quantités ont été remises en stock (mouvements « Retour client »)." : "Ce brouillon a été annulé sans impact sur le stock."}</InlineAlert> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Pièces vendues" description={`${sale.items.length} ligne${sale.items.length > 1 ? "s" : ""} · ${lineCount} article${lineCount > 1 ? "s" : ""}`} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-slate-50/80 text-[11.5px] uppercase tracking-wide text-ink-muted">
                    <th className="px-4 py-2 font-semibold">Pièce</th>
                    <th className="px-3 py-2 text-right font-semibold">Qté</th>
                    <th className="px-3 py-2 text-right font-semibold">Prix unitaire</th>
                    <th className="px-4 py-2 text-right font-semibold">Total ligne</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sale.items.map((it) => (
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
                        <Money value={it.unitPrice} />
                      </td>
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
                <div className="flex justify-between">
                  <dt className="text-ink-secondary">Sous-total</dt>
                  <dd className="tabular">
                    <Money value={sale.subtotal} />
                  </dd>
                </div>
                {sale.discountType !== "NONE" ? (
                  <div className="flex justify-between">
                    <dt className="text-ink-secondary">
                      Remise{sale.discountType === "PERCENT" ? ` (${sale.discountValue} %)` : ""}
                    </dt>
                    <dd className="tabular text-danger-700">− {formatCurrency(sale.discountAmount)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-line pt-1.5 text-[15px] font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular">
                    <Money value={sale.total} />
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          {sale.status !== "BROUILLON" ? (
            <Card>
              <CardHeader title="Mouvements de stock liés" description="Chaque ligne confirmée génère une sortie ; une annulation génère un retour client." />
              <MovementsTable rows={movements} compact />
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Client" />
            <CardBody>
              <DescriptionList
                items={[
                  { label: "Nom", value: sale.customerName ?? <span className="text-ink-faint">Client de passage</span> },
                  { label: "Téléphone", value: sale.customerPhone ?? "—" },
                  { label: "Type", value: sale.customer ? (sale.customer.customerType === "PROFESSIONNEL" ? "Professionnel" : "Particulier") : "—" },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Conditions" />
            <CardBody>
              <DescriptionList
                items={[
                  { label: "Tarif appliqué", value: <TierBadge tier={sale.priceTier} /> },
                  { label: "Paiement", value: <PaymentBadge method={sale.paymentMethod} /> },
                  { label: "Vendeur", value: sale.user?.fullName ?? "—" },
                  { label: "Créée le", value: formatDateTime(sale.createdAt) },
                  { label: "Confirmée le", value: sale.confirmedAt ? formatDateTime(sale.confirmedAt) : "—" },
                  ...(hasPermission(user.role, "reports.view") ? [{ label: "Marge estimée", value: <span className={margin >= 0 ? "text-success-700" : "text-danger-700"}>{formatCurrency(margin)}</span> }] : []),
                ]}
              />
            </CardBody>
          </Card>
          {sale.notes ? (
            <Card>
              <CardHeader title="Notes" />
              <CardBody>
                <p className="whitespace-pre-wrap text-[13px] text-ink-secondary">{sale.notes}</p>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
