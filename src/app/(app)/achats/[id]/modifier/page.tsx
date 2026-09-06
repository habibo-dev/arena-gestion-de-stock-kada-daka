import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/server/auth/session";
import { hasPermission } from "@/lib/permissions";
import { getPurchase, getReorderSuggestions } from "@/server/services/purchases";
import { getPartsByIds } from "@/server/services/parts";
import { listSuppliers } from "@/server/services/suppliers";
import { PageHeader } from "@/components/ui/misc";
import { PurchaseForm } from "@/components/purchases/purchase-form";
import { toPickedPart } from "@/lib/picked-part";

export const metadata: Metadata = { title: "Modifier l'achat" };

export default async function EditPurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("purchases.create");
  const { id } = await params;
  const purchaseId = Number(id);
  if (!Number.isInteger(purchaseId)) notFound();
  const purchase = getPurchase(purchaseId);
  if (!purchase) notFound();
  if (purchase.status !== "BROUILLON" && purchase.status !== "COMMANDEE") redirect(`/achats/${purchase.id}`);
  const parts = new Map(getPartsByIds(purchase.items.map((i) => i.partId)).map((p) => [p.id, p]));
  const lines = purchase.items.flatMap((it) => {
    const p = parts.get(it.partId);
    return p ? [{ part: toPickedPart(p), quantity: it.quantity, unitCost: it.unitCost }] : [];
  });
  const suppliers = listSuppliers({ includeInactive: true }).map((s) => ({ id: s.id, name: s.name }));
  const suggestionsRaw = getReorderSuggestions();
  const suggestionParts = new Map(getPartsByIds(suggestionsRaw.map((s) => s.id)).map((p) => [p.id, p]));
  const suggestions = suggestionsRaw.flatMap((s) => {
    const p = suggestionParts.get(s.id);
    return p ? [{ part: toPickedPart(p), supplierId: s.supplierId, supplierName: s.supplierName, suggestedQuantity: s.suggestedQuantity }] : [];
  });
  return (
    <>
      <PageHeader breadcrumbs={[{ label: "Achats", href: "/achats" }, { label: purchase.number, href: `/achats/${purchase.id}` }, { label: "Modifier" }]} title={`Modifier ${purchase.number}`} description="Les modifications n'affectent pas le stock tant que l'achat n'est pas réceptionné." />
      <PurchaseForm
        mode="edit"
        initial={{
          id: purchase.id,
          number: purchase.number,
          status: purchase.status,
          supplierId: purchase.supplierId,
          supplierInvoiceNumber: purchase.supplierInvoiceNumber ?? "",
          expectedAt: purchase.expectedAt ?? "",
          notes: purchase.notes ?? "",
          lines,
        }}
        suppliers={suppliers}
        suggestions={suggestions}
        can={{ receive: hasPermission(user.role, "purchases.receive") }}
      />
    </>
  );
}
