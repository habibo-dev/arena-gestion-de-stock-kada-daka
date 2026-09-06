"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PALETTE } from "@/components/dashboard/charts";
import { formatAmount, formatInteger } from "@/lib/format";

const AXIS = { fontSize: 11, fill: "#64748b" };
const GRID = "#e2e8f0";

function Tip({ active, payload, label, money }: { active?: boolean; payload?: { name?: string; value?: number | string; color?: string }[]; label?: string; money?: boolean }) {
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

export function ValueByCategoryBars({ data }: { data: { category: string; purchaseValue: number; retailValue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" tick={AXIS} tickFormatter={(v: number) => formatAmount(v)} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="category" tick={AXIS} width={140} axisLine={false} tickLine={false} />
        <Tooltip content={<Tip money />} cursor={{ fill: "#f1f5f9" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="purchaseValue" name="Valeur d'achat" fill={PALETTE[0]} radius={[0, 4, 4, 0]} />
        <Bar dataKey="retailValue" name="Valeur détail" fill={PALETTE[3]} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DailyBars({ data, name, money = true }: { data: { label: string; value: number }[]; name: string; money?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v: number) => (money ? formatAmount(v) : formatInteger(v))} width={70} />
        <Tooltip content={<Tip money={money} />} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="value" name={name} fill={PALETTE[0]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ShareDonut({ data, money = true }: { data: { name: string; value: number }[]; money?: boolean }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <ResponsiveContainer width="100%" height={200} className="sm:max-w-[220px]">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} strokeWidth={0}>
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip content={<Tip money={money} />} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="w-full space-y-1 text-[12.5px]">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="flex-1 truncate text-ink-secondary">{d.name}</span>
            <span className="tabular font-medium">{money ? `${formatAmount(d.value)} DA` : formatInteger(d.value)}</span>
            <span className="w-12 text-right tabular text-ink-muted">{total > 0 ? `${Math.round((d.value / total) * 100)} %` : "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function InOutBars({ data }: { data: { label: string; entrees: number; sorties: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={48} />
        <Tooltip content={<Tip />} cursor={{ fill: "#f1f5f9" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="entrees" name="Entrées" fill={PALETTE[2]} radius={[4, 4, 0, 0]} />
        <Bar dataKey="sorties" name="Sorties" fill={PALETTE[5]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
