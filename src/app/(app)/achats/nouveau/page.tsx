import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/session";
import { hasPermission } from "@/lib/permissions";
import { getPartsByIds } from "@/server/services/parts";
import { getReorderSuggestions } from "@/server/services/purchases";
import { listSuppliers } from "@/server/services/suppliers";
import { PageHeader } from "@/components/ui/misc";
import { PurchaseForm } from "@/components/purchases/purchase-form";
import { spInt, type SearchParams } from "@/lib/search-params";
import { toPickedPart } from "@/lib/picked-part";

export const metadata: Metadata = { title: "Nouvel achat" };

export default async function NewPurchasePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission("purchases.create");
  const params = await searchParams;
  const partId = spInt(params, "piece");
  const supplierParam = spInt(params, "fournisseur");
  const prefillRow = partId ? (getPartsByIds([partId])[0] ?? null) : null;
  const prefill = prefillRow ? toPickedPart(prefillRow) : null;
  const suppliers = listSuppliers().map((s) => ({ id: s.id, name: s.name }));
  const suggestionsRaw = getReorderSuggestions();
  const suggestionParts = new Map(getPartsByIds(suggestionsRaw.map((s) => s.id)).map((p) => [p.id, p]));
  const suggestions = suggestionsRaw.flatMap((s) => {
    const p = suggestionParts.get(s.id);
    return p ? [{ part: toPickedPart(p), supplierId: s.supplierId, supplierName: s.supplierName, suggestedQuantity: s.suggestedQuantity }] : [];
  });
  const prefillSupplier = supplierParam ?? (prefillRow ? suppliers.find((s) => s.name === prefillRow.supplier)?.id ?? null : null);
  return (
    <>
      <PageHeader breadcrumbs={[{ label: "Achats", href: "/achats" }, { label: "Nouvel achat" }]} title="Nouvel achat" description="Choisissez le fournisseur, ajoutez les pièces, puis enregistrez en brouillon, passez la commande ou réceptionnez directement." />
      <PurchaseForm
        mode="create"
        initial={{ supplierId: prefillSupplier, supplierInvoiceNumber: "", expectedAt: "", notes: "", lines: [] }}
        suppliers={suppliers}
        suggestions={suggestions}
        can={{ receive: hasPermission(user.role, "purchases.receive") }}
        prefillPart={prefill}
      />
    </>
  );
}
