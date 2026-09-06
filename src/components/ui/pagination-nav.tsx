"use client";

import { useQueryState } from "@/hooks/use-query-state";
import { Pagination } from "./data-table";

/** URL-driven pagination footer for server-rendered lists. */
export function PaginationNav({ page, pageCount, total, pageSize, pageSizes }: { page: number; pageCount: number; total: number; pageSize: number; pageSizes?: number[] }) {
  const { set } = useQueryState();
  return <Pagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} pageSizes={pageSizes} onPageChange={(p) => set({ page: p }, { resetPage: false })} onPageSizeChange={(s) => set({ taille: s })} />;
}
