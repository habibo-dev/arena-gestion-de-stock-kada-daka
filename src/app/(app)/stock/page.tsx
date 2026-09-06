import type { Metadata } from "next";
import { CircleAlert, Coins, Layers, TriangleAlert } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { hasPermission } from "@/lib/permissions";
import { getStockCounters, listBrands, listCategories, listLocations, listParts, listSuppliersLite } from "@/server/services/parts";
import { stockValuation } from "@/server/services/reports";
import { formatCurrency, formatInteger } from "@/lib/format";
import { PageHeader, StatsCard } from "@/components/ui/misc";
import { PartsTable } from "@/components/parts/parts-table";
import { parsePartFilters } from "@/lib/part-filters";
import type { SearchParams } from "@/lib/search-params";

export const metadata: Metadata = { title: "Stock" };

export default async function StockPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission("parts.view");
  const params = await searchParams;
  const filters = parsePartFilters(params);
  if (!params.tri) {
    // Default: alerts first, then lowest quantities
    filters.sort = "quantity";
    filters.dir = "asc";
  }
  const [data, counters, brands, categories, locations, suppliers, valuation] = [listParts(filters), getStockCounters(), listBrands(), listCategories(), listLocations(), listSuppliersLite(), stockValuation()];

  return (
    <>
      <PageHeader title="Stock" description="État des quantités par pièce, alertes de stock faible et ruptures" />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Unités en stock" value={formatInteger(valuation.totalQuantity)} hint={`${formatInteger(counters.total)} références actives`} icon={Layers} tone="brand" />
        <StatsCard label="Valeur (prix d'achat)" value={formatCurrency(valuation.purchaseValue, { compact: true })} hint={`${formatCurrency(valuation.retailValue, { compact: true })} au prix détail`} icon={Coins} />
        <StatsCard label="Stock faible" value={formatInteger(counters.faible)} hint="quantité ≤ minimum" icon={TriangleAlert} tone={counters.faible ? "warning" : "success"} href="/stock?statut=FAIBLE" />
        <StatsCard label="Ruptures" value={formatInteger(counters.rupture)} hint="quantité nulle" icon={CircleAlert} tone={counters.rupture ? "danger" : "success"} href="/stock?statut=RUPTURE" />
      </div>
      <PartsTable
        mode="stock"
        data={data}
        counters={counters}
        brands={brands}
        categories={categories}
        locations={locations}
        suppliers={suppliers}
        can={{
          update: hasPermission(user.role, "parts.update"),
          archive: hasPermission(user.role, "parts.archive"),
          adjust: hasPermission(user.role, "stock.adjust"),
          create: hasPermission(user.role, "parts.create"),
          export: hasPermission(user.role, "export.run"),
        }}
      />
    </>
  );
}
