"use client";

import * as React from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Input, Select } from "./input";
import { Button } from "./button";
import { useDebouncedCallback } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

export function SearchInput({ value, onChange, placeholder = "Rechercher…", className, pending, autoFocus, delay = 300 }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; pending?: boolean; autoFocus?: boolean; delay?: number }) {
  const [local, setLocal] = React.useState(value);
  React.useEffect(() => setLocal(value), [value]);
  const debounced = useDebouncedCallback((v: string) => onChange(v), delay);
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
      <Input
        value={local}
        autoFocus={autoFocus}
        onChange={(e) => {
          setLocal(e.target.value);
          debounced(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") onChange(local);
          if (e.key === "Escape") {
            setLocal("");
            onChange("");
          }
        }}
        placeholder={placeholder}
        className="pl-8 pr-8"
        aria-label={placeholder}
      />
      <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center">
        {pending ? (
          <Loader2 className="size-4 animate-spin text-ink-muted" />
        ) : local ? (
          <button
            type="button"
            onClick={() => {
              setLocal("");
              onChange("");
            }}
            className="rounded p-0.5 text-ink-muted hover:bg-slate-100 hover:text-ink"
            aria-label="Effacer la recherche"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </span>
    </div>
  );
}

export function FilterSelect({ value, onChange, options, allLabel, className, ariaLabel }: { value: string; onChange: (v: string) => void; options: { value: string | number; label: string }[]; allLabel?: string; className?: string; ariaLabel?: string }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className={cn("w-auto min-w-36", value && value !== "ALL" && "border-brand-300 bg-brand-50/50 text-brand-800", className)} aria-label={ariaLabel ?? allLabel}>
      {allLabel ? <option value="ALL">{allLabel}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

export function FilterBar({ children, onReset, hasFilters, className, trailing }: { children: React.ReactNode; onReset?: () => void; hasFilters?: boolean; className?: string; trailing?: React.ReactNode }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5", className)}>
      {children}
      {hasFilters && onReset ? (
        <Button variant="ghost" size="sm" onClick={onReset}>
          <X /> Réinitialiser
        </Button>
      ) : null}
      {trailing ? <div className="ml-auto flex items-center gap-2">{trailing}</div> : null}
    </div>
  );
}

export function DateRangeFilter({ from, to, onChange, className }: { from: string; to: string; onChange: (r: { from: string; to: string }) => void; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Input type="date" value={from} onChange={(e) => onChange({ from: e.target.value, to })} className="w-[150px]" aria-label="Du" />
      <span className="text-[12px] text-ink-muted">→</span>
      <Input type="date" value={to} onChange={(e) => onChange({ from, to: e.target.value })} className="w-[150px]" aria-label="Au" />
    </div>
  );
}
