"use client";

import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { useQueryState } from "@/hooks/use-query-state";
import { DateRangeFilter, FilterBar, SearchInput } from "@/components/ui/filter-bar";
import { SegmentedControl } from "@/components/ui/misc";
import { buttonVariants } from "@/components/ui/button";

export function DocumentListFilters({ kind, counts, canCreate, canExport }: { kind: "sales" | "purchases"; counts: Record<string, number>; canCreate: boolean; canExport: boolean }) {
  const { get, set, isPending } = useQueryState();
  const q = get("q") ?? "";
  const statut = get("statut") ?? "ALL";
  const from = get("du") ?? "";
  const to = get("au") ?? "";
  const hasFilters = Boolean(q || statut !== "ALL" || from || to);
  const isSales = kind === "sales";
  const options = isSales
    ? [
        { value: "ALL", label: "Toutes", count: counts.ALL },
        { value: "BROUILLON", label: "Brouillons", count: counts.BROUILLON },
        { value: "CONFIRMEE", label: "Confirmées", count: counts.CONFIRMEE },
        { value: "ANNULEE", label: "Annulées", count: counts.ANNULEE },
      ]
    : [
        { value: "ALL", label: "Tous", count: counts.ALL },
        { value: "BROUILLON", label: "Brouillons", count: counts.BROUILLON },
        { value: "COMMANDEE", label: "Commandés", count: counts.COMMANDEE },
        { value: "RECUE", label: "Reçus", count: counts.RECUE },
        { value: "ANNULEE", label: "Annulés", count: counts.ANNULEE },
      ];
  const exportHref = `/api/export?kind=${isSales ? "ventes" : "achats"}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`;
  return (
    <FilterBar
      hasFilters={hasFilters}
      onReset={() => set({ q: null, statut: null, du: null, au: null })}
      trailing={
        <>
          {canExport ? (
            <a href={exportHref} className={buttonVariants({ variant: "secondary", size: "sm" })} download>
              <Download /> <span className="hidden sm:inline">Exporter</span>
            </a>
          ) : null}
          {canCreate ? (
            <Link href={isSales ? "/ventes/nouvelle" : "/achats/nouveau"} className={buttonVariants({ size: "sm" })}>
              <Plus /> {isSales ? "Nouvelle vente" : "Nouvel achat"}
            </Link>
          ) : null}
        </>
      }
    >
      <SearchInput value={q} onChange={(v) => set({ q: v })} placeholder={isSales ? "N° de vente, client, téléphone…" : "N° d'achat, fournisseur, n° facture…"} className="w-full sm:w-72" pending={isPending} />
      <SegmentedControl value={statut} onChange={(v) => set({ statut: v })} options={options} />
      <DateRangeFilter from={from} to={to} onChange={(r) => set({ du: r.from, au: r.to })} />
    </FilterBar>
  );
}
