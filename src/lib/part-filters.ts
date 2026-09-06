import type { PartListFilters } from "@/server/services/parts";
import { sp, spEnum, spInt, spPage, type SearchParams } from "./search-params";

const SORTS = ["reference", "designation", "brand", "quantity", "purchasePrice", "wholesalePrice", "retailPrice", "updatedAt", "location"] as const;

/** URL → list filters, shared by /pieces and /stock (French query keys). */
export function parsePartFilters(params: SearchParams): PartListFilters {
  const statut = spEnum(params, "statut", ["ALL", "DISPONIBLE", "FAIBLE", "RUPTURE", "ALERTE", "ARCHIVES", "ALERTES"] as const, "ALL");
  const { page, pageSize } = spPage(params);
  return {
    q: sp(params, "q")?.trim() || undefined,
    status: statut === "ARCHIVES" ? "ALL" : statut === "ALERTES" ? "ALERTE" : statut,
    onlyInactive: statut === "ARCHIVES",
    brandId: spInt(params, "marque"),
    categoryId: spInt(params, "categorie"),
    locationId: spInt(params, "rayon"),
    supplierId: spInt(params, "fournisseur"),
    sort: spEnum(params, "tri", SORTS, "reference"),
    dir: spEnum(params, "ordre", ["asc", "desc"] as const, "asc"),
    page,
    pageSize,
  };
}
