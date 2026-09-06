"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Select } from "./input";
import { TableSkeleton, EmptyState } from "./states";
import { formatInteger } from "@/lib/format";

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  /** Hide on small screens */
  hideBelow?: "sm" | "md" | "lg" | "xl";
  width?: string;
};

export type SortState = { sort: string; dir: "asc" | "desc" } | null;

const hideClass: Record<NonNullable<Column<unknown>["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyState,
  sort,
  onSortChange,
  onRowClick,
  rowHref,
  dense,
  className,
  rowClassName,
  footer,
  mobileCard,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  emptyState?: React.ReactNode;
  sort?: SortState;
  onSortChange?: (s: SortState) => void;
  onRowClick?: (row: T) => void;
  rowHref?: (row: T) => string;
  dense?: boolean;
  className?: string;
  rowClassName?: (row: T) => string | undefined;
  footer?: React.ReactNode;
  /** Optional card renderer for narrow screens. */
  mobileCard?: (row: T) => React.ReactNode;
}) {
  const toggleSort = (key: string) => {
    if (!onSortChange) return;
    if (!sort || sort.sort !== key) onSortChange({ sort: key, dir: "asc" });
    else if (sort.dir === "asc") onSortChange({ sort: key, dir: "desc" });
    else onSortChange(null);
  };

  if (loading) return <TableSkeleton cols={Math.min(columns.length, 7)} />;
  if (rows.length === 0) return <>{emptyState ?? <EmptyState title="Aucun résultat" description="Modifiez vos filtres ou votre recherche." />}</>;

  const interactive = Boolean(onRowClick || rowHref);

  return (
    <div className={cn("w-full", className)}>
      {mobileCard ? (
        <div className="divide-y divide-line md:hidden">
          {rows.map((row) => (
            <div key={rowKey(row)} className="p-3">
              {mobileCard(row)}
            </div>
          ))}
        </div>
      ) : null}
      <div className={cn("w-full overflow-x-auto", mobileCard && "hidden md:block")}>
        <table className="w-full min-w-max border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-line bg-slate-50/80">
              {columns.map((c) => {
                const active = sort?.sort === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    style={c.width ? { width: c.width } : undefined}
                    className={cn(
                      "px-3 py-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted first:pl-4 last:pr-4",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                      c.hideBelow && hideClass[c.hideBelow],
                      c.headerClassName,
                    )}
                  >
                    {c.sortable && onSortChange ? (
                      <button type="button" onClick={() => toggleSort(c.key)} className={cn("inline-flex items-center gap-1 rounded hover:text-ink focus-ring", active && "text-ink", c.align === "right" && "flex-row-reverse")}>
                        {c.header}
                        {active ? sort!.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ChevronsUpDown className="size-3 opacity-50" />}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => {
              const href = rowHref?.(row);
              return (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn("group bg-white transition-colors", interactive && "cursor-pointer hover:bg-brand-50/40", rowClassName?.(row))}
                >
                  {columns.map((c, i) => (
                    <td
                      key={c.key}
                      className={cn(
                        "relative px-3 align-middle first:pl-4 last:pr-4",
                        dense ? "py-1.5" : "py-2.5",
                        c.align === "right" && "text-right",
                        c.align === "center" && "text-center",
                        c.hideBelow && hideClass[c.hideBelow],
                        c.className,
                      )}
                    >
                      {href && i === 0 ? (
                        <Link href={href} className="absolute inset-0 z-[1]" aria-label="Ouvrir" tabIndex={-1} />
                      ) : null}
                      <span className={cn(href && i === 0 && "relative z-[2] pointer-events-none")}>{c.cell(row)}</span>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          {footer ? <tfoot>{footer}</tfoot> : null}
        </table>
      </div>
    </div>
  );
}

export function Pagination({ page, pageCount, total, pageSize, onPageChange, onPageSizeChange, className, pageSizes = [25, 50, 100] }: { page: number; pageCount: number; total: number; pageSize: number; onPageChange: (p: number) => void; onPageSizeChange?: (s: number) => void; className?: string; pageSizes?: number[] }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-[12.5px] text-ink-muted", className)}>
      <div className="flex items-center gap-3">
        <span className="tabular">
          {from}–{to} sur {formatInteger(total)}
        </span>
        {onPageSizeChange ? (
          <Select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))} className="h-7 w-auto py-0 text-xs" aria-label="Lignes par page">
            {pageSizes.map((s) => (
              <option key={s} value={s}>
                {s} / page
              </option>
            ))}
          </Select>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Page précédente">
          <ChevronLeft />
        </Button>
        <span className="min-w-16 text-center tabular">
          Page {page} / {pageCount}
        </span>
        <Button variant="ghost" size="icon-sm" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} aria-label="Page suivante">
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
