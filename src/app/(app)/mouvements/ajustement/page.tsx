import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/session";
import { getPartDetail } from "@/server/services/parts";
import { listMovements } from "@/server/services/movements";
import { PageHeader } from "@/components/ui/misc";
import { AdjustmentWorkbench } from "@/components/movements/adjustment-workbench";
import { spInt, type SearchParams } from "@/lib/search-params";

export const metadata: Metadata = { title: "Ajustement de stock" };

export default async function AdjustmentPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePagePermission("stock.adjust");
  const params = await searchParams;
  const partId = spInt(params, "piece");
  const part = partId ? getPartDetail(partId) : null;
  const recent = listMovements({ pageSize: 8, type: "ALL" }).items.filter((m) => ["ADJUSTMENT", "RETURN", null].includes(m.documentType) && m.type !== "TRANSFERT").slice(0, 6);

  return (
    <>
      <PageHeader breadcrumbs={[{ label: "Mouvements", href: "/mouvements" }, { label: "Ajustement" }]} title="Ajuster un stock" description="Inventaire, casse, retour client ou fournisseur : choisissez la pièce, indiquez la quantité et le motif. Un mouvement traçable est créé à chaque fois." />
      <AdjustmentWorkbench
        initialPart={
          part
            ? { id: part.id, reference: part.reference, designation: part.designation, brand: part.brand?.name ?? null, quantity: part.quantity, minStock: part.minStock, unit: part.unit, purchasePrice: part.purchasePrice, wholesalePrice: part.wholesalePrice, retailPrice: part.retailPrice, location: part.location?.code ?? null, imagePath: part.imagePath }
            : null
        }
        recent={recent}
      />
    </>
  );
}
