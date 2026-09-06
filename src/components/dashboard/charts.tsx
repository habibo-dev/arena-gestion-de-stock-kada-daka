"use client";

import * as React from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatAmount, formatInteger } from "@/lib/format";

const AXIS = { fontSize: 11, fill: "#64748b" };
const GRID = "#e2e8f0";
export const PALETTE = ["#2563eb", "#0ea5e9", "#14b8a6", "#f59e0b", "#8b5cf6", "#ef4444", "#64748b", "#84cc16", "#ec4899", "#0f172a"];

function ChartTooltip({ active, payload, label, money }: { active?: boolean; payload?: { name?: string; value?: number | string; color?: string; payload?: Record<string, unknown> }[]; label?: string; money?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-[12px] shadow-popover">
      {label ? <p className="mb-1 font-semibold text-ink">{label}</p> : null}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-ink-secondary">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name} : <span className="font-medium tabular text-ink">{money ? `${formatAmount(Number(p.value))} DA` : formatInteger(Number(p.value))}</span>
        </p>
      ))}
    </div>
  );
}

export function SalesAreaChart({ data }: { data: { label: string; total: number; margin: number; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={52} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
        <Tooltip content={<ChartTooltip money />} cursor={{ stroke: "#94a3b8", strokeDasharray: "3 3" }} />
        <Area type="monotone" dataKey="total" name="Ventes" stroke="#2563eb" strokeWidth={2} fill="url(#salesFill)" activeDot={{ r: 4 }} />
        <Area type="monotone" dataKey="margin" name="Marge" stroke="#14b8a6" strokeWidth={1.5} fill="transparent" strokeDasharray="4 3" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function StockLineChart({ data }: { data: { label: string; quantity: number }[] }) {
  const min = Math.min(...data.map((d) => d.quantity));
  const max = Math.max(...data.map((d) => d.quantity));
  const pad = Math.max(10, Math.round((max - min) * 0.2));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="stockFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f172a" stopOpacity={0.12} />
            <stop offset="100%" stopColor="#0f172a" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={52} domain={[Math.max(0, min - pad), max + pad]} tickFormatter={(v: number) => formatInteger(v)} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#94a3b8", strokeDasharray: "3 3" }} />
        <Area type="stepAfter" dataKey="quantity" name="Quantité en stock" stroke="#0f172a" strokeWidth={2} fill="url(#stockFill)" activeDot={{ r: 4 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function TopPartsBarChart({ data }: { data: { reference: string; designation: string; quantity: number; total: number }[] }) {
  const rows = data.map((d) => ({ ...d, name: d.reference }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, rows.length * 34)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap={8}>
        <CartesianGrid stroke={GRID} horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={{ ...AXIS, fontFamily: "var(--font-mono)", fill: "#0f172a" }} axisLine={false} tickLine={false} width={110} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="quantity" name="Quantité vendue" fill="#2563eb" radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CategoryDonut({ data }: { data: { category: string; value: number; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const top = data.slice(0, 7);
  const rest = data.slice(7);
  const rows = rest.length ? [...top, { category: "Autres", value: rest.reduce((s, d) => s + d.value, 0), count: rest.reduce((s, d) => s + d.count, 0) }] : top;
  return (
    <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-center">
      <div className="relative mx-auto h-[180px] w-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="category" innerRadius={58} outerRadius={84} paddingAngle={2} strokeWidth={0}>
              {rows.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip money />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">Valeur</span>
          <span className="text-[13px] font-semibold tabular">{formatAmount(total)} DA</span>
        </div>
      </div>
      <ul className="space-y-1.5 text-[12.5px]">
        {rows.map((r, i) => (
          <li key={r.category} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="flex-1 truncate text-ink-secondary">{r.category}</span>
            <span className="text-ink-faint tabular">{r.count} réf.</span>
            <span className="w-14 text-right font-medium tabular">{total ? `${Math.round((r.value / total) * 100)} %` : "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
