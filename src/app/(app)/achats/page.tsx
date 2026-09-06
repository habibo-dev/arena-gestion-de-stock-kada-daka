import type { Metadata } from "next";
import Link from "next/link";
import { PackageCheck, Truck, FileText } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { hasPermission } from "@/lib/permissions";
import { listPurchases, type PurchaseFilters } from "@/server/services/purchases";
import { getSqlite } from "@/server/db/client";
import { formatCurrency, formatDate, formatDateTime, formatInteger } from "@/lib/format";
import { sp, spInt, spPage, type SearchParams } from "@/lib/search-params";
import { PageHeader, StatsCard, Money } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { buttonVariants } from "@/components/ui/button";
import { DocumentListFilters } from "@/components/sales/sales-filters";
import { PaginationNav } from "@/components/ui/pagination-nav";
import { PurchaseStatusBadge } from "@/components/sales/status-badges";

export const metadata: Metadata = { title: "Achats" };

function dayBounds(from?: string, to?: string) {
  const f = from ? new Date(`${from}T00:00:00`) : undefined;
  const t = to ? new Date(`${to}T23:59:59.999`) : undefined;
  return { from: f && !Number.isNaN(f.getTime()) ? f.toISOString() : undefined, to: t && !Number.isNaN(t.getTime()) ? t.toISOString() : undefined };
}

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission("purchases.view");
  const params = await searchParams;
  const { page, pageSize } = spPage(params);
  const statut = sp(params, "statut") ?? "ALL";
  const range = dayBounds(sp(params, "du"), sp(params, "au"));
  const supplierId = spInt(params, "fournisseur");
  const filters: PurchaseFilters = {
    q: sp(params, "q")?.trim() || undefined,
    status: ["BROUILLON", "COMMANDEE", "RECUE", "ANNULEE"].includes(statut) ? (statut as PurchaseFilters["status"]) : "ALL",
    from: range.from,
    to: range.to,
    supplierId: supplierId ?? undefined,
    page,
    pageSize,
  };
  const data = listPurchases(filters);

  const sqlite = getSqlite();
  const counts = sqlite.prepare(`SELECT status, COUNT(*) AS c FROM purchases GROUP BY status`).all() as { status: string; c: number }[];
  const countMap: Record<string, number> = { ALL: 0 };
  for (const r of counts) {
    countMap[r.status] = r.c;
    countMap.ALL = (countMap.ALL ?? 0) + r.c;
  }
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const month = sqlite.prepare(`SELECT COUNT(*) AS c, COALESCE(SUM(total),0) AS t FROM purchases WHERE status='RECUE' AND received_at >= ?`).get(monthStart.toISOString()) as { c: number; t: number };
  const pending = sqlite.prepare(`SELECT COUNT(*) AS c, COALESCE(SUM(total),0) AS t FROM purchases WHERE status='COMMANDEE'`).get() as { c: number; t: number };
  const supplierName = supplierId ? ((sqlite.prepare(`SELECT name FROM suppliers WHERE id = ?`).get(supplierId) as { name: string } | undefined)?.name ?? null) : null;

  return (
    <>
      <PageHeader title="Achats" description="Commandes fournisseurs : brouillon → commandée → reçue (le stock augmente uniquement à la réception)." />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatsCard label="Réceptionné ce mois" value={formatCurrency(month.t, { compact: true })} hint={`${month.c} achat${month.c > 1 ? "s" : ""} reçu${month.c > 1 ? "s" : ""}`} icon={PackageCheck} tone="success" />
        <StatsCard label="Commandes en attente" value={formatInteger(pending.c)} hint={`${formatCurrency(pending.t, { compact: true })} à réceptionner`} icon={Truck} tone={pending.c > 0 ? "info" : "neutral"} href="/achats?statut=COMMANDEE" />
        <StatsCard label="Brouillons" value={formatInteger(countMap.BROUILLON ?? 0)} hint="à commander ou supprimer" icon={FileText} tone={(countMap.BROUILLON ?? 0) > 0 ? "warning" : "neutral"} href="/achats?statut=BROUILLON" />
      </div>
      {supplierName ? (
        <div className="mb-3 flex items-center gap-2 text-[13px]">
          <span className="rounded-md border border-brand-100 bg-brand-50 px-2 py-1 text-brand-700">
            Fournisseur : <strong>{supplierName}</strong>
          </span>
          <Link href="/achats" className="text-ink-muted hover:underline">
            retirer le filtre
          </Link>
        </div>
      ) : null}
      <div className="card overflow-hidden">
        <DocumentListFilters kind="purchases" counts={countMap} canCreate={hasPermission(user.role, "purchases.create")} canExport={hasPermission(user.role, "export.run")} />
        {data.items.length === 0 ? (
          <EmptyState
            title="Aucun achat"
            description={filters.q || filters.status !== "ALL" || range.from || supplierId ? "Aucun achat ne correspond à ces filtres." : "Créez votre première commande fournisseur : la réception fait entrer les pièces en stock."}
            action={
              hasPermission(user.role, "purchases.create") ? (
                <Link href="/achats/nouveau" className={buttonVariants({ size: "sm" })}>
                  Nouvel achat
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-line md:hidden">
              {data.items.map((p) => (
                <li key={p.id}>
                  <Link href={`/achats/${p.id}`} className="block px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[13px] font-semibold">{p.number}</span>
                      <PurchaseStatusBadge status={p.status} size="sm" />
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-ink-secondary">{p.supplierName ?? "—"}</p>
                    <div className="mt-1 flex items-center justify-between text-[12px] text-ink-muted">
                      <span>{formatDateTime(p.purchaseDate)}</span>
                      <Money value={p.total} className="font-semibold text-ink" />
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
                    <th className="px-3 py-2.5 font-semibold">Fournisseur</th>
                    <th className="px-3 py-2.5 font-semibold">Statut</th>
                    <th className="px-3 py-2.5 font-semibold">Livraison</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Articles</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Total</th>
                    <th className="px-4 py-2.5 font-semibold">Saisi par</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.items.map((p) => (
                    <tr key={p.id} className="relative hover:bg-brand-50/40">
                      <td className="px-4 py-2.5">
                        <Link href={`/achats/${p.id}`} className="font-mono font-semibold text-ink after:absolute after:inset-0">
                          {p.number}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-ink-secondary tabular">{formatDateTime(p.purchaseDate)}</td>
                      <td className="max-w-[220px] truncate px-3 py-2.5">{p.supplierName ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        <PurchaseStatusBadge status={p.status} size="sm" />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-ink-secondary tabular">{p.receivedAt ? `Reçu le ${formatDate(p.receivedAt)}` : p.expectedAt ? `Prévu le ${formatDate(p.expectedAt)}` : "—"}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular text-ink-secondary">{p.itemCount}</td>
                      <td className="px-3 py-2.5 text-right font-medium">
                        <Money value={p.total} />
                      </td>
                      <td className="px-4 py-2.5 text-ink-secondary">{p.userName ?? "—"}</td>
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
