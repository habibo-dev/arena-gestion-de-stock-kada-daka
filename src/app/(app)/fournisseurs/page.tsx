import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/session";
import { hasPermission } from "@/lib/permissions";
import { listSuppliers } from "@/server/services/suppliers";
import { sp, type SearchParams } from "@/lib/search-params";
import { PageHeader } from "@/components/ui/misc";
import { SuppliersList } from "@/components/suppliers/suppliers-list";

export const metadata: Metadata = { title: "Fournisseurs" };

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePermission("suppliers.view");
  const params = await searchParams;
  const suppliers = listSuppliers({ q: sp(params, "q"), includeInactive: sp(params, "inactifs") === "1" });
  return (
    <>
      <PageHeader title="Fournisseurs" description="Coordonnées, pièces fournies et historique des achats par fournisseur." />
      <SuppliersList suppliers={suppliers} canManage={hasPermission(user.role, "suppliers.manage")} />
    </>
  );
}
