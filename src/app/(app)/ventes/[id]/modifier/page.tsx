import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requirePagePermission } from "@/server/auth/session";
import { hasPermission } from "@/lib/permissions";
import { getSale } from "@/server/services/sales";
import { getPartsByIds } from "@/server/services/parts";
import { getSetting } from "@/server/services/settings";
import { PageHeader } from "@/components/ui/misc";
import { SaleForm } from "@/components/sales/sale-form";

export const metadata: Metadata = { title: "Modifier la vente" };

export default async function EditSalePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("sales.create");
  const { id } = await params;
  const saleId = Number(id);
  if (!Number.isInteger(saleId)) notFound();
  const sale = getSale(saleId);
  if (!sale) notFound();
  if (sale.status !== "BROUILLON") redirect(`/ventes/${sale.id}`);
  const parts = new Map(getPartsByIds(sale.items.map((i) => i.partId)).map((p) => [p.id, p]));
  const lines = sale.items.flatMap((it) => {
    const p = parts.get(it.partId);
    if (!p) return [];
    const tierPrice = sale.priceTier === "GROS" ? p.wholesalePrice : p.retailPrice;
    return [
      {
        part: { id: p.id, reference: p.reference, designation: p.designation, brand: p.brand, quantity: p.quantity, minStock: p.minStock, unit: p.unit, purchasePrice: p.purchasePrice, wholesalePrice: p.wholesalePrice, retailPrice: p.retailPrice, location: p.location, imagePath: p.imagePath },
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        priceEdited: Math.abs(it.unitPrice - tierPrice) > 0.005,
      },
    ];
  });
  return (
    <>
      <PageHeader breadcrumbs={[{ label: "Ventes", href: "/ventes" }, { label: sale.number, href: `/ventes/${sale.id}` }, { label: "Modifier" }]} title={`Modifier le brouillon ${sale.number}`} description="Les modifications n'affectent pas le stock tant que la vente n'est pas confirmée." />
      <SaleForm
        mode="edit"
        initial={{
          id: sale.id,
          number: sale.number,
          customerId: sale.customerId,
          customerName: sale.customerName ?? "",
          customerPhone: sale.customerPhone ?? "",
          priceTier: sale.priceTier,
          paymentMethod: sale.paymentMethod,
          discountType: sale.discountType,
          discountValue: sale.discountValue,
          notes: sale.notes ?? "",
          lines,
        }}
        allowNegativeStock={getSetting("stock.allowNegative") === "true"}
        can={{ confirm: hasPermission(user.role, "sales.confirm") }}
      />
    </>
  );
}
