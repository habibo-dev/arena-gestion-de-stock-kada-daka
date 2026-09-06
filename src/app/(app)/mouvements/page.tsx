import type { Metadata } from "next";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import { hasPermission } from "@/lib/permissions";
import { listMovements, type MovementFilters } from "@/server/services/movements";
import { movementsSummary } from "@/server/services/reports";
import { getPartDetail } from "@/server/services/parts";
import { MOVEMENT_TYPE_LABELS } from "@/lib/stock";
import { formatInteger } from "@/lib/format";
import { sp, spInt, spPage, type SearchParams } from "@/lib/search-params";
import { PageHeader, StatsCard } from "@/components/ui/misc";
import { MovementsFilters } from "@/components/movements/movements-filters";
import { MovementsTable } from "@/components/movements/movements-table";
import { PaginationNav } from "@/components/ui/pagination-nav";

export const metadata: Metadata = { title: "Mouvements de stock" };

function dayBounds(from?: string, to?: string) {
  const f = from ? new Date(`${from}T00:00:00`) : undefined;
  const t = to ? new Date(`${to}T23:59:59.999`) : undefined;
  return { from: f && !Number.isNaN(f.getTime()) ? f.toISOString() : undefined, to: t && !Number.isNaN(t.getTime()) ? t.toISOString() : undefined };
}

export default async function MovementsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePermission("movements.view");
  const params = await searchParams;
  const { page, pageSize } = spPage(params);
  const type = sp(params, "type") ?? "ALL";
  const range = dayBounds(sp(params, "du"), sp(params, "au"));
  const partId = spInt(params, "piece");
  const filters: MovementFilters = {
    q: sp(params, "q")?.trim() || undefined,
    type: type === "ALL" || type === "IN" || type === "OUT" || type in MOVEMENT_TYPE_LABELS ? (type as MovementFilters["type"]) : "ALL",
    from: range.from,
    to: range.to,
    partId: partId || undefined,
    page,
    pageSize: Math.max(pageSize, 30),
  };
  const data = listMovements(filters);
  const part = partId ? getPartDetail(partId) : null;
  const now = new Date();
  const summary = movementsSummary({ from: range.from ?? new Date(now.getTime() - 30 * 86_400_000).toISOString(), to: range.to ?? now.toISOString() });

  return (
    <>
      <PageHeader title="Mouvements de stock" description="Journal immuable de toutes les variations de stock : entrées, sorties, ajustements, retours, transferts et inventaires." />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatsCard label={range.from || range.to ? "Entrées sur la période" : "Entrées (30 jours)"} value={`+${formatInteger(summary.totalIn)}`} hint={`${summary.countIn} mouvement${summary.countIn > 1 ? "s" : ""}`} icon={ArrowDownLeft} tone="success" />
        <StatsCard label={range.from || range.to ? "Sorties sur la période" : "Sorties (30 jours)"} value={`−${formatInteger(summary.totalOut)}`} hint={`${summary.countOut} mouvement${summary.countOut > 1 ? "s" : ""}`} icon={ArrowUpRight} tone="danger" />
        <StatsCard label="Solde net" value={`${summary.totalIn - summary.totalOut >= 0 ? "+" : ""}${formatInteger(summary.totalIn - summary.totalOut)}`} hint="unités, tous types confondus" icon={ArrowLeftRight} tone="neutral" />
      </div>
      <div className="card overflow-hidden">
        <MovementsFilters canAdjust={hasPermission(user.role, "stock.adjust")} canExport={hasPermission(user.role, "export.run")} partLabel={part ? part.reference : null} />
        <MovementsTable rows={data.items} />
        <PaginationNav page={data.page} pageCount={data.pageCount} total={data.total} pageSize={data.pageSize} pageSizes={[30, 50, 100]} />
      </div>
    </>
  );
}
