"use client";

import { Download } from "lucide-react";
import { useQueryState } from "@/hooks/use-query-state";
import { DateRangeFilter } from "@/components/ui/filter-bar";
import { SegmentedControl } from "@/components/ui/misc";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { REPORT_TABS, type ReportTab } from "@/lib/report-tabs";

const PRESETS: { label: string; days: number }[] = [
  { label: "7 j", days: 7 },
  { label: "30 j", days: 30 },
  { label: "90 j", days: 90 },
  { label: "12 mois", days: 365 },
];

function iso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ReportsToolbar({ tab, from, to, dated, exportKind, canExport }: { tab: ReportTab; from: string; to: string; dated: boolean; exportKind: string | null; canExport: boolean }) {
  const { set } = useQueryState();
  const exportHref = exportKind ? `/api/export?kind=${exportKind}${dated ? `&from=${from}&to=${to}` : ""}` : null;
  return (
    <div className="card mb-4 flex flex-col gap-3 p-3">
      <div className="overflow-x-auto">
        <SegmentedControl value={tab} onChange={(v) => set({ onglet: v })} options={REPORT_TABS.map((t) => ({ value: t.value, label: t.label }))} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {dated ? (
          <>
            <DateRangeFilter from={from} to={to} onChange={(r) => set({ du: r.from, au: r.to })} />
            <div className="inline-flex items-center gap-1">
              {PRESETS.map((p) => {
                const end = new Date();
                const start = new Date();
                start.setDate(end.getDate() - p.days + 1);
                const active = from === iso(start) && to === iso(end);
                return (
                  <button key={p.days} type="button" onClick={() => set({ du: iso(start), au: iso(end) })} className={cn("rounded-md border px-2 py-1 text-[12px] font-medium", active ? "border-brand-200 bg-brand-50 text-brand-700" : "border-line bg-white text-ink-secondary hover:bg-slate-50")}>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-[12.5px] text-ink-muted">Rapport instantané : reflète l&apos;état actuel du stock.</p>
        )}
        <div className="ml-auto">
          {canExport && exportHref ? (
            <a href={exportHref} download className={buttonVariants({ variant: "secondary", size: "sm" })}>
              <Download /> Exporter en Excel
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
