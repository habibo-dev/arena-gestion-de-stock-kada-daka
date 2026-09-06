import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Boxes, CircleAlert, Coins, Layers, PackagePlus, ShoppingCart, TriangleAlert, Truck, Camera, Search, ArrowLeftRight } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { getDashboardData } from "@/server/services/dashboard";
import { hasPermission } from "@/lib/permissions";
import { formatAmount, formatCurrency, formatDateLong, formatInteger, formatRelative } from "@/lib/format";
import { PageHeader, StatsCard, Money } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { buttonVariants } from "@/components/ui/button";
import { QuantityChip } from "@/components/ui/stock-badge";
import { CategoryDonut, SalesAreaChart, StockLineChart, TopPartsBarChart } from "@/components/dashboard/charts";
import { DocumentLink, MovementTypeBadge, SignedQuantity } from "@/components/movements/movement-badge";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function DashboardPage() {
  const user = await requirePagePermission("dashboard.view");
  const data = getDashboardData();
  const { kpis } = data;
  const salesDelta = kpis.salesYesterday.total > 0 ? ((kpis.salesToday.total - kpis.salesYesterday.total) / kpis.salesYesterday.total) * 100 : undefined;
  const sales30 = data.salesSeries.reduce((s, d) => s + d.total, 0);
  const margin30 = data.salesSeries.reduce((s, d) => s + d.margin, 0);

  const quick = [
    hasPermission(user.role, "sales.create") && { label: "Nouvelle vente", href: "/ventes/nouvelle", icon: ShoppingCart, desc: "Sortie de stock à la confirmation" },
    hasPermission(user.role, "purchases.create") && { label: "Nouvel achat", href: "/achats/nouveau", icon: Truck, desc: "Entrée de stock à la réception" },
    hasPermission(user.role, "parts.create") && { label: "Ajouter une pièce", href: "/pieces/nouvelle", icon: PackagePlus, desc: "Référence, prix, rayon, OEM" },
    hasPermission(user.role, "stock.adjust") && { label: "Ajuster le stock", href: "/mouvements/ajustement", icon: ArrowLeftRight, desc: "Inventaire, casse, retour" },
    { label: "Recherche intelligente", href: "/recherche", icon: Search, desc: "« plaquette clio 4 1.5 dci »" },
    { label: "Recherche par image", href: "/recherche-image", icon: Camera, desc: "Photo d’étiquette ou de pièce" },
  ].filter(Boolean) as { label: string; href: string; icon: typeof ShoppingCart; desc: string }[];

  return (
    <>
      <PageHeader title={`Bonjour ${user.fullName.split(" ")[0]}`} description={<span className="capitalize">{formatDateLong(new Date())}</span>} />

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Références actives" value={formatInteger(kpis.referenceCount)} hint={`${formatInteger(kpis.totalQuantity)} unités en stock`} icon={Layers} tone="brand" href="/pieces" />
        <StatsCard label="Valeur du stock (prix d'achat)" value={formatCurrency(kpis.stockValue, { compact: true })} hint={`${formatCurrency(kpis.stockRetailValue, { compact: true })} au prix détail`} icon={Coins} tone="neutral" href="/rapports?onglet=valeur" />
        <StatsCard label="Stock faible" value={formatInteger(kpis.lowStock)} hint="pièces sous le minimum" icon={TriangleAlert} tone={kpis.lowStock > 0 ? "warning" : "success"} href="/stock?statut=FAIBLE" />
        <StatsCard label="Ruptures" value={formatInteger(kpis.outOfStock)} hint="pièces à quantité nulle" icon={CircleAlert} tone={kpis.outOfStock > 0 ? "danger" : "success"} href="/stock?statut=RUPTURE" />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Ventes du jour" value={formatCurrency(kpis.salesToday.total, { compact: true })} hint={`${kpis.salesToday.count} vente${kpis.salesToday.count > 1 ? "s" : ""} confirmée${kpis.salesToday.count > 1 ? "s" : ""}`} trend={salesDelta !== undefined ? { value: salesDelta } : undefined} icon={ShoppingCart} tone="success" href="/ventes" />
        <StatsCard label="Achats reçus aujourd'hui" value={formatCurrency(kpis.purchasesToday.total, { compact: true })} hint={`${kpis.purchasesToday.count} réception${kpis.purchasesToday.count > 1 ? "s" : ""}`} icon={Truck} tone="info" href="/achats?statut=RECUE" />
        <StatsCard label="Commandes en attente" value={formatInteger(kpis.pendingPurchases.count)} hint={`${formatCurrency(kpis.pendingPurchases.total, { compact: true })} à réceptionner`} icon={Boxes} tone={kpis.pendingPurchases.count > 0 ? "warning" : "neutral"} href="/achats?statut=COMMANDEE" />
        <StatsCard label="Ventes 30 jours" value={formatCurrency(sales30, { compact: true })} hint={`marge ${formatCurrency(margin30, { compact: true })}`} icon={Coins} tone="brand" href="/rapports?onglet=ventes" />
      </div>

      {/* Quick actions */}
      <div className="mt-5 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {quick.map((q) => (
          <Link key={q.href} href={q.href} className="card group flex items-center gap-3 px-3.5 py-3 transition-colors hover:border-brand-200 hover:bg-brand-50/40 focus-ring">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-ink-secondary transition-colors group-hover:bg-brand-600 group-hover:text-white">
              <q.icon className="size-4.5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-ink">{q.label}</span>
              <span className="block truncate text-[11.5px] text-ink-muted">{q.desc}</span>
            </span>
          </Link>
        ))}
      </div>

      {/* Charts row */}
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Évolution des ventes" description="30 derniers jours — ventes confirmées et marge brute" actions={<Link href="/rapports?onglet=ventes" className="text-[12.5px] font-medium text-brand-700 hover:underline">Rapport détaillé</Link>} />
          <CardBody className="px-2 pb-2">
            {sales30 > 0 ? <SalesAreaChart data={data.salesSeries} /> : <EmptyState compact title="Aucune vente sur la période" description="Les ventes confirmées apparaîtront ici." />}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Évolution du stock" description="Quantité totale reconstituée à partir des mouvements" actions={<Link href="/mouvements" className="text-[12.5px] font-medium text-brand-700 hover:underline">Mouvements</Link>} />
          <CardBody className="px-2 pb-2">
            <StockLineChart data={data.stockSeries} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader title="Top pièces vendues" description="Quantités sur 30 jours" />
          <CardBody className="px-2 pb-3">
            {data.topParts.length ? <TopPartsBarChart data={data.topParts} /> : <EmptyState compact title="Pas encore de ventes" />}
          </CardBody>
        </Card>
        <Card className="xl:col-span-1">
          <CardHeader title="Répartition par catégorie" description="Part de la valeur du stock (prix d'achat)" />
          <CardBody>{data.categoryBreakdown.length ? <CategoryDonut data={data.categoryBreakdown} /> : <EmptyState compact title="Aucune pièce" />}</CardBody>
        </Card>
        <Card className="xl:col-span-1">
          <CardHeader
            title="Alertes de stock"
            description={`${kpis.outOfStock} rupture${kpis.outOfStock > 1 ? "s" : ""} · ${kpis.lowStock} stock${kpis.lowStock > 1 ? "s" : ""} faible${kpis.lowStock > 1 ? "s" : ""}`}
            actions={
              <Link href="/stock?statut=ALERTES" className="text-[12.5px] font-medium text-brand-700 hover:underline">
                Tout voir
              </Link>
            }
          />
          {data.alerts.length === 0 ? (
            <EmptyState compact title="Aucune alerte" description="Toutes les pièces sont au-dessus de leur seuil minimum." />
          ) : (
            <ul className="divide-y divide-line">
              {data.alerts.map((a) => (
                <li key={a.id}>
                  <Link href={`/pieces/${a.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                    <span className={cn("size-2 shrink-0 rounded-full", a.quantity <= 0 ? "bg-danger-600" : "bg-warning-600")} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px]">
                        <span className="font-mono font-semibold">{a.reference}</span> <span className="text-ink-secondary">· {a.designation}</span>
                      </span>
                      <span className="block text-[11.5px] text-ink-muted">
                        {a.brand ?? "—"} {a.location ? `· Rayon ${a.location}` : ""} · min. {a.minStock}
                      </span>
                    </span>
                    <QuantityChip quantity={a.quantity} minStock={a.minStock} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Recent movements */}
      <Card className="mt-4">
        <CardHeader
          title="Derniers mouvements"
          description="Chaque variation de stock est tracée avec l'utilisateur, la raison et le document"
          actions={
            <Link href="/mouvements" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              Journal complet <ArrowRight />
            </Link>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line bg-slate-50/80 text-[11.5px] uppercase tracking-wide text-ink-muted">
                <th className="px-4 py-2 font-semibold">Date</th>
                <th className="px-3 py-2 font-semibold">Pièce</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 text-right font-semibold">Qté</th>
                <th className="px-3 py-2 text-right font-semibold">Stock</th>
                <th className="px-3 py-2 font-semibold">Document</th>
                <th className="px-4 py-2 font-semibold">Par</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.recentMovements.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/60">
                  <td className="whitespace-nowrap px-4 py-2 text-ink-muted" title={m.createdAt}>
                    {formatRelative(m.createdAt)}
                  </td>
                  <td className="max-w-[280px] px-3 py-2">
                    <Link href={`/pieces/${m.partId}`} className="block truncate hover:underline">
                      <span className="font-mono font-medium">{m.reference}</span> <span className="text-ink-secondary">· {m.designation}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <MovementTypeBadge type={m.type} size="sm" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <SignedQuantity value={m.quantity} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-ink-muted tabular">
                    {m.previousQuantity} → <span className="font-semibold text-ink">{m.newQuantity}</span>
                  </td>
                  <td className="px-3 py-2">
                    <DocumentLink documentType={m.documentType} documentId={m.documentId} documentNumber={m.documentNumber} />
                  </td>
                  <td className="px-4 py-2 text-ink-secondary">{m.userName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="sr-only">
        Valeur du stock : <Money value={kpis.stockValue} /> — {formatAmount(kpis.stockValue)} DA
      </p>
    </>
  );
}
