import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/session";
import { hasPermission } from "@/lib/permissions";
import { getStockCounters, listBrands, listCategories, listLocations, listParts, listSuppliersLite } from "@/server/services/parts";
import type { SearchParams } from "@/lib/search-params";
import { parsePartFilters } from "@/lib/part-filters";
import { PageHeader } from "@/components/ui/misc";
import { PartsTable } from "@/components/parts/parts-table";

export const metadata: Metadata = { title: "Pièces" };

export default async function PartsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePermission("parts.view");
  const params = await searchParams;
  const filters = parsePartFilters(params);
  const [data, counters, brands, categories, locations, suppliers] = [listParts(filters), getStockCounters(), listBrands(), listCategories(), listLocations(), listSuppliersLite()];

  return (
    <>
      <PageHeader title="Pièces" description={`${counters.total} références actives · catalogue complet avec prix d'achat, prix gros, prix détail et rayon`} />
      <PartsTable
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
