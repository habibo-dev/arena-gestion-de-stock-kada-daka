import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/session";
import { duplicatePartSource, listBrands, listCategories, listLocations, listSuppliersLite, getPartDetail } from "@/server/services/parts";
import { PageHeader } from "@/components/ui/misc";
import { PartForm } from "@/components/parts/part-form";
import { sp, type SearchParams } from "@/lib/search-params";

export const metadata: Metadata = { title: "Nouvelle pièce" };

export default async function NewPartPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePermission("parts.create");
  const params = await searchParams;
  const dupId = Number(sp(params, "dupliquer"));
  const source = Number.isInteger(dupId) && dupId > 0 ? duplicatePartSource(dupId) : null;
  const sourcePart = source ? getPartDetail(dupId) : null;
  const refData = { brands: listBrands(), categories: listCategories(), locations: listLocations(), suppliers: listSuppliersLite() };

  return (
    <>
      <PageHeader breadcrumbs={[{ label: "Pièces", href: "/pieces" }, { label: source ? "Dupliquer" : "Nouvelle pièce" }]} title={source ? "Dupliquer une pièce" : "Nouvelle pièce"} description="Renseignez la fiche telle qu'elle figure dans votre classeur : référence, désignation, marque, prix d'achat, prix gros, prix détail, UM et rayon." />
      <PartForm
        mode="create"
        refData={refData}
        initial={
          source
            ? {
                ...source,
                description: source.description ?? "",
                barcode: "",
                notes: source.notes ?? "",
                keywords: source.keywords ?? "",
              }
            : undefined
        }
        duplicateOf={sourcePart ? { id: sourcePart.id, reference: sourcePart.reference } : null}
      />
    </>
  );
}
