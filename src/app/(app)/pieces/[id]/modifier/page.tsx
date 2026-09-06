import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/server/auth/session";
import { getPartDetail, listBrands, listCategories, listLocations, listSuppliersLite } from "@/server/services/parts";
import { PageHeader } from "@/components/ui/misc";
import { PartForm } from "@/components/parts/part-form";

export const metadata: Metadata = { title: "Modifier la pièce" };

export default async function EditPartPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("parts.update");
  const { id } = await params;
  const part = getPartDetail(Number(id));
  if (!part) notFound();
  const refData = { brands: listBrands(), categories: listCategories(), locations: listLocations(), suppliers: listSuppliersLite() };

  return (
    <>
      <PageHeader breadcrumbs={[{ label: "Pièces", href: "/pieces" }, { label: part.reference, href: `/pieces/${part.id}` }, { label: "Modifier" }]} title={<>Modifier <span className="font-mono">{part.reference}</span></>} description={part.designation} />
      <PartForm
        mode="edit"
        refData={refData}
        initial={{
          id: part.id,
          quantity: part.quantity,
          reference: part.reference,
          designation: part.designation,
          description: part.description ?? "",
          brandId: part.brandId,
          categoryId: part.categoryId,
          locationId: part.locationId,
          supplierId: part.supplierId,
          unit: part.unit,
          purchasePrice: part.purchasePrice,
          wholesalePrice: part.wholesalePrice,
          retailPrice: part.retailPrice,
          minStock: part.minStock,
          barcode: part.barcode ?? "",
          notes: part.notes ?? "",
          keywords: part.keywords ?? "",
          isActive: part.isActive,
          references: part.references.map((r) => ({ type: r.type, reference: r.reference })),
        }}
      />
    </>
  );
}
