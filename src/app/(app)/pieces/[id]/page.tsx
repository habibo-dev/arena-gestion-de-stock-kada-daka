import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Barcode, Boxes, Coins, ShoppingCart, Truck } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { hasPermission } from "@/lib/permissions";
import { getPartDetail, listLocations } from "@/server/services/parts";
import { listMovements } from "@/server/services/movements";
import { formatCurrency, formatDate, formatDateTime, formatInteger } from "@/lib/format";
import { REFERENCE_TYPE_LABELS } from "@/lib/stock";
import { PageHeader, Money, StatsCard } from "@/components/ui/misc";
import { Card, CardHeader, DescriptionList } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StockBadge } from "@/components/ui/stock-badge";
import { buttonVariants } from "@/components/ui/button";
import { PartHeaderActions, PartImagePanel } from "@/components/parts/part-detail-actions";
import { CompatibilityEditor } from "@/components/parts/compatibility-editor";
import { MovementsTable } from "@/components/movements/movements-table";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const part = getPartDetail(Number(id));
  return { title: part ? `${part.reference} · ${part.designation}` : "Pièce" };
}

export default async function PartDetailPage({ params }: Props) {
  const user = await requirePagePermission("parts.view");
  const { id } = await params;
  const partId = Number(id);
  if (!Number.isInteger(partId)) notFound();
  const part = getPartDetail(partId);
  if (!part) notFound();

  const movements = listMovements({ partId, pageSize: 15 });
  const locations = listLocations();
  const can = {
    update: hasPermission(user.role, "parts.update"),
    archive: hasPermission(user.role, "parts.archive"),
    delete: hasPermission(user.role, "parts.delete"),
    adjust: hasPermission(user.role, "stock.adjust"),
    transfer: hasPermission(user.role, "stock.transfer"),
    create: hasPermission(user.role, "parts.create"),
    compat: hasPermission(user.role, "compatibility.manage"),
    sell: hasPermission(user.role, "sales.create"),
    buy: hasPermission(user.role, "purchases.create"),
  };
  const marginRetail = part.purchasePrice > 0 ? ((part.retailPrice - part.purchasePrice) / part.purchasePrice) * 100 : null;
  const marginWholesale = part.purchasePrice > 0 ? ((part.wholesalePrice - part.purchasePrice) / part.purchasePrice) * 100 : null;
  const refsByType = new Map<string, string[]>();
  for (const r of part.references) refsByType.set(r.type, [...(refsByType.get(r.type) ?? []), r.reference]);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Pièces", href: "/pieces" }, { label: part.reference }]}
        title={<span className="font-mono">{part.reference}</span>}
        badge={
          <span className="flex items-center gap-1.5">
            <StockBadge status={part.status} />
            {!part.isActive ? <Badge variant="dark">Archivée</Badge> : null}
          </span>
        }
        description={part.designation}
        actions={<PartHeaderActions part={{ id: part.id, reference: part.reference, designation: part.designation, quantity: part.quantity, unit: part.unit, isActive: part.isActive, imagePath: part.imagePath, locationId: part.locationId, location: part.location?.code ?? null }} locations={locations} can={can} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Quantité en stock" value={`${formatInteger(part.quantity)} ${part.unit}`} hint={part.minStock > 0 ? `seuil d'alerte : ${part.minStock}` : "aucun seuil d'alerte"} icon={Boxes} tone={part.status === "RUPTURE" ? "danger" : part.status === "FAIBLE" ? "warning" : "success"} />
        <StatsCard label="Valeur en stock (achat)" value={formatCurrency(part.quantity * part.purchasePrice, { compact: true })} hint={`${formatCurrency(part.quantity * part.retailPrice, { compact: true })} au prix détail`} icon={Coins} />
        <StatsCard label="Vendues (90 jours)" value={formatInteger(part.stats.sold90)} hint={part.stats.lastSaleAt ? `dernière vente ${formatDate(part.stats.lastSaleAt)}` : "aucune vente enregistrée"} icon={ShoppingCart} tone="brand" />
        <StatsCard label="Dernier achat" value={part.stats.lastPurchaseCost !== null ? formatCurrency(part.stats.lastPurchaseCost) : "—"} hint={part.stats.lastPurchaseAt ? `reçu le ${formatDate(part.stats.lastPurchaseAt)}` : "aucune réception"} icon={Truck} tone="info" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title="Fiche" />
            <div className="grid gap-5 p-5 sm:grid-cols-[200px_1fr]">
              <PartImagePanel partId={part.id} imagePath={part.imagePath} alt={part.designation} canEdit={can.update} />
              <DescriptionList
                columns={2}
                items={[
                  { label: "Désignation", value: part.designation, span: true },
                  { label: "Marque", value: part.brand?.name },
                  { label: "Catégorie", value: part.category?.name },
                  { label: "Rayon", value: part.location ? <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">{part.location.code}</span> : null },
                  { label: "UM", value: part.unit },
                  { label: "Fournisseur habituel", value: part.supplier ? <Link href={`/fournisseurs/${part.supplier.id}`} className="text-brand-700 hover:underline">{part.supplier.name}</Link> : null },
                  { label: "Code-barres", value: part.barcode ? <span className="inline-flex items-center gap-1.5 font-mono"><Barcode className="size-3.5 text-ink-muted" />{part.barcode}</span> : null },
                  { label: "Description", value: part.description ? <span className="whitespace-pre-line">{part.description}</span> : null, span: true },
                  { label: "Mots-clés", value: part.keywords },
                  { label: "Notes internes", value: part.notes ? <span className="whitespace-pre-line">{part.notes}</span> : null, span: true },
                  { label: "Créée le", value: formatDateTime(part.createdAt) },
                  { label: "Modifiée le", value: formatDateTime(part.updatedAt) },
                ]}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Références" description={part.referenceRaw && part.referenceRaw !== part.reference ? <>Valeur d'origine du fichier importé : <span className="font-mono">{part.referenceRaw}</span></> : "Référence principale et références équivalentes, toutes recherchables"} />
            <div className="divide-y divide-line">
              <div className="flex items-center gap-3 px-5 py-2.5 text-[13px]">
                <span className="w-48 shrink-0 text-ink-muted">Référence principale</span>
                <span className="font-mono font-semibold">{part.reference}</span>
              </div>
              {[...refsByType.entries()].map(([type, refs]) => (
                <div key={type} className="flex items-start gap-3 px-5 py-2.5 text-[13px]">
                  <span className="w-48 shrink-0 text-ink-muted">{REFERENCE_TYPE_LABELS[type as keyof typeof REFERENCE_TYPE_LABELS] ?? type}</span>
                  <span className="flex flex-wrap gap-1.5">
                    {refs.map((r) => (
                      <Link key={r} href={`/recherche?q=${encodeURIComponent(r)}`} className="rounded-md border border-line bg-slate-50 px-1.5 py-0.5 font-mono text-[12.5px] hover:border-brand-300 hover:bg-brand-50" title="Rechercher cette référence">
                        {r}
                      </Link>
                    ))}
                  </span>
                </div>
              ))}
              {refsByType.size === 0 ? <p className="px-5 py-3 text-[13px] text-ink-muted">Aucune référence OEM ou alternative enregistrée.</p> : null}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Derniers mouvements de stock"
              actions={
                <Link href={`/mouvements?piece=${part.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  Historique complet <ArrowRight />
                </Link>
              }
            />
            <MovementsTable rows={movements.items} showPart={false} compact />
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Prix" />
            <div className="divide-y divide-line text-[13px]">
              <div className="flex items-center justify-between px-5 py-2.5">
                <span className="text-ink-muted">Prix d'achat</span>
                <Money value={part.purchasePrice} />
              </div>
              <div className="flex items-center justify-between px-5 py-2.5">
                <span className="text-ink-muted">
                  Prix gros {marginWholesale !== null ? <span className="ml-1 text-[11px] text-ink-faint">({marginWholesale >= 0 ? "+" : ""}{marginWholesale.toFixed(0)} %)</span> : null}
                </span>
                <Money value={part.wholesalePrice} />
              </div>
              <div className="flex items-center justify-between px-5 py-2.5">
                <span className="text-ink-muted">
                  Prix détail {marginRetail !== null ? <span className="ml-1 text-[11px] text-ink-faint">({marginRetail >= 0 ? "+" : ""}{marginRetail.toFixed(0)} %)</span> : null}
                </span>
                <Money value={part.retailPrice} className="font-semibold" />
              </div>
            </div>
            {can.sell || can.buy ? (
              <div className="flex gap-2 border-t border-line bg-slate-50/60 px-5 py-3">
                {can.sell ? (
                  <Link href={`/ventes/nouvelle?piece=${part.id}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                    <ShoppingCart /> Vendre
                  </Link>
                ) : null}
                {can.buy ? (
                  <Link href={`/achats/nouveau?piece=${part.id}${part.supplier ? `&fournisseur=${part.supplier.id}` : ""}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                    <Truck /> Commander
                  </Link>
                ) : null}
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Véhicules compatibles" description={`${part.compatibleVehicles.length} motorisation${part.compatibleVehicles.length > 1 ? "s" : ""} · ${part.compatibleVehicles.filter((c) => c.status === "VERIFIED").length} vérifiée${part.compatibleVehicles.filter((c) => c.status === "VERIFIED").length > 1 ? "s" : ""}`} />
            <CompatibilityEditor partId={part.id} rows={part.compatibleVehicles} canManage={can.compat} />
          </Card>
        </div>
      </div>
    </>
  );
}
