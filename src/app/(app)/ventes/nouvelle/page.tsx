import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/session";
import { hasPermission } from "@/lib/permissions";
import { getSetting } from "@/server/services/settings";
import { getPartsByIds } from "@/server/services/parts";
import { PageHeader } from "@/components/ui/misc";
import { SaleForm } from "@/components/sales/sale-form";
import { spInt, type SearchParams } from "@/lib/search-params";

export const metadata: Metadata = { title: "Nouvelle vente" };

export default async function NewSalePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePermission("sales.create");
  const params = await searchParams;
  const partId = spInt(params, "piece");
  const prefill = partId ? (getPartsByIds([partId])[0] ?? null) : null;
  const defaultTier = getSetting("sales.defaultPriceTier") === "GROS" ? "GROS" : "DETAIL";
  return (
    <>
      <PageHeader breadcrumbs={[{ label: "Ventes", href: "/ventes" }, { label: "Nouvelle vente" }]} title="Nouvelle vente" description="Ajoutez les pièces, choisissez le tarif (gros ou détail), puis confirmez pour déduire le stock." />
      <SaleForm
        mode="create"
        initial={{ customerId: null, customerName: "", customerPhone: "", priceTier: defaultTier, paymentMethod: "ESPECES", discountType: "NONE", discountValue: 0, notes: "", lines: [] }}
        allowNegativeStock={getSetting("stock.allowNegative") === "true"}
        can={{ confirm: hasPermission(user.role, "sales.confirm") }}
        prefillPart={prefill}
      />
    </>
  );
}
