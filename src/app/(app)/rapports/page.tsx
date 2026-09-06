import type { Metadata } from "next";
import Link from "next/link";
import { format, eachDayOfInterval, eachMonthOfInterval, differenceInCalendarDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Boxes, Coins, PackageCheck, ShoppingCart, TrendingDown, TrendingUp, Layers } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { hasPermission } from "@/lib/permissions";
import { movementsSummary, purchasesReport, salesReport, stockReport, stockRotation, stockValuation, stockValueByCategory, topSellingParts, type DateRange } from "@/server/services/reports";
import { listMovements } from "@/server/services/movements";
import { formatCurrency, formatDate, formatDateTime, formatInteger, formatPercent } from "@/lib/format";
import { MOVEMENT_TYPE_LABELS, PAYMENT_METHOD_LABELS, PURCHASE_STATUS_LABELS } from "@/lib/stock";
import { sp, type SearchParams } from "@/lib/search-params";
import { PageHeader, StatsCard, Money } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { StockBadge } from "@/components/ui/stock-badge";
import { ReportsToolbar } from "@/components/reports/reports-toolbar";
import { REPORT_TABS, type ReportTab } from "@/lib/report-tabs";
import { DailyBars, InOutBars, ShareDonut, ValueByCategoryBars } from "@/components/reports/report-charts";
import { MovementTypeBadge } from "@/components/movements/movement-badge";

export const metadata: Metadata = { title: "Rapports" };

function isoDay(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function parseRange(from?: string, to?: string): { from: string; to: string; range: DateRange } {
  const end = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? new Date(`${to}T23:59:59.999`) : new Date();
  const startDefault = new Date(end);
  startDefault.setDate(startDefault.getDate() - 29);
  const start = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? new Date(`${from}T00:00:00`) : new Date(`${isoDay(startDefault)}T00:00:00`);
  const safeStart = start.getTime() <= end.getTime() ? start : new Date(`${isoDay(end)}T00:00:00`);
  return { from: isoDay(safeStart), to: isoDay(end), range: { from: safeStart.toISOString(), to: end.toISOString() } };
}

/** Buckets (date → value) by day for short ranges, by month for long ones. */
function bucketize<T>(rows: T[], getDate: (r: T) => string, getValue: (r: T) => number, range: DateRange) {
  const start = new Date(range.from);
  const end = new Date(range.to);
  const byMonth = differenceInCalendarDays(end, start) > 92;
  const keys = byMonth ? eachMonthOfInterval({ start, end }).map((d) => format(d, "yyyy-MM")) : eachDayOfInterval({ start, end }).map((d) => format(d, "yyyy-MM-dd"));
  const map = new Map<string, number>(keys.map((k) => [k, 0]));
  for (const r of rows) {
    const key = format(new Date(getDate(r)), byMonth ? "yyyy-MM" : "yyyy-MM-dd");
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + getValue(r));
  }
  return [...map.entries()].map(([k, v]) => ({ label: byMonth ? format(new Date(`${k}-01T00:00:00`), "MMM yy", { locale: fr }) : format(new Date(`${k}T00:00:00`), "dd/MM"), value: Math.round(v) }));
}

const TH = "px-3 py-2 font-semibold";
const THEAD = "border-b border-line bg-slate-50/80 text-left text-[11.5px] uppercase tracking-wide text-ink-muted";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission("reports.view");
  const params = await searchParams;
  const tabParam = sp(params, "onglet");
  const tab: ReportTab = REPORT_TABS.some((t) => t.value === tabParam) ? (tabParam as ReportTab) : "stock";
  const { from, to, range } = parseRange(sp(params, "du"), sp(params, "au"));
  const canExport = hasPermission(user.role, "export.run");
  const dated = tab !== "stock" && tab !== "valeur";
  const exportKind: Record<ReportTab, string> = { stock: "stock", valeur: "valeur-stock", ventes: "ventes", achats: "achats", mouvements: "mouvements", top: "top-ventes", rotation: "rotation" };
  const periodLabel = `${formatDate(range.from)} → ${formatDate(range.to)}`;

  return (
    <>
      <PageHeader title="Rapports" description="État et valeur du stock, ventes, achats, mouvements, meilleures ventes et rotation. Chaque rapport est exportable en Excel." />
      <ReportsToolbar tab={tab} from={from} to={to} dated={dated} exportKind={exportKind[tab]} canExport={canExport} />

      {tab === "stock" ? <StockTab statusParam={sp(params, "statut")} /> : null}
      {tab === "valeur" ? <ValueTab /> : null}
      {tab === "ventes" ? <SalesTab range={range} periodLabel={periodLabel} /> : null}
      {tab === "achats" ? <PurchasesTab range={range} periodLabel={periodLabel} /> : null}
      {tab === "mouvements" ? <MovementsTab range={range} periodLabel={periodLabel} /> : null}
      {tab === "top" ? <TopTab range={range} periodLabel={periodLabel} /> : null}
      {tab === "rotation" ? <RotationTab range={range} periodLabel={periodLabel} /> : null}
    </>
  );
}

/* ------------------------------ État du stock ------------------------------ */
function StockTab({ statusParam }: { statusParam?: string }) {
  const status = statusParam === "FAIBLE" || statusParam === "RUPTURE" || statusParam === "ALERTE" ? statusParam : "ALL";
  const all = stockReport();
  const rows = status === "ALL" ? all : all.filter((r) => (status === "ALERTE" ? r.status !== "DISPONIBLE" : r.status === status));
  const low = all.filter((r) => r.status === "FAIBLE").length;
  const out = all.filter((r) => r.status === "RUPTURE").length;
  const totalValue = all.reduce((s, r) => s + r.stockValue, 0);
  const shown = rows.slice(0, 300);
  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Références actives" value={formatInteger(all.length)} icon={Boxes} tone="brand" href="/rapports?onglet=stock" />
        <StatsCard label="Stock faible" value={formatInteger(low)} hint="quantité ≤ stock minimum" icon={TrendingDown} tone={low ? "warning" : "neutral"} href="/rapports?onglet=stock&statut=FAIBLE" />
        <StatsCard label="Ruptures" value={formatInteger(out)} hint="quantité nulle" icon={Layers} tone={out ? "danger" : "neutral"} href="/rapports?onglet=stock&statut=RUPTURE" />
        <StatsCard label="Valeur (prix d'achat)" value={formatCurrency(totalValue, { compact: true })} icon={Coins} tone="success" href="/rapports?onglet=valeur" />
      </div>
      <Card>
        <CardHeader
          title={status === "ALL" ? "Toutes les références" : status === "FAIBLE" ? "Références en stock faible" : status === "RUPTURE" ? "Références en rupture" : "Références en alerte"}
          description={`${rows.length} ligne${rows.length > 1 ? "s" : ""}${rows.length > shown.length ? ` · ${shown.length} affichées (l'export Excel contient tout)` : ""}`}
          actions={
            <div className="flex flex-wrap gap-1">
              {[
                { v: "ALL", l: "Toutes" },
                { v: "ALERTE", l: "En alerte" },
                { v: "FAIBLE", l: "Stock faible" },
                { v: "RUPTURE", l: "Ruptures" },
              ].map((o) => (
                <Link key={o.v} href={`/rapports?onglet=stock${o.v === "ALL" ? "" : `&statut=${o.v}`}`} className={`rounded-md border px-2 py-1 text-[12px] font-medium ${status === o.v ? "border-brand-200 bg-brand-50 text-brand-700" : "border-line bg-white text-ink-secondary hover:bg-slate-50"}`}>
                  {o.l}
                </Link>
              ))}
            </div>
          }
        />
        {shown.length === 0 ? (
          <EmptyState compact title="Aucune référence" description="Aucune pièce ne correspond à ce filtre." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-[13px]">
              <thead>
                <tr className={THEAD}>
                  <th className={TH}>Référence</th>
                  <th className={TH}>Désignation</th>
                  <th className={TH}>Marque</th>
                  <th className={TH}>Catégorie</th>
                  <th className={TH}>Rayon</th>
                  <th className={`${TH} text-right`}>Qté</th>
                  <th className={`${TH} text-right`}>Min.</th>
                  <th className={`${TH} text-right`}>Prix d&apos;achat</th>
                  <th className={`${TH} text-right`}>Valeur</th>
                  <th className={TH}>Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((r) => (
                  <tr key={r.id} className="hover:bg-brand-50/30">
                    <td className="px-3 py-1.5">
                      <Link href={`/pieces/${r.id}`} className="font-mono font-semibold text-brand-700 hover:underline">
                        {r.reference}
                      </Link>
                    </td>
                    <td className="max-w-[260px] truncate px-3 py-1.5">{r.designation}</td>
                    <td className="px-3 py-1.5 text-ink-secondary">{r.brand ?? "—"}</td>
                    <td className="px-3 py-1.5 text-ink-secondary">{r.category ?? "—"}</td>
                    <td className="px-3 py-1.5 font-mono text-ink-secondary">{r.location ?? "—"}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular">{r.quantity}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular text-ink-muted">{r.minStock || "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular">
                      <Money value={r.purchasePrice} />
                    </td>
                    <td className="px-3 py-1.5 text-right tabular font-medium">
                      <Money value={r.stockValue} />
                    </td>
                    <td className="px-3 py-1.5">
                      <StockBadge quantity={r.quantity} minStock={r.minStock} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

/* ----------------------------- Valeur du stock ----------------------------- */
function ValueTab() {
  const v = stockValuation();
  const cats = stockValueByCategory();
  const potentialMargin = v.retailValue - v.purchaseValue;
  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Valeur au prix d'achat" value={formatCurrency(v.purchaseValue, { compact: true })} hint={`${formatInteger(v.totalQuantity)} articles · ${formatInteger(v.references)} réf.`} icon={Coins} tone="brand" />
        <StatsCard label="Valeur au prix gros" value={formatCurrency(v.wholesaleValue, { compact: true })} icon={TrendingUp} tone="info" />
        <StatsCard label="Valeur au prix détail" value={formatCurrency(v.retailValue, { compact: true })} icon={TrendingUp} tone="success" />
        <StatsCard label="Marge potentielle (détail)" value={formatCurrency(potentialMargin, { compact: true })} hint={v.purchaseValue > 0 ? `${formatPercent((potentialMargin / v.purchaseValue) * 100, 0)} du coût` : undefined} icon={Coins} tone="neutral" />
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Valeur par catégorie" description="Valeur d'achat et valeur détail du stock actuel." />
          <CardBody>{cats.length ? <ValueByCategoryBars data={cats} /> : <EmptyState compact title="Aucune donnée" />}</CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Répartition (prix d'achat)" />
          <CardBody>
            <ShareDonut data={cats.slice(0, 8).map((c) => ({ name: c.category, value: Math.round(c.purchaseValue) }))} />
          </CardBody>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader title="Détail par catégorie" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className={THEAD}>
                <th className={TH}>Catégorie</th>
                <th className={`${TH} text-right`}>Références</th>
                <th className={`${TH} text-right`}>Quantité</th>
                <th className={`${TH} text-right`}>Valeur achat</th>
                <th className={`${TH} text-right`}>Valeur gros</th>
                <th className={`${TH} text-right`}>Valeur détail</th>
                <th className={`${TH} text-right`}>Part</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {cats.map((c) => (
                <tr key={c.category}>
                  <td className="px-3 py-1.5 font-medium">{c.category}</td>
                  <td className="px-3 py-1.5 text-right font-mono tabular">{c.refs}</td>
                  <td className="px-3 py-1.5 text-right font-mono tabular">{formatInteger(c.quantity)}</td>
                  <td className="px-3 py-1.5 text-right tabular">
                    <Money value={c.purchaseValue} />
                  </td>
                  <td className="px-3 py-1.5 text-right tabular">
                    <Money value={c.wholesaleValue} />
                  </td>
                  <td className="px-3 py-1.5 text-right tabular">
                    <Money value={c.retailValue} />
                  </td>
                  <td className="px-3 py-1.5 text-right tabular text-ink-muted">{v.purchaseValue > 0 ? formatPercent((c.purchaseValue / v.purchaseValue) * 100, 1) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line bg-slate-50/60 font-semibold">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right font-mono tabular">{v.references}</td>
                <td className="px-3 py-2 text-right font-mono tabular">{formatInteger(v.totalQuantity)}</td>
                <td className="px-3 py-2 text-right tabular">
                  <Money value={v.purchaseValue} />
                </td>
                <td className="px-3 py-2 text-right tabular">
                  <Money value={v.wholesaleValue} />
                </td>
                <td className="px-3 py-2 text-right tabular">
                  <Money value={v.retailValue} />
                </td>
                <td className="px-3 py-2 text-right tabular">100 %</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </>
  );
}

/* --------------------------------- Ventes ---------------------------------- */
function SalesTab({ range, periodLabel }: { range: DateRange; periodLabel: string }) {
  const { rows, summary, byPayment } = salesReport(range);
  const series = bucketize(rows, (r) => r.saleDate, (r) => r.total, range);
  const avg = summary.count ? summary.total / summary.count : 0;
  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Chiffre d'affaires" value={formatCurrency(summary.total, { compact: true })} hint={periodLabel} icon={ShoppingCart} tone="brand" />
        <StatsCard label="Ventes confirmées" value={formatInteger(summary.count)} hint={`${formatInteger(summary.items)} articles`} icon={PackageCheck} tone="neutral" />
        <StatsCard label="Marge brute" value={formatCurrency(summary.margin, { compact: true })} hint={summary.total > 0 ? `${formatPercent((summary.margin / summary.total) * 100, 1)} du CA` : undefined} icon={TrendingUp} tone={summary.margin >= 0 ? "success" : "danger"} />
        <StatsCard label="Panier moyen" value={formatCurrency(avg, { compact: true })} hint={summary.discount > 0 ? `remises : ${formatCurrency(summary.discount, { compact: true })}` : "aucune remise"} icon={Coins} tone="info" />
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Évolution des ventes" description="Chiffre d'affaires confirmé sur la période." />
          <CardBody>{rows.length ? <DailyBars data={series} name="Ventes" /> : <EmptyState compact title="Aucune vente sur la période" />}</CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Modes de paiement" />
          <CardBody>{byPayment.length ? <ShareDonut data={byPayment.map((p) => ({ name: PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] ?? p.method, value: Math.round(p.total) }))} /> : <EmptyState compact title="Aucune donnée" />}</CardBody>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader title="Ventes de la période" description={`${rows.length} vente${rows.length > 1 ? "s" : ""}${rows.length > 200 ? " · 200 affichées (l'export contient tout)" : ""}`} />
        {rows.length === 0 ? (
          <EmptyState compact title="Aucune vente" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-[13px]">
              <thead>
                <tr className={THEAD}>
                  <th className={TH}>N°</th>
                  <th className={TH}>Date</th>
                  <th className={TH}>Client</th>
                  <th className={TH}>Paiement</th>
                  <th className={`${TH} text-right`}>Articles</th>
                  <th className={`${TH} text-right`}>Remise</th>
                  <th className={`${TH} text-right`}>Total</th>
                  <th className={`${TH} text-right`}>Marge</th>
                  <th className={TH}>Vendeur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.slice(0, 200).map((r) => (
                  <tr key={r.id} className="hover:bg-brand-50/30">
                    <td className="px-3 py-1.5">
                      <Link href={`/ventes/${r.id}`} className="font-mono font-semibold text-brand-700 hover:underline">
                        {r.number}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 tabular text-ink-secondary">{formatDateTime(r.saleDate)}</td>
                    <td className="max-w-[200px] truncate px-3 py-1.5">{r.customerName ?? <span className="text-ink-faint">Client de passage</span>}</td>
                    <td className="px-3 py-1.5 text-ink-secondary">{PAYMENT_METHOD_LABELS[r.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] ?? r.paymentMethod}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular">{r.itemCount}</td>
                    <td className="px-3 py-1.5 text-right tabular text-ink-muted">{r.discountAmount > 0 ? <Money value={r.discountAmount} /> : "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular font-medium">
                      <Money value={r.total} />
                    </td>
                    <td className={`px-3 py-1.5 text-right tabular ${r.margin < 0 ? "text-danger-700" : "text-success-700"}`}>
                      <Money value={r.margin} />
                    </td>
                    <td className="px-3 py-1.5 text-ink-secondary">{r.userName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

/* --------------------------------- Achats ---------------------------------- */
function PurchasesTab({ range, periodLabel }: { range: DateRange; periodLabel: string }) {
  const { rows, summary, bySupplier } = purchasesReport(range);
  const series = bucketize(rows.filter((r) => r.status === "RECUE"), (r) => r.receivedAt ?? r.purchaseDate, (r) => r.total, range);
  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Achats (hors annulés)" value={formatCurrency(summary.total, { compact: true })} hint={periodLabel} icon={PackageCheck} tone="brand" />
        <StatsCard label="Réceptionné" value={formatCurrency(summary.received, { compact: true })} hint="entré en stock" icon={TrendingUp} tone="success" />
        <StatsCard label="En commande" value={formatCurrency(summary.pending, { compact: true })} hint="non réceptionné" icon={Layers} tone={summary.pending > 0 ? "info" : "neutral"} />
        <StatsCard label="Documents" value={formatInteger(summary.count)} hint={`${formatInteger(summary.items)} articles`} icon={Boxes} tone="neutral" />
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Réceptions" description="Montant des achats réceptionnés sur la période." />
          <CardBody>{rows.length ? <DailyBars data={series} name="Réceptions" /> : <EmptyState compact title="Aucun achat sur la période" />}</CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Par fournisseur" />
          <CardBody>{bySupplier.length ? <ShareDonut data={bySupplier.slice(0, 8).map((s) => ({ name: s.supplier, value: Math.round(s.total) }))} /> : <EmptyState compact title="Aucune donnée" />}</CardBody>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader title="Achats de la période" description={`${rows.length} document${rows.length > 1 ? "s" : ""}`} />
        {rows.length === 0 ? (
          <EmptyState compact title="Aucun achat" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead>
                <tr className={THEAD}>
                  <th className={TH}>N°</th>
                  <th className={TH}>Date</th>
                  <th className={TH}>Fournisseur</th>
                  <th className={TH}>Facture</th>
                  <th className={TH}>Statut</th>
                  <th className={TH}>Reçu le</th>
                  <th className={`${TH} text-right`}>Articles</th>
                  <th className={`${TH} text-right`}>Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.slice(0, 200).map((r) => (
                  <tr key={r.id} className="hover:bg-brand-50/30">
                    <td className="px-3 py-1.5">
                      <Link href={`/achats/${r.id}`} className="font-mono font-semibold text-brand-700 hover:underline">
                        {r.number}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 tabular text-ink-secondary">{formatDateTime(r.purchaseDate)}</td>
                    <td className="max-w-[200px] truncate px-3 py-1.5">{r.supplierName ?? "—"}</td>
                    <td className="px-3 py-1.5 font-mono text-ink-secondary">{r.invoice ?? "—"}</td>
                    <td className="px-3 py-1.5">
                      <Badge variant={r.status === "RECUE" ? "success" : r.status === "COMMANDEE" ? "info" : "warning"} size="sm">
                        {PURCHASE_STATUS_LABELS[r.status as keyof typeof PURCHASE_STATUS_LABELS] ?? r.status}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 tabular text-ink-secondary">{r.receivedAt ? formatDate(r.receivedAt) : "—"}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular">{r.itemCount}</td>
                    <td className="px-3 py-1.5 text-right tabular font-medium">
                      <Money value={r.total} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

/* ------------------------------- Mouvements -------------------------------- */
function MovementsTab({ range, periodLabel }: { range: DateRange; periodLabel: string }) {
  const summary = movementsSummary(range);
  const recent = listMovements({ from: range.from, to: range.to, pageSize: 100 });
  const start = new Date(range.from);
  const end = new Date(range.to);
  const byMonth = differenceInCalendarDays(end, start) > 92;
  const keys = byMonth ? eachMonthOfInterval({ start, end }).map((d) => format(d, "yyyy-MM")) : eachDayOfInterval({ start, end }).map((d) => format(d, "yyyy-MM-dd"));
  const buckets = new Map(keys.map((k) => [k, { entrees: 0, sorties: 0 }]));
  // Aggregate full period (not just the first page) via a dedicated page walk capped at 5000 rows.
  let page = 1;
  for (;;) {
    const chunk = listMovements({ from: range.from, to: range.to, page, pageSize: 100 });
    for (const m of chunk.items) {
      const key = format(new Date(m.createdAt), byMonth ? "yyyy-MM" : "yyyy-MM-dd");
      const b = buckets.get(key);
      if (!b) continue;
      if (m.quantity > 0) b.entrees += m.quantity;
      else b.sorties += -m.quantity;
    }
    if (page >= chunk.pageCount || page >= 50) break;
    page++;
  }
  const series = [...buckets.entries()].map(([k, v]) => ({ label: byMonth ? format(new Date(`${k}-01T00:00:00`), "MMM yy", { locale: fr }) : format(new Date(`${k}T00:00:00`), "dd/MM"), ...v }));
  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Mouvements" value={formatInteger(summary.totals.count)} hint={periodLabel} icon={Layers} tone="brand" />
        <StatsCard label="Entrées" value={`+${formatInteger(summary.totalIn)}`} hint={`${formatInteger(summary.countIn)} mouvement${summary.countIn > 1 ? "s" : ""}`} icon={TrendingUp} tone="success" />
        <StatsCard label="Sorties" value={`−${formatInteger(summary.totalOut)}`} hint={`${formatInteger(summary.countOut)} mouvement${summary.countOut > 1 ? "s" : ""}`} icon={TrendingDown} tone="danger" />
        <StatsCard label="Solde net" value={`${summary.totalIn - summary.totalOut >= 0 ? "+" : ""}${formatInteger(summary.totalIn - summary.totalOut)}`} hint="articles" icon={Boxes} tone="neutral" />
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Entrées / sorties" description="Quantités par jour (ou par mois pour les longues périodes)." />
          <CardBody>{summary.totals.count ? <InOutBars data={series} /> : <EmptyState compact title="Aucun mouvement sur la période" />}</CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Par type de mouvement" />
          {summary.byType.length === 0 ? (
            <EmptyState compact title="Aucune donnée" />
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className={THEAD}>
                  <th className={TH}>Type</th>
                  <th className={`${TH} text-right`}>Nb</th>
                  <th className={`${TH} text-right`}>Qté</th>
                  <th className={`${TH} text-right`}>Valeur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {summary.byType.map((t) => (
                  <tr key={t.type}>
                    <td className="px-3 py-1.5">
                      <MovementTypeBadge type={t.type as keyof typeof MOVEMENT_TYPE_LABELS} />
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono tabular">{t.count}</td>
                    <td className={`px-3 py-1.5 text-right font-mono tabular ${t.quantity < 0 ? "text-danger-700" : "text-success-700"}`}>
                      {t.quantity > 0 ? "+" : ""}
                      {formatInteger(t.quantity)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular text-ink-secondary">
                      <Money value={t.value} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader
          title="Derniers mouvements de la période"
          description={`${recent.total} mouvement${recent.total > 1 ? "s" : ""} · 100 affichés`}
          actions={
            <Link href={`/mouvements?du=${format(start, "yyyy-MM-dd")}&au=${format(end, "yyyy-MM-dd")}`} className="text-[12.5px] font-medium text-brand-700 hover:underline">
              Ouvrir le journal complet
            </Link>
          }
        />
        {recent.items.length === 0 ? (
          <EmptyState compact title="Aucun mouvement" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-[13px]">
              <thead>
                <tr className={THEAD}>
                  <th className={TH}>Date</th>
                  <th className={TH}>Pièce</th>
                  <th className={TH}>Type</th>
                  <th className={`${TH} text-right`}>Qté</th>
                  <th className={`${TH} text-right`}>Avant → Après</th>
                  <th className={TH}>Document</th>
                  <th className={TH}>Utilisateur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recent.items.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap px-3 py-1.5 tabular text-ink-secondary">{formatDateTime(m.createdAt)}</td>
                    <td className="max-w-[260px] truncate px-3 py-1.5">
                      <Link href={`/pieces/${m.partId}`} className="font-mono font-semibold text-brand-700 hover:underline">
                        {m.reference}
                      </Link>{" "}
                      <span className="text-ink-secondary">{m.designation}</span>
                    </td>
                    <td className="px-3 py-1.5">
                      <MovementTypeBadge type={m.type} />
                    </td>
                    <td className={`px-3 py-1.5 text-right font-mono tabular font-semibold ${m.quantity < 0 ? "text-danger-700" : "text-success-700"}`}>
                      {m.quantity > 0 ? "+" : ""}
                      {m.quantity}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono tabular text-ink-secondary">
                      {m.previousQuantity} → {m.newQuantity}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[12px] text-ink-secondary">{m.documentNumber ?? "—"}</td>
                    <td className="px-3 py-1.5 text-ink-secondary">{m.userName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

/* -------------------------------- Top ventes ------------------------------- */
function TopTab({ range, periodLabel }: { range: DateRange; periodLabel: string }) {
  const rows = topSellingParts(range, 50);
  const totalQty = rows.reduce((s, r) => s + r.quantity, 0);
  const totalAmount = rows.reduce((s, r) => s + r.total, 0);
  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatsCard label="Références vendues" value={formatInteger(rows.length)} hint={periodLabel} icon={Boxes} tone="brand" />
        <StatsCard label="Articles vendus" value={formatInteger(totalQty)} icon={ShoppingCart} tone="neutral" />
        <StatsCard label="CA (top 50)" value={formatCurrency(totalAmount, { compact: true })} icon={Coins} tone="success" />
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Top 8 en quantité" />
          <CardBody>{rows.length ? <ShareDonut data={rows.slice(0, 8).map((r) => ({ name: r.reference, value: r.quantity }))} money={false} /> : <EmptyState compact title="Aucune vente sur la période" />}</CardBody>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title="Classement" description="Par quantité vendue, ventes confirmées uniquement." />
          {rows.length === 0 ? (
            <EmptyState compact title="Aucune vente" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-[13px]">
                <thead>
                  <tr className={THEAD}>
                    <th className={TH}>#</th>
                    <th className={TH}>Pièce</th>
                    <th className={`${TH} text-right`}>Qté vendue</th>
                    <th className={`${TH} text-right`}>CA</th>
                    <th className={`${TH} text-right`}>Marge</th>
                    <th className={`${TH} text-right`}>Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r, i) => (
                    <tr key={r.partId} className="hover:bg-brand-50/30">
                      <td className="px-3 py-1.5 font-mono text-ink-muted">{i + 1}</td>
                      <td className="max-w-[300px] px-3 py-1.5">
                        <Link href={`/pieces/${r.partId}`} className="font-mono font-semibold text-brand-700 hover:underline">
                          {r.reference}
                        </Link>
                        <p className="truncate text-ink-secondary">
                          {r.designation}
                          {r.brand ? <span className="text-ink-muted"> · {r.brand}</span> : null}
                        </p>
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono tabular font-semibold">{formatInteger(r.quantity)}</td>
                      <td className="px-3 py-1.5 text-right tabular">
                        <Money value={r.total} />
                      </td>
                      <td className={`px-3 py-1.5 text-right tabular ${r.margin < 0 ? "text-danger-700" : "text-success-700"}`}>
                        <Money value={r.margin} />
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <StockBadge quantity={r.stock} minStock={r.minStock} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

/* --------------------------------- Rotation -------------------------------- */
function RotationTab({ range, periodLabel }: { range: DateRange; periodLabel: string }) {
  const rows = stockRotation(range);
  const fast = rows.filter((r) => r.classification === "RAPIDE");
  const dormant = rows.filter((r) => r.classification === "DORMANT");
  const dormantValue = dormant.reduce((s, r) => s + r.stock * r.purchasePrice, 0);
  const shown = rows.slice(0, 300);
  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Références analysées" value={formatInteger(rows.length)} hint={periodLabel} icon={Boxes} tone="brand" />
        <StatsCard label="Rotation rapide" value={formatInteger(fast.length)} hint="couverture < 15 jours" icon={TrendingUp} tone="success" />
        <StatsCard label="Dormantes" value={formatInteger(dormant.length)} hint="aucune vente sur la période" icon={TrendingDown} tone={dormant.length ? "warning" : "neutral"} />
        <StatsCard label="Valeur dormante" value={formatCurrency(dormantValue, { compact: true })} hint="au prix d'achat" icon={Coins} tone={dormantValue > 0 ? "danger" : "neutral"} />
      </div>
      <Card>
        <CardHeader title="Rotation par référence" description={`Ventes de la période, rythme journalier et couverture du stock actuel${rows.length > shown.length ? ` · ${shown.length} lignes affichées (l'export contient tout)` : ""}.`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead>
              <tr className={THEAD}>
                <th className={TH}>Pièce</th>
                <th className={TH}>Catégorie</th>
                <th className={`${TH} text-right`}>Vendu</th>
                <th className={`${TH} text-right`}>Par jour</th>
                <th className={`${TH} text-right`}>Stock</th>
                <th className={`${TH} text-right`}>Couverture</th>
                <th className={TH}>Dernière vente</th>
                <th className={TH}>Classe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((r) => (
                <tr key={r.id} className="hover:bg-brand-50/30">
                  <td className="max-w-[300px] px-3 py-1.5">
                    <Link href={`/pieces/${r.id}`} className="font-mono font-semibold text-brand-700 hover:underline">
                      {r.reference}
                    </Link>
                    <p className="truncate text-ink-secondary">{r.designation}</p>
                  </td>
                  <td className="px-3 py-1.5 text-ink-secondary">{r.category ?? "—"}</td>
                  <td className="px-3 py-1.5 text-right font-mono tabular font-semibold">{formatInteger(r.sold)}</td>
                  <td className="px-3 py-1.5 text-right font-mono tabular text-ink-secondary">{r.dailyRate > 0 ? r.dailyRate.toFixed(2) : "—"}</td>
                  <td className="px-3 py-1.5 text-right">
                    <StockBadge quantity={r.stock} minStock={r.minStock} size="sm" />
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono tabular">{r.coverDays === null ? "—" : r.coverDays > 365 ? "> 1 an" : `${r.coverDays} j`}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 tabular text-ink-secondary">{r.lastSaleAt ? formatDate(r.lastSaleAt) : "jamais"}</td>
                  <td className="px-3 py-1.5">
                    <Badge variant={r.classification === "RAPIDE" ? "success" : r.classification === "DORMANT" ? "warning" : "neutral"} size="sm">
                      {r.classification === "RAPIDE" ? "Rapide" : r.classification === "DORMANT" ? "Dormante" : "Normale"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
