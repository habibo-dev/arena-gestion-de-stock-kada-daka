import * as React from "react";
import Link from "next/link";
import { ChevronRight, ImageIcon, type LucideIcon } from "lucide-react";
import { cn, initials, partImageUrl } from "@/lib/utils";

/* ------------------------------ Page header -------------------------------- */

export function PageHeader({ title, description, actions, breadcrumbs, className, badge }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; breadcrumbs?: { label: string; href?: string }[]; className?: string; badge?: React.ReactNode }) {
  return (
    <div className={cn("mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        {breadcrumbs?.length ? (
          <nav aria-label="Fil d'Ariane" className="mb-1.5 flex items-center gap-1 text-[12.5px] text-ink-muted">
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={`${b.label}-${i}`}>
                {i > 0 ? <ChevronRight className="size-3.5 text-ink-faint" /> : null}
                {b.href ? (
                  <Link href={b.href} className="hover:text-ink">
                    {b.label}
                  </Link>
                ) : (
                  <span className="text-ink">{b.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        ) : null}
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="truncate text-xl font-semibold tracking-tight text-ink md:text-[22px]">{title}</h1>
          {badge}
        </div>
        {description ? <p className="mt-1 text-[13.5px] text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* --------------------------------- Avatar ---------------------------------- */

export function Avatar({ name, className, size = "md" }: { name: string; className?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800", size === "sm" && "size-7 text-[11px]", size === "md" && "size-8 text-xs", size === "lg" && "size-10 text-sm", className)} aria-hidden>
      {initials(name)}
    </span>
  );
}

/* ------------------------------- Part thumb -------------------------------- */

export function PartThumb({ imagePath, alt, size = "md", className }: { imagePath: string | null | undefined; alt: string; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const url = partImageUrl(imagePath);
  const dim = size === "sm" ? "size-9" : size === "md" ? "size-12" : size === "lg" ? "size-20" : "size-40";
  return (
    <span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-slate-50 text-ink-faint", dim, className)}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        <ImageIcon className={cn(size === "sm" ? "size-4" : size === "md" ? "size-5" : "size-8")} />
      )}
    </span>
  );
}

/* ---------------------------------- Stat ----------------------------------- */

export function StatsCard({ label, value, hint, icon: Icon, tone = "neutral", href, className, trend }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: LucideIcon; tone?: "neutral" | "brand" | "success" | "warning" | "danger" | "info"; href?: string; className?: string; trend?: { value: number; label?: string } }) {
  const toneClass = {
    neutral: "bg-slate-100 text-ink-secondary",
    brand: "bg-brand-50 text-brand-700",
    success: "bg-success-50 text-success-700",
    warning: "bg-warning-50 text-warning-700",
    danger: "bg-danger-50 text-danger-700",
    info: "bg-info-50 text-info-700",
  }[tone];
  const body = (
    <div className={cn("card flex items-start gap-4 p-4 transition-shadow", href && "hover:shadow-panel", className)}>
      {Icon ? (
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", toneClass)}>
          <Icon className="size-5" />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-medium text-ink-muted">{label}</p>
        <p className="mt-0.5 truncate text-[22px] font-semibold tracking-tight tabular text-ink">{value}</p>
        {hint || trend ? (
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-muted">
            {trend ? (
              <span className={cn("font-medium tabular", trend.value > 0 && "text-success-700", trend.value < 0 && "text-danger-700")}>
                {trend.value > 0 ? "+" : ""}
                {trend.value.toFixed(0)} %
              </span>
            ) : null}
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-card focus-ring">
      {body}
    </Link>
  ) : (
    body
  );
}

/* --------------------------------- Tabs ------------------------------------ */

export function SegmentedControl<T extends string>({ value, onChange, options, className, size = "md" }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode; count?: number }[]; className?: string; size?: "sm" | "md" }) {
  return (
    <div className={cn("inline-flex items-center gap-0.5 rounded-lg border border-line bg-slate-50 p-0.5", className)} role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md font-medium transition-colors focus-ring",
              size === "md" ? "h-7 px-2.5 text-[12.5px]" : "h-6 px-2 text-xs",
              active ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink",
            )}
          >
            {o.label}
            {o.count !== undefined ? <span className={cn("rounded px-1 font-mono text-[10.5px] tabular", active ? "bg-slate-100 text-ink-secondary" : "bg-slate-200/60 text-ink-muted")}>{o.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function Money({ value, className, compact }: { value: number; className?: string; compact?: boolean }) {
  const formatted = new Intl.NumberFormat("fr-DZ", { minimumFractionDigits: compact ? 0 : 2, maximumFractionDigits: compact ? 0 : 2 }).format(value ?? 0);
  return (
    <span className={cn("tabular whitespace-nowrap", className)}>
      {formatted}
      <span className="ml-1 text-[0.85em] text-ink-muted">DA</span>
    </span>
  );
}

export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("font-mono text-[12.5px] tracking-tight", className)}>{children}</span>;
}
