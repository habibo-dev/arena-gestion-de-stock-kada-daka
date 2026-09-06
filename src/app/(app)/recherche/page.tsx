import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/session";
import { hasPermission } from "@/lib/permissions";
import { searchParts } from "@/server/services/search";
import { PageHeader } from "@/components/ui/misc";
import { SmartSearch } from "@/components/search/smart-search";
import { sp, type SearchParams } from "@/lib/search-params";

export const metadata: Metadata = { title: "Recherche intelligente" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePermission("parts.view");
  const params = await searchParams;
  const q = (sp(params, "q") ?? "").trim();
  const onlyInStock = sp(params, "stock") === "1";
  const initial = q.length >= 2 ? searchParts(q, { limit: 60, onlyInStock }) : null;

  return (
    <>
      <PageHeader title="Recherche intelligente" description="Décrivez ce que vous cherchez comme au comptoir : une référence, une marque, un type de pièce, un véhicule — ou tout à la fois." />
      <SmartSearch key={q + (onlyInStock ? "1" : "0")} initialQuery={q} initialResult={initial} canSell={hasPermission(user.role, "sales.create")} />
    </>
  );
}
