import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Search } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { hasPermission } from "@/lib/permissions";
import { getVehicle, listMakes } from "@/server/services/vehicles";
import { PageHeader, Money, PartThumb } from "@/components/ui/misc";
import { Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/card";
import { EmptyState, InlineAlert } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { StockBadge } from "@/components/ui/stock-badge";
import { buttonVariants } from "@/components/ui/button";
import { VehicleHeaderActions } from "@/components/vehicles/vehicle-dialog";
import { CompatStatusBadge } from "@/components/parts/compatibility-editor";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const v = getVehicle(Number(id));
  return { title: v ? `${v.model.make.name} ${v.model.name} ${v.engineLabel}` : "Véhicule introuvable" };
}

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("vehicles.view");
  const { id } = await params;
  const vehicleId = Number(id);
  if (!Number.isInteger(vehicleId)) notFound();
  const vehicle = getVehicle(vehicleId);
  if (!vehicle) notFound();
  const title = [vehicle.model.make.name, vehicle.model.name, vehicle.model.generation].filter(Boolean).join(" ");
  const activeParts = vehicle.parts.filter((p) => p.isActive);
  const verified = activeParts.filter((p) => p.compatStatus === "VERIFIED").length;
  const inStock = activeParts.filter((p) => p.quantity > 0).length;
  const byCategory = new Map<string, typeof activeParts>();
  for (const p of activeParts) {
    const key = p.category ?? "Sans catégorie";
    const arr = byCategory.get(key);
    if (arr) arr.push(p);
    else byCategory.set(key, [p]);
  }
  const searchQuery = [vehicle.model.make.name, vehicle.model.name, vehicle.model.generation, vehicle.engineLabel].filter(Boolean).join(" ");

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Véhicules", href: "/vehicules" }, { label: `${title} ${vehicle.engineLabel}` }]}
        title={
          <span>
            {title} <span className="text-ink-secondary">{vehicle.engineLabel}</span>
          </span>
        }
        description={[vehicle.engineCode ? `Code moteur ${vehicle.engineCode}` : null, vehicle.fuel, vehicle.powerHp ? `${vehicle.powerHp} ch` : null, vehicle.yearFrom ? `${vehicle.yearFrom} – ${vehicle.yearTo ?? "…"}` : null].filter(Boolean).join(" · ")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/recherche?q=${encodeURIComponent(searchQuery)}`} className={buttonVariants({ variant: "secondary" })}>
              <Search /> Rechercher pour ce véhicule
            </Link>
            <VehicleHeaderActions
              vehicle={{ id: vehicle.id, makeName: vehicle.model.make.name, modelName: vehicle.model.name, generation: vehicle.model.generation, engineLabel: vehicle.engineLabel, displacement: vehicle.displacement, fuel: vehicle.fuel, powerHp: vehicle.powerHp, engineCode: vehicle.engineCode, yearFrom: vehicle.yearFrom, yearTo: vehicle.yearTo }}
              makes={listMakes().map((m) => m.name)}
              partCount={vehicle.parts.length}
              canManage={hasPermission(user.role, "vehicles.manage")}
            />
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="Pièces compatibles"
              description={activeParts.length ? `${activeParts.length} pièce${activeParts.length > 1 ? "s" : ""} · ${verified} vérifiée${verified > 1 ? "s" : ""} · ${inStock} en stock` : "Aucune pièce rattachée."}
            />
            {activeParts.length === 0 ? (
              <EmptyState compact title="Aucune compatibilité enregistrée" description="Rattachez des pièces à cette motorisation depuis la fiche pièce (onglet Compatibilité) ou la page Compatibilité." />
            ) : (
              <>
                {verified < activeParts.length ? (
                  <div className="px-4 pt-3">
                    <InlineAlert variant="warning" title={`${activeParts.length - verified} compatibilité${activeParts.length - verified > 1 ? "s" : ""} non vérifiée${activeParts.length - verified > 1 ? "s" : ""}`}>
                      Une compatibilité « non vérifiée » est déclarée (import, catalogue, saisie rapide) mais n&apos;a pas été confirmée : vérifiez avant de garantir le montage.
                    </InlineAlert>
                  </div>
                ) : null}
                <div className="divide-y divide-line">
                  {[...byCategory.entries()].map(([cat, rows]) => (
                    <section key={cat}>
                      <h3 className="bg-slate-50/70 px-4 py-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted">{cat}</h3>
                      <ul className="divide-y divide-line/70">
                        {rows.map((p) => (
                          <li key={p.id} className={cn("flex items-center gap-3 px-4 py-2.5 text-[13px]", p.quantity <= 0 && "bg-danger-50/20")}>
                            <PartThumb imagePath={p.imagePath} alt="" size="sm" />
                            <div className="min-w-0 flex-1">
                              <p className="flex flex-wrap items-center gap-x-2">
                                <Link href={`/pieces/${p.id}`} className="font-mono font-semibold text-brand-700 hover:underline">
                                  {p.reference}
                                </Link>
                                {p.brand ? <span className="text-[12px] text-ink-muted">{p.brand}</span> : null}
                                <CompatStatusBadge status={p.compatStatus} />
                              </p>
                              <p className="truncate text-ink-secondary">{p.designation}</p>
                              {p.compatNote ? <p className="truncate text-[11.5px] text-ink-muted">{p.compatNote}</p> : null}
                            </div>
                            <div className="hidden text-right sm:block">
                              <p className="text-[11px] uppercase tracking-wide text-ink-faint">Gros / Détail</p>
                              <p className="tabular">
                                <Money value={p.wholesalePrice} /> <span className="text-ink-faint">/</span> <Money value={p.retailPrice} />
                              </p>
                            </div>
                            <div className="hidden w-16 text-right font-mono text-[12px] text-ink-secondary md:block">{p.location ?? "—"}</div>
                            <StockBadge quantity={p.quantity} minStock={p.minStock} size="sm" />
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Fiche technique" />
            <CardBody>
              <DescriptionList
                columns={1}
                items={[
                  { label: "Marque", value: vehicle.model.make.name },
                  { label: "Modèle", value: vehicle.model.name },
                  { label: "Génération", value: vehicle.model.generation ?? "—" },
                  { label: "Années", value: vehicle.yearFrom ? `${vehicle.yearFrom} – ${vehicle.yearTo ?? "aujourd'hui"}` : "—" },
                  { label: "Motorisation", value: vehicle.engineLabel },
                  { label: "Cylindrée", value: vehicle.displacement ?? "—" },
                  { label: "Carburant", value: vehicle.fuel ?? "—" },
                  { label: "Puissance", value: vehicle.powerHp ? `${vehicle.powerHp} ch${vehicle.powerKw ? ` (${vehicle.powerKw} kW)` : ""}` : "—" },
                  { label: "Code moteur", value: vehicle.engineCode ?? "—", mono: true },
                ]}
              />
            </CardBody>
          </Card>
          {vehicle.siblings.length > 1 ? (
            <Card>
              <CardHeader title="Autres motorisations" description={`${vehicle.model.make.name} ${vehicle.model.name}${vehicle.model.generation ? ` ${vehicle.model.generation}` : ""}`} />
              <ul className="divide-y divide-line">
                {vehicle.siblings
                  .filter((s) => s.id !== vehicle.id)
                  .map((s) => (
                    <li key={s.id}>
                      <Link href={`/vehicules/${s.id}`} className="flex items-center justify-between px-4 py-2 text-[13px] hover:bg-brand-50/40">
                        <span className="font-medium">{s.engineLabel}</span>
                        <span className="flex items-center gap-2 text-[12px] text-ink-muted">
                          {s.engineCode ? <span className="font-mono">{s.engineCode}</span> : null}
                          {s.fuel ? <Badge variant="neutral" size="sm">{s.fuel}</Badge> : null}
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
