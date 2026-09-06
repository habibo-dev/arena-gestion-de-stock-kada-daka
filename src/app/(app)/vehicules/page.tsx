import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/session";
import { hasPermission } from "@/lib/permissions";
import { listMakes, listVehicles } from "@/server/services/vehicles";
import { sp, spInt, type SearchParams } from "@/lib/search-params";
import { PageHeader } from "@/components/ui/misc";
import { VehiclesList } from "@/components/vehicles/vehicles-list";

export const metadata: Metadata = { title: "Véhicules" };

export default async function VehiclesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission("vehicles.view");
  const params = await searchParams;
  const fuel = sp(params, "carburant");
  const vehicles = listVehicles({ q: sp(params, "q"), makeId: spInt(params, "marque") ?? undefined, fuel: fuel && fuel !== "ALL" ? fuel : undefined });
  const makes = listMakes().map((m) => ({ id: m.id, name: m.name }));
  return (
    <>
      <PageHeader title="Véhicules" description="Marques, modèles, générations et motorisations utilisés pour la compatibilité des pièces." />
      <VehiclesList vehicles={vehicles} makes={makes} canManage={hasPermission(user.role, "vehicles.manage")} />
    </>
  );
}
