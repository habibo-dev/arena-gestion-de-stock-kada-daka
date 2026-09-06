"use client";

import Link from "next/link";
import { Download, SlidersHorizontal } from "lucide-react";
import { useQueryState } from "@/hooks/use-query-state";
import { DateRangeFilter, FilterBar, FilterSelect, SearchInput } from "@/components/ui/filter-bar";
import { buttonVariants } from "@/components/ui/button";
import { MOVEMENT_TYPE_LABELS } from "@/lib/stock";

export function MovementsFilters({ canAdjust, canExport, partLabel }: { canAdjust: boolean; canExport: boolean; partLabel?: string | null }) {
  const { get, set, isPending } = useQueryState();
  const q = get("q") ?? "";
  const type = get("type") ?? "ALL";
  const from = get("du") ?? "";
  const to = get("au") ?? "";
  const hasFilters = Boolean(q || type !== "ALL" || from || to || get("piece"));
  const exportHref = `/api/export?kind=mouvements${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`;
  return (
    <FilterBar
      hasFilters={hasFilters}
      onReset={() => set({ q: null, type: null, du: null, au: null, piece: null })}
      trailing={
        <>
          {canExport ? (
            <a href={exportHref} className={buttonVariants({ variant: "secondary", size: "sm" })} download>
              <Download /> <span className="hidden sm:inline">Exporter</span>
            </a>
          ) : null}
          {canAdjust ? (
            <Link href="/mouvements/ajustement" className={buttonVariants({ size: "sm" })}>
              <SlidersHorizontal /> Ajuster un stock
            </Link>
          ) : null}
        </>
      }
    >
      <SearchInput value={q} onChange={(v) => set({ q: v })} placeholder="Référence, désignation, motif, n° document…" className="w-full sm:w-72" pending={isPending} />
      <FilterSelect
        value={type}
        onChange={(v) => set({ type: v })}
        allLabel="Tous les types"
        options={[{ value: "IN", label: "Entrées (+)" }, { value: "OUT", label: "Sorties (−)" }, ...Object.entries(MOVEMENT_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))]}
      />
      <DateRangeFilter from={from} to={to} onChange={(r) => set({ du: r.from, au: r.to })} />
      {partLabel ? (
        <span className="rounded-md bg-brand-50 px-2 py-1 text-[12px] font-medium text-brand-800">
          Pièce : <span className="font-mono">{partLabel}</span>
          <button type="button" className="ml-1.5 underline" onClick={() => set({ piece: null })}>
            retirer
          </button>
        </span>
      ) : null}
    </FilterBar>
  );
}
