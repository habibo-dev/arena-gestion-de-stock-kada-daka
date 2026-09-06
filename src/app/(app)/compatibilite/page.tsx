import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Car, CircleHelp, Link2, Search } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { hasPermission } from "@/lib/permissions";
import { compatibilityCoverageByMake, getCompatibilityStats, getVehicle, listPartsWithoutCompatibility, listUnverifiedCompatibilities } from "@/server/services/vehicles";
import { formatInteger, formatPercent } from "@/lib/format";
import { spInt, type SearchParams } from "@/lib/search-params";
import { PageHeader, StatsCard, Money, PartThumb } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, InlineAlert } from "@/components/ui/states";
import { StockBadge } from "@/components/ui/stock-badge";
import { buttonVariants } from "@/components/ui/button";
import { CompatStatusBadge } from "@/components/parts/compatibility-editor";
import { CompatReviewList } from "@/components/compatibility/compat-review";
import { VehicleLookup } from "@/components/compatibility/vehicle-lookup";

export const metadata: Metadata = { title: "Compatibilité" };

export default async function CompatibilityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission("vehicles.view");
  const params = await searchParams;
  const vehicleId = spInt(params, "vehicule");
  const vehicle = vehicleId ? getVehicle(vehicleId) : null;
  const stats = getCompatibilityStats();
  const coverage = compatibilityCoverageByMake();
  const pending = listUnverifiedCompatibilities(60);
  const missing = listPartsWithoutCompatibility(40);
  const canManage = hasPermission(user.role, "compatibility.manage");
  const verifiedPct = stats.total ? (stats.verified / stats.total) * 100 : 0;
  const coveredPct = stats.activeParts ? (stats.partsWithVehicles / stats.activeParts) * 100 : 0;
  const vehicleLabel = vehicle ? [vehicle.model.make.name, vehicle.model.name, vehicle.model.generation, vehicle.engineLabel].filter(Boolean).join(" ") : null;
  const vehicleParts = vehicle ? vehicle.parts.filter((p) => p.isActive) : [];

  return (
    <>
      <PageHeader title="Compatibilité pièces ↔ véhicules" description="Quelles pièces vont sur quel véhicule. Une compatibilité est « vérifiée » uniquement quand votre équipe l'a confirmée ; nous n'inventons aucune correspondance." />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Associations" value={formatInteger(stats.total)} hint={`${formatInteger(stats.vehicles)} motorisations`} icon={Link2} tone="brand" />
        <StatsCard label="Vérifiées" value={formatPercent(verifiedPct, 0)} hint={`${formatInteger(stats.verified)} sur ${formatInteger(stats.total)}`} icon={BadgeCheck} tone={verifiedPct >= 80 ? "success" : "warning"} />
        <StatsCard label="À vérifier" value={formatInteger(stats.total - stats.verified)} hint="déclarées, non confirmées" icon={CircleHelp} tone={stats.total - stats.verified > 0 ? "warning" : "neutral"} />
        <StatsCard label="Pièces couvertes" value={formatPercent(coveredPct, 0)} hint={`${formatInteger(stats.activeParts - stats.partsWithVehicles)} pièce${stats.activeParts - stats.partsWithVehicles > 1 ? "s" : ""} sans véhicule`} icon={Car} tone={coveredPct >= 70 ? "success" : "neutral"} />
      </div>

      <Card className="mb-4">
        <CardHeader title="Rechercher par véhicule" description="Sélectionnez une motorisation pour lister toutes les pièces compatibles enregistrées, avec leur stock." />
        <CardBody>
          <VehicleLookup selectedId={vehicle?.id ?? null} selectedLabel={vehicleLabel} />
        </CardBody>
        {vehicle ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-slate-50/60 px-5 py-2.5 text-[13px]">
              <p>
                <span className="font-semibold">{vehicleLabel}</span>
                <span className="ml-2 text-ink-muted">{[vehicle.engineCode, vehicle.fuel, vehicle.powerHp ? `${vehicle.powerHp} ch` : null].filter(Boolean).join(" · ")}</span>
              </p>
              <div className="flex items-center gap-2">
                <Link href={`/vehicules/${vehicle.id}`} className="text-[12.5px] font-medium text-brand-700 hover:underline">
                  Fiche véhicule
                </Link>
                <Link href={`/recherche?q=${encodeURIComponent(vehicleLabel ?? "")}`} className={buttonVariants({ variant: "secondary", size: "xs" })}>
                  <Search /> Recherche intelligente
                </Link>
              </div>
            </div>
            {vehicleParts.length === 0 ? (
              <EmptyState compact title="Aucune pièce compatible enregistrée" description="Aucune donnée de compatibilité pour cette motorisation : associez des pièces depuis leur fiche (section Compatibilité)." />
            ) : (
              <ul className="divide-y divide-line">
                {vehicleParts.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                    <PartThumb imagePath={p.imagePath} alt="" size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2">
                        <Link href={`/pieces/${p.id}`} className="font-mono font-semibold text-brand-700 hover:underline">
                          {p.reference}
                        </Link>
                        {p.brand ? <span className="text-[12px] text-ink-muted">{p.brand}</span> : null}
                        <CompatStatusBadge status={p.compatStatus} />
                      </p>
                      <p className="truncate text-ink-secondary">
                        {p.designation}
                        {p.category ? <span className="text-ink-muted"> · {p.category}</span> : null}
                      </p>
                    </div>
                    <div className="hidden text-right tabular sm:block">
                      <Money value={p.wholesalePrice} /> <span className="text-ink-faint">/</span> <Money value={p.retailPrice} />
                    </div>
                    <span className="hidden w-14 text-right font-mono text-[12px] text-ink-secondary md:block">{p.location ?? "—"}</span>
                    <StockBadge quantity={p.quantity} minStock={p.minStock} size="sm" />
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="File de vérification" description={`${pending.length} compatibilité${pending.length > 1 ? "s" : ""} déclarée${pending.length > 1 ? "s" : ""} en attente de confirmation${pending.length >= 60 ? " (60 premières)" : ""}.`} />
          {canManage ? null : (
            <div className="px-4 pt-3">
              <InlineAlert variant="info">Seuls les gérants et administrateurs peuvent vérifier ou retirer une compatibilité.</InlineAlert>
            </div>
          )}
          <CompatReviewList rows={pending} canManage={canManage} />
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Couverture par marque" />
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line bg-slate-50/80 text-left text-[11.5px] uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-2 font-semibold">Marque</th>
                  <th className="px-2 py-2 text-right font-semibold">Motor.</th>
                  <th className="px-2 py-2 text-right font-semibold">Pièces</th>
                  <th className="px-4 py-2 text-right font-semibold">Vérifiées</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {coverage.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-1.5">
                      <Link href={`/vehicules?marque=${m.id}`} className="font-medium hover:underline">
                        {m.name}
                      </Link>
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono tabular">{m.vehicles}</td>
                    <td className="px-2 py-1.5 text-right font-mono tabular">{m.parts}</td>
                    <td className="px-4 py-1.5 text-right font-mono tabular text-ink-secondary">{m.links ? `${Math.round((m.verified / m.links) * 100)} %` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card>
            <CardHeader title="Pièces sans véhicule" description="Données manquantes, pas des pièces universelles." />
            {missing.length === 0 ? (
              <EmptyState compact title="Toutes les pièces ont au moins un véhicule" />
            ) : (
              <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
                {missing.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 px-4 py-2 text-[12.5px]">
                    <div className="min-w-0 flex-1">
                      <Link href={`/pieces/${p.id}`} className="font-mono font-semibold text-brand-700 hover:underline">
                        {p.reference}
                      </Link>
                      <p className="truncate text-ink-secondary">{p.designation}</p>
                    </div>
                    <StockBadge quantity={p.quantity} minStock={p.minStock} size="sm" />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
