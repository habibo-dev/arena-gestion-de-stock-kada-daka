"use client";

import Link from "next/link";
import { useQueryState } from "@/hooks/use-query-state";
import { FilterBar, FilterSelect, SearchInput } from "@/components/ui/filter-bar";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import type { VehicleListItem } from "@/server/services/vehicles";
import { NewVehicleButton } from "./vehicle-dialog";

const FUELS = ["Diesel", "Essence", "GPL", "Hybride", "Électrique"];

export function VehiclesList({ vehicles, makes, canManage }: { vehicles: VehicleListItem[]; makes: { id: number; name: string }[]; canManage: boolean }) {
  const { get, set, isPending } = useQueryState();
  const q = get("q") ?? "";
  const marque = get("marque") ?? "ALL";
  const carburant = get("carburant") ?? "ALL";
  const hasFilters = Boolean(q || marque !== "ALL" || carburant !== "ALL");

  const groups = new Map<string, VehicleListItem[]>();
  for (const v of vehicles) {
    const key = `${v.make} ${v.model}${v.generation ? ` ${v.generation}` : ""}`;
    const arr = groups.get(key);
    if (arr) arr.push(v);
    else groups.set(key, [v]);
  }

  return (
    <div className="card overflow-hidden">
      <FilterBar hasFilters={hasFilters} onReset={() => set({ q: null, marque: null, carburant: null })} trailing={canManage ? <NewVehicleButton makes={makes.map((m) => m.name)} /> : null}>
        <SearchInput value={q} onChange={(v) => set({ q: v })} placeholder="clio 4, k9k, 1.5 dci, 208…" className="w-full sm:w-72" pending={isPending} />
        <FilterSelect value={marque} onChange={(v) => set({ marque: v === "ALL" ? null : v })} allLabel="Toutes les marques" options={makes.map((m) => ({ value: m.id, label: m.name }))} />
        <FilterSelect value={carburant} onChange={(v) => set({ carburant: v === "ALL" ? null : v })} allLabel="Tous carburants" options={FUELS.map((f) => ({ value: f, label: f }))} />
      </FilterBar>
      {vehicles.length === 0 ? (
        <EmptyState title="Aucun véhicule" description={hasFilters ? "Aucune motorisation ne correspond à ces critères." : "Ajoutez les véhicules de votre clientèle pour rattacher les pièces compatibles."} action={canManage && !hasFilters ? <NewVehicleButton makes={makes.map((m) => m.name)} /> : undefined} />
      ) : (
        <div className="divide-y divide-line">
          {[...groups.entries()].map(([label, rows]) => {
            const first = rows[0]!;
            const yf = Math.min(...rows.map((r) => r.yearFrom ?? 9999));
            const yt = rows.some((r) => r.yearTo === null) ? null : Math.max(...rows.map((r) => r.yearTo ?? 0));
            return (
              <section key={label}>
                <header className="flex flex-wrap items-baseline justify-between gap-2 bg-slate-50/70 px-4 py-2">
                  <h3 className="text-[13.5px] font-semibold">
                    {first.make} <span className="text-ink">{first.model}</span> {first.generation ? <span className="text-ink-secondary">{first.generation}</span> : null}
                  </h3>
                  <span className="text-[12px] text-ink-muted">
                    {yf !== 9999 ? `${yf} – ${yt ?? "…"}` : ""} · {rows.length} motorisation{rows.length > 1 ? "s" : ""}
                  </span>
                </header>
                <ul className="divide-y divide-line/70">
                  {rows.map((v) => (
                    <li key={v.id} className="relative flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-[13px] hover:bg-brand-50/40 sm:flex-nowrap">
                      <Link href={`/vehicules/${v.id}`} className="min-w-[160px] flex-1 font-medium text-ink after:absolute after:inset-0">
                        {v.engineLabel}
                      </Link>
                      <span className="w-24 font-mono text-[12px] text-ink-secondary">{v.engineCode ?? "—"}</span>
                      <span className="w-20 text-ink-secondary">{v.fuel ?? "—"}</span>
                      <span className="w-16 text-ink-secondary tabular">{v.powerHp ? `${v.powerHp} ch` : "—"}</span>
                      <span className="w-24 text-ink-secondary tabular">{v.yearFrom ? `${v.yearFrom}–${v.yearTo ?? "…"}` : "—"}</span>
                      <span className="flex w-44 items-center justify-end gap-1.5">
                        <Badge variant={v.partCount ? "brand" : "neutral"} size="sm">
                          {v.partCount} pièce{v.partCount > 1 ? "s" : ""}
                        </Badge>
                        {v.partCount ? (
                          <Badge variant={v.verifiedCount === v.partCount ? "success" : "warning"} size="sm">
                            {v.verifiedCount} vérifiée{v.verifiedCount > 1 ? "s" : ""}
                          </Badge>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          <p className="px-4 py-2 text-[12px] text-ink-muted">
            {vehicles.length} motorisation{vehicles.length > 1 ? "s" : ""} · {groups.size} modèle{groups.size > 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
