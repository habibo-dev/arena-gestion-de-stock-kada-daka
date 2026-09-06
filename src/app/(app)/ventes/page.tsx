import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingCart, Coins, FileText } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import { hasPermission } from "@/lib/permissions";
import { listSales, type SaleFilters } from "@/server/services/sales";
import { getSqlite } from "@/server/db/client";
import { formatCurrency, formatDateTime, formatInteger } from "@/lib/format";
import { sp, spPage, type SearchParams } from "@/lib/search-params";
import { PageHeader, StatsCard, Money } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { buttonVariants } from "@/components/ui/button";
import { DocumentListFilters } from "@/components/sales/sales-filters";
import { PaginationNav } from "@/components/ui/pagination-nav";
import { PaymentBadge, SaleStatusBadge, TierBadge } from "@/components/sales/status-badges";

export const metadata: Metadata = { title: "Ventes" };

function dayBounds(from?: string, to?: string) {
  const f = from ? new Date(`${from}T00:00:00`) : undefined;
  const t = to ? new Date(`${to}T23:59:59.999`) : undefined;
  return { from: f && !Number.isNaN(f.getTime()) ? f.toISOString() : undefined, to: t && !Number.isNaN(t.getTime()) ? t.toISOString() : undefined };
}

export default async function SalesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePermission("sales.view");
  const params = await searchParams;
  const { page, pageSize } = spPage(params);
  const statut = sp(params, "statut") ?? "ALL";
  const range = dayBounds(sp(params, "du"), sp(params, "au"));
  const filters: SaleFilters = { q: sp(params, "q")?.trim() || undefined, status: ["BROUILLON", "CONFIRMEE", "ANNULEE"].includes(statut) ? (statut as SaleFilters["status"]) : "ALL", from: range.from, to: range.to, page, pageSize };
  const data = listSales(filters);

  const sqlite = getSqlite();
  const counts = sqlite.prepare(`SELECT status, COUNT(*) AS c FROM sales GROUP BY status`).all() as { status: string; c: number }[];
  const countMap: Record<string, number> = { ALL: 0 };
  for (const r of counts) {
    countMap[r.status] = r.c;
    countMap.ALL = (countMap.ALL ?? 0) + r.c;
  }
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const month = sqlite.prepare(`SELECT COUNT(*) AS c, COALESCE(SUM(total),0) AS t FROM sales WHERE status='CONFIRMEE' AND sale_date >= ?`).get(monthStart.toISOString()) as { c: number; t: number };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = sqlite.prepare(`SELECT COUNT(*) AS c, COALESCE(SUM(total),0) AS t FROM sales WHERE status='CONFIRMEE' AND sale_date >= ?`).get(today.toISOString()) as { c: number; t: number };

  return (
    <>
      <PageHeader title="Ventes" description="Brouillons, ventes confirmées (stock déduit) et annulées (stock restitué)." />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatsCard label="Aujourd'hui" value={formatCurrency(day.t, { compact: true })} hint={`${day.c} vente${day.c > 1 ? "s" : ""} confirmée${day.c > 1 ? "s" : ""}`} icon={ShoppingCart} tone="success" />
        <StatsCard label="Ce mois" value={formatCurrency(month.t, { compact: true })} hint={`${month.c} vente${month.c > 1 ? "s" : ""}`} icon={Coins} tone="brand" />
        <StatsCard label="Brouillons en attente" value={formatInteger(countMap.BROUILLON ?? 0)} hint="à confirmer ou supprimer" icon={FileText} tone={(countMap.BROUILLON ?? 0) > 0 ? "warning" : "neutral"} href="/ventes?statut=BROUILLON" />
      </div>
      <div className="card overflow-hidden">
        <DocumentListFilters kind="sales" counts={countMap} canCreate={hasPermission(user.role, "sales.create")} canExport={hasPermission(user.role, "export.run")} />
        {data.items.length === 0 ? (
          <EmptyState
            title="Aucune vente"
            description={filters.q || filters.status !== "ALL" || range.from ? "Aucune vente ne correspond à ces filtres." : "Créez votre première vente : le stock est déduit à la confirmation."}
            action={
              hasPermission(user.role, "sales.create") ? (
                <Link href="/ventes/nouvelle" className={buttonVariants({ size: "sm" })}>
                  Nouvelle vente
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-line md:hidden">
              {data.items.map((s) => (
                <li key={s.id}>
                  <Link href={`/ventes/${s.id}`} className="block px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[13px] font-semibold">{s.number}</span>
                      <SaleStatusBadge status={s.status} size="sm" />
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-ink-secondary">{s.customerName ?? "Client de passage"}</p>
                    <div className="mt-1 flex items-center justify-between text-[12px] text-ink-muted">
                      <span>{formatDateTime(s.saleDate)}</span>
                      <Money value={s.total} className="font-semibold text-ink" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-slate-50/80 text-[11.5px] uppercase tracking-wide text-ink-muted">
                    <th className="px-4 py-2.5 font-semibold">N°</th>
                    <th className="px-3 py-2.5 font-semibold">Date</th>
                    <th className="px-3 py-2.5 font-semibold">Client</th>
                    <th className="px-3 py-2.5 font-semibold">Statut</th>
                    <th className="px-3 py-2.5 font-semibold">Tarif</th>
                    <th className="px-3 py-2.5 font-semibold">Paiement</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Articles</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Total</th>
                    <th className="px-4 py-2.5 font-semibold">Vendeur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.items.map((s) => (
                    <tr key={s.id} className="relative hover:bg-brand-50/40">
                      <td className="px-4 py-2.5">
                        <Link href={`/ventes/${s.id}`} className="font-mono font-semibold text-ink after:absolute after:inset-0">
                          {s.number}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-ink-secondary tabular">{formatDateTime(s.saleDate)}</td>
                      <td className="max-w-[220px] truncate px-3 py-2.5">{s.customerName ?? <span className="text-ink-faint">Client de passage</span>}</td>
                      <td className="px-3 py-2.5">
                        <SaleStatusBadge status={s.status} size="sm" />
                      </td>
                      <td className="px-3 py-2.5">
                        <TierBadge tier={s.priceTier} />
                      </td>
                      <td className="px-3 py-2.5">
                        <PaymentBadge method={s.paymentMethod} />
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular text-ink-secondary">{s.itemCount}</td>
                      <td className="px-3 py-2.5 text-right font-medium">
                        <Money value={s.total} />
                      </td>
                      <td className="px-4 py-2.5 text-ink-secondary">{s.userName ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <PaginationNav page={data.page} pageCount={data.pageCount} total={data.total} pageSize={data.pageSize} />
      </div>
    </>
  );
}
