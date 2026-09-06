"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy, Download, MoreHorizontal, PackagePlus, Pencil, SlidersHorizontal, Eye } from "lucide-react";
import type { PartListItem, Paginated } from "@/server/services/parts";
import { useQueryState } from "@/hooks/use-query-state";
import { DataTable, Pagination, type Column, type SortState } from "@/components/ui/data-table";
import { FilterBar, FilterSelect, SearchInput } from "@/components/ui/filter-bar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { PartThumb, SegmentedControl, Money } from "@/components/ui/misc";
import { QuantityChip, StockBadge } from "@/components/ui/stock-badge";
import { EmptyState } from "@/components/ui/states";
import { setPartActiveAction } from "@/server/actions/parts";
import { useAction } from "@/hooks/use-action";
import { AdjustStockDialog } from "./adjust-stock-dialog";
import { cn } from "@/lib/utils";

export type PartsTableProps = {
  data: Paginated<PartListItem>;
  counters: { total: number; disponible: number; faible: number; rupture: number };
  brands: { id: number; name: string }[];
  categories: { id: number; name: string }[];
  locations: { id: number; code: string }[];
  suppliers: { id: number; name: string }[];
  can: { update: boolean; archive: boolean; adjust: boolean; create: boolean; export: boolean };
  /** "stock" hides prices/actions focus on quantities; "parts" full catalog. */
  mode?: "parts" | "stock";
};

type StatusFilter = "ALL" | "DISPONIBLE" | "FAIBLE" | "RUPTURE" | "ALERTE" | "ARCHIVES";

export function PartsTable({ data, counters, brands, categories, locations, suppliers, can, mode = "parts" }: PartsTableProps) {
  const { get, set, isPending } = useQueryState();
  const router = useRouter();
  const q = get("q") ?? "";
  const statut = ((get("statut") as StatusFilter | null) ?? "ALL") as StatusFilter;
  const sort: SortState = get("tri") ? { sort: get("tri")!, dir: (get("ordre") as "asc" | "desc") ?? "asc" } : null;
  const hasFilters = Boolean(q || (statut && statut !== "ALL") || get("marque") || get("categorie") || get("rayon") || get("fournisseur"));

  const [adjustPart, setAdjustPart] = React.useState<PartListItem | null>(null);
  const archive = useAction(setPartActiveAction, { success: (d) => (d.isActive ? "Pièce restaurée." : "Pièce archivée.") });

  const columns: Column<PartListItem>[] = [
    {
      key: "reference",
      header: "Référence",
      sortable: true,
      cell: (p) => (
        <div className="flex items-center gap-3">
          <PartThumb imagePath={p.imagePath} alt="" size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[13px] font-semibold text-ink">{p.reference}</span>
              {!p.isActive ? <span className="rounded bg-slate-100 px-1 py-px text-[10px] font-medium uppercase text-ink-muted">Archivée</span> : null}
            </div>
            <div className="max-w-[320px] truncate text-[12.5px] text-ink-secondary md:hidden lg:block">{p.designation}</div>
          </div>
        </div>
      ),
    },
    { key: "designation", header: "Désignation", sortable: true, hideBelow: "md", className: "hidden md:table-cell lg:hidden", headerClassName: "hidden md:table-cell lg:hidden", cell: (p) => <span className="line-clamp-2 max-w-[260px] text-[12.5px]">{p.designation}</span> },
    { key: "brand", header: "Marque", sortable: true, hideBelow: "md", cell: (p) => <span className="text-ink-secondary">{p.brand ?? <span className="text-ink-faint">—</span>}</span> },
    { key: "category", header: "Catégorie", hideBelow: "xl", cell: (p) => <span className="text-ink-secondary">{p.category ?? <span className="text-ink-faint">—</span>}</span> },
    { key: "location", header: "Rayon", sortable: true, hideBelow: "lg", cell: (p) => (p.location ? <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px]">{p.location}</span> : <span className="text-ink-faint">—</span>) },
    { key: "quantity", header: "Qté", sortable: true, align: "right", cell: (p) => <QuantityChip quantity={p.quantity} minStock={p.minStock} unit={p.unit} /> },
    ...(mode === "stock"
      ? ([
          { key: "minStock", header: "Min.", align: "right", hideBelow: "sm", cell: (p) => <span className="font-mono text-ink-muted tabular">{p.minStock}</span> },
          { key: "status", header: "Statut", hideBelow: "sm", cell: (p) => <StockBadge status={p.status} size="sm" /> },
          { key: "value", header: "Valeur achat", align: "right", hideBelow: "lg", cell: (p) => <Money value={p.quantity * p.purchasePrice} /> },
        ] as Column<PartListItem>[])
      : ([
          { key: "purchasePrice", header: "Prix d'achat", sortable: true, align: "right", hideBelow: "xl", cell: (p) => <Money value={p.purchasePrice} /> },
          { key: "wholesalePrice", header: "Prix gros", sortable: true, align: "right", hideBelow: "lg", cell: (p) => <Money value={p.wholesalePrice} /> },
          { key: "retailPrice", header: "Prix détail", sortable: true, align: "right", cell: (p) => <Money value={p.retailPrice} className="font-medium" /> },
        ] as Column<PartListItem>[])),
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      width: "48px",
      cell: (p) => (
        <div className="relative z-[3]" onClick={(e) => e.stopPropagation()}>
          <Dropdown>
            <DropdownTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Actions">
                <MoreHorizontal />
              </Button>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownItem onSelect={() => router.push(`/pieces/${p.id}`)}>
                <Eye /> Voir la fiche
              </DropdownItem>
              {can.update ? (
                <DropdownItem onSelect={() => router.push(`/pieces/${p.id}/modifier`)}>
                  <Pencil /> Modifier
                </DropdownItem>
              ) : null}
              {can.adjust ? (
                <DropdownItem onSelect={() => setAdjustPart(p)}>
                  <SlidersHorizontal /> Ajuster le stock
                </DropdownItem>
              ) : null}
              {can.create ? (
                <DropdownItem onSelect={() => router.push(`/pieces/nouvelle?dupliquer=${p.id}`)}>
                  <Copy /> Dupliquer
                </DropdownItem>
              ) : null}
              {can.archive ? (
                <>
                  <DropdownSeparator />
                  <DropdownItem destructive={p.isActive} onSelect={() => void archive.run(p.id, !p.isActive)}>
                    {p.isActive ? (
                      <>
                        <Archive /> Archiver
                      </>
                    ) : (
                      <>
                        <ArchiveRestore /> Restaurer
                      </>
                    )}
                  </DropdownItem>
                </>
              ) : null}
            </DropdownContent>
          </Dropdown>
        </div>
      ),
    },
  ];

  const statusOptions: { value: StatusFilter; label: string; count?: number }[] = [
    { value: "ALL", label: "Toutes", count: counters.total },
    { value: "DISPONIBLE", label: "Disponible", count: counters.disponible },
    { value: "FAIBLE", label: "Stock faible", count: counters.faible },
    { value: "RUPTURE", label: "Rupture", count: counters.rupture },
  ];

  const exportKind = statut === "FAIBLE" ? "stock-faible" : statut === "RUPTURE" ? "ruptures" : "stock";

  return (
    <div className="card overflow-hidden">
      <FilterBar
        hasFilters={hasFilters}
        onReset={() => set({ q: null, statut: null, marque: null, categorie: null, rayon: null, fournisseur: null, tri: null, ordre: null })}
        trailing={
          <>
            {can.export ? (
              <a href={`/api/export?kind=${exportKind}`} className={buttonVariants({ variant: "secondary", size: "sm" })} download>
                <Download /> <span className="hidden sm:inline">Exporter Excel</span>
              </a>
            ) : null}
            {can.create && mode === "parts" ? (
              <Link href="/pieces/nouvelle" className={buttonVariants({ size: "sm" })}>
                <PackagePlus /> Nouvelle pièce
              </Link>
            ) : null}
          </>
        }
      >
        <SearchInput value={q} onChange={(v) => set({ q: v })} placeholder="Référence, OEM, désignation, marque, code-barres…" className="w-full sm:w-80" pending={isPending} />
        <SegmentedControl value={statut === "ALERTE" || statut === "ARCHIVES" ? "ALL" : statut} onChange={(v) => set({ statut: v })} options={statusOptions} className="hidden md:inline-flex" />
        <FilterSelect value={statut} onChange={(v) => set({ statut: v })} allLabel="Tous les statuts" options={[{ value: "DISPONIBLE", label: "Disponible" }, { value: "FAIBLE", label: "Stock faible" }, { value: "RUPTURE", label: "Rupture" }, { value: "ALERTE", label: "Alertes (faible + rupture)" }, { value: "ARCHIVES", label: "Archivées" }]} className="md:hidden" />
        <FilterSelect value={get("marque") ?? "ALL"} onChange={(v) => set({ marque: v })} allLabel="Toutes marques" options={brands.map((b) => ({ value: b.id, label: b.name }))} />
        <FilterSelect value={get("categorie") ?? "ALL"} onChange={(v) => set({ categorie: v })} allLabel="Toutes catégories" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
        <FilterSelect value={get("rayon") ?? "ALL"} onChange={(v) => set({ rayon: v })} allLabel="Tous rayons" options={locations.map((l) => ({ value: l.id, label: `Rayon ${l.code}` }))} className="min-w-32" />
        <FilterSelect value={get("fournisseur") ?? "ALL"} onChange={(v) => set({ fournisseur: v })} allLabel="Tous fournisseurs" options={suppliers.map((s) => ({ value: s.id, label: s.name }))} className="hidden xl:block" />
        {statut === "ALERTE" || statut === "ARCHIVES" ? (
          <span className={cn("hidden rounded-md px-2 py-1 text-[12px] font-medium md:inline", statut === "ALERTE" ? "bg-warning-50 text-warning-700" : "bg-slate-100 text-ink-secondary")}>
            {statut === "ALERTE" ? "Alertes : stock faible + ruptures" : "Pièces archivées"}
            <button type="button" className="ml-1.5 underline" onClick={() => set({ statut: null })}>
              retirer
            </button>
          </span>
        ) : null}
      </FilterBar>

      <div className={cn(isPending && "opacity-60 transition-opacity")}>
        <DataTable
          columns={columns}
          rows={data.items}
          rowKey={(p) => p.id}
          rowHref={(p) => `/pieces/${p.id}`}
          sort={sort}
          onSortChange={(s) => set({ tri: s?.sort ?? null, ordre: s?.dir ?? null }, { resetPage: false })}
          rowClassName={(p) => (!p.isActive ? "opacity-60" : undefined)}
          emptyState={
            <EmptyState
              title={hasFilters ? "Aucune pièce ne correspond" : "Aucune pièce dans le catalogue"}
              description={hasFilters ? "Essayez une autre orthographe, une référence partielle ou retirez des filtres." : "Ajoutez votre première pièce ou importez votre fichier Excel existant."}
              action={
                hasFilters ? (
                  <Button variant="secondary" size="sm" onClick={() => set({ q: null, statut: null, marque: null, categorie: null, rayon: null, fournisseur: null })}>
                    Effacer les filtres
                  </Button>
                ) : can.create ? (
                  <>
                    <Link href="/pieces/nouvelle" className={buttonVariants({ size: "sm" })}>
                      <PackagePlus /> Nouvelle pièce
                    </Link>
                    <Link href="/import-export" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                      Importer un fichier Excel
                    </Link>
                  </>
                ) : undefined
              }
            />
          }
          mobileCard={(p) => (
            <Link href={`/pieces/${p.id}`} className="flex items-start gap-3">
              <PartThumb imagePath={p.imagePath} alt="" size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[13px] font-semibold">{p.reference}</span>
                  <QuantityChip quantity={p.quantity} minStock={p.minStock} />
                </div>
                <p className="mt-0.5 line-clamp-2 text-[12.5px] text-ink-secondary">{p.designation}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-muted">
                  {p.brand ? <span>{p.brand}</span> : null}
                  {p.location ? <span>Rayon {p.location}</span> : null}
                  <span className="ml-auto font-medium text-ink">
                    <Money value={p.retailPrice} />
                  </span>
                </div>
              </div>
            </Link>
          )}
        />
      </div>
      <Pagination page={data.page} pageCount={data.pageCount} total={data.total} pageSize={data.pageSize} onPageChange={(p) => set({ page: p }, { resetPage: false })} onPageSizeChange={(s) => set({ taille: s })} />

      {adjustPart ? <AdjustStockDialog open onOpenChange={(o) => !o && setAdjustPart(null)} part={{ id: adjustPart.id, reference: adjustPart.reference, designation: adjustPart.designation, quantity: adjustPart.quantity, unit: adjustPart.unit }} /> : null}
    </div>
  );
}
