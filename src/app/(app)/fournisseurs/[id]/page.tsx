import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Coins, Package, ShoppingBag, Truck } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { hasPermission } from "@/lib/permissions";
import { getSupplier } from "@/server/services/suppliers";
import { formatCurrency, formatDate, formatDateTime, formatInteger } from "@/lib/format";
import { PageHeader, StatsCard, Money } from "@/components/ui/misc";
import { Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { StockBadge } from "@/components/ui/stock-badge";
import { buttonVariants } from "@/components/ui/button";
import { SupplierHeaderActions } from "@/components/suppliers/supplier-dialog";
import { PurchaseStatusBadge } from "@/components/sales/status-badges";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const s = getSupplier(Number(id));
  return { title: s ? s.name : "Fournisseur introuvable" };
}

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("suppliers.view");
  const { id } = await params;
  const supplierId = Number(id);
  if (!Number.isInteger(supplierId)) notFound();
  const supplier = getSupplier(supplierId);
  if (!supplier) notFound();
  const lowParts = supplier.parts.filter((p) => p.isActive && p.status !== "DISPONIBLE");
  const canBuy = hasPermission(user.role, "purchases.create");

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Fournisseurs", href: "/fournisseurs" }, { label: supplier.name }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {supplier.name}
            {!supplier.isActive ? <Badge variant="neutral" size="lg">Inactif</Badge> : null}
          </span>
        }
        description={[supplier.contactName, supplier.city].filter(Boolean).join(" · ") || "Fiche fournisseur"}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canBuy && supplier.isActive ? (
              <Link href={`/achats/nouveau?fournisseur=${supplier.id}`} className={buttonVariants({ variant: "secondary" })}>
                <ShoppingBag /> Nouvel achat
              </Link>
            ) : null}
            <SupplierHeaderActions supplier={{ id: supplier.id, name: supplier.name, contactName: supplier.contactName, phone: supplier.phone, email: supplier.email, address: supplier.address, city: supplier.city, notes: supplier.notes, isActive: supplier.isActive }} canManage={hasPermission(user.role, "suppliers.manage")} />
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Pièces fournies" value={formatInteger(supplier.parts.filter((p) => p.isActive).length)} hint={lowParts.length ? `${lowParts.length} à réapprovisionner` : "toutes disponibles"} icon={Package} tone={lowParts.length ? "warning" : "neutral"} />
        <StatsCard label="Achats" value={formatInteger(supplier.stats.purchaseCount)} hint="hors annulés" icon={Truck} tone="brand" />
        <StatsCard label="Total reçu (12 mois)" value={formatCurrency(supplier.stats.received12m, { compact: true })} hint={`cumul : ${formatCurrency(supplier.stats.receivedTotal, { compact: true })}`} icon={Coins} tone="success" />
        <StatsCard label="En commande" value={formatCurrency(supplier.stats.pendingTotal, { compact: true })} hint="commandes non réceptionnées" icon={ShoppingBag} tone={supplier.stats.pendingTotal > 0 ? "info" : "neutral"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="Pièces fournies"
              description="Pièces dont ce fournisseur est le fournisseur principal."
              actions={
                lowParts.length && canBuy && supplier.isActive ? (
                  <Link href={`/achats/nouveau?fournisseur=${supplier.id}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                    Commander les {lowParts.length} pièce{lowParts.length > 1 ? "s" : ""} en alerte
                  </Link>
                ) : null
              }
            />
            {supplier.parts.length === 0 ? (
              <EmptyState compact title="Aucune pièce rattachée" description="Renseignez ce fournisseur dans les fiches pièces pour le retrouver ici." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-line bg-slate-50/80 text-[11.5px] uppercase tracking-wide text-ink-muted">
                      <th className="px-4 py-2 font-semibold">Référence</th>
                      <th className="px-3 py-2 font-semibold">Désignation</th>
                      <th className="px-3 py-2 font-semibold">Marque</th>
                      <th className="px-3 py-2 text-right font-semibold">Prix d&apos;achat</th>
                      <th className="px-3 py-2 font-semibold">Rayon</th>
                      <th className="px-4 py-2 text-right font-semibold">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {supplier.parts.map((p) => (
                      <tr key={p.id} className={p.isActive ? "" : "opacity-60"}>
                        <td className="px-4 py-2">
                          <Link href={`/pieces/${p.id}`} className="font-mono font-semibold text-brand-700 hover:underline">
                            {p.reference}
                          </Link>
                          {!p.isActive ? (
                            <Badge variant="neutral" size="sm" className="ml-2">
                              Archivée
                            </Badge>
                          ) : null}
                        </td>
                        <td className="max-w-[260px] truncate px-3 py-2">{p.designation}</td>
                        <td className="px-3 py-2 text-ink-secondary">{p.brand ?? "—"}</td>
                        <td className="px-3 py-2 text-right tabular">
                          <Money value={p.purchasePrice} />
                        </td>
                        <td className="px-3 py-2 font-mono text-ink-secondary">{p.location ?? "—"}</td>
                        <td className="px-4 py-2 text-right">
                          <StockBadge quantity={p.quantity} minStock={p.minStock} size="sm" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Historique des achats"
              description="50 derniers achats."
              actions={
                <Link href={`/achats?fournisseur=${supplier.id}`} className="text-[12.5px] font-medium text-brand-700 hover:underline">
                  Voir tous les achats
                </Link>
              }
            />
            {supplier.purchases.length === 0 ? (
              <EmptyState compact title="Aucun achat" description="Les commandes passées à ce fournisseur apparaîtront ici." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-line bg-slate-50/80 text-[11.5px] uppercase tracking-wide text-ink-muted">
                      <th className="px-4 py-2 font-semibold">N°</th>
                      <th className="px-3 py-2 font-semibold">Date</th>
                      <th className="px-3 py-2 font-semibold">Statut</th>
                      <th className="px-3 py-2 text-right font-semibold">Articles</th>
                      <th className="px-3 py-2 font-semibold">Reçu le</th>
                      <th className="px-4 py-2 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {supplier.purchases.map((p) => (
                      <tr key={p.id} className="relative hover:bg-brand-50/40">
                        <td className="px-4 py-2">
                          <Link href={`/achats/${p.id}`} className="font-mono font-semibold text-ink after:absolute after:inset-0">
                            {p.number}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-ink-secondary tabular">{formatDateTime(p.purchaseDate)}</td>
                        <td className="px-3 py-2">
                          <PurchaseStatusBadge status={p.status} size="sm" />
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular">{p.itemCount}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-ink-secondary tabular">{p.receivedAt ? formatDate(p.receivedAt) : "—"}</td>
                        <td className="px-4 py-2 text-right font-medium">
                          <Money value={p.total} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Coordonnées" />
            <CardBody>
              <DescriptionList
                columns={1}
                items={[
                  { label: "Contact", value: supplier.contactName ?? "—" },
                  { label: "Téléphone", value: supplier.phone ? <a href={`tel:${supplier.phone}`} className="text-brand-700 hover:underline">{supplier.phone}</a> : "—" },
                  { label: "E-mail", value: supplier.email ? <a href={`mailto:${supplier.email}`} className="text-brand-700 hover:underline">{supplier.email}</a> : "—" },
                  { label: "Adresse", value: [supplier.address, supplier.city].filter(Boolean).join(", ") || "—" },
                  { label: "Créé le", value: formatDate(supplier.createdAt) },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Notes" />
            <CardBody>{supplier.notes ? <p className="whitespace-pre-wrap text-[13px] text-ink-secondary">{supplier.notes}</p> : <p className="text-[13px] text-ink-faint">Aucune note.</p>}</CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
