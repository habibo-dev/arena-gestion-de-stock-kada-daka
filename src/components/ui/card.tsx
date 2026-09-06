import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card", className)} {...props} />;
}

export function CardHeader({ className, title, description, actions, ...props }: Omit<React.HTMLAttributes<HTMLDivElement>, "title"> & { title?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-3.5", className)} {...props}>
      <div className="min-w-0">
        {title ? <h3 className="text-[14px] font-semibold text-ink">{title}</h3> : null}
        {description ? <p className="mt-0.5 text-[12.5px] text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-between gap-3 border-t border-line bg-slate-50/50 px-5 py-3 text-[13px]", className)} {...props} />;
}

export function SectionTitle({ children, className, actions }: { children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">{children}</h2>
      {actions}
    </div>
  );
}

export function DescriptionList({ items, className, columns = 2 }: { items: { label: string; value: React.ReactNode; mono?: boolean; span?: boolean }[]; className?: string; columns?: 1 | 2 | 3 }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3", columns === 1 && "grid-cols-1", columns === 2 && "grid-cols-1 sm:grid-cols-2", columns === 3 && "grid-cols-1 sm:grid-cols-3", className)}>
      {items.map((it) => (
        <div key={it.label} className={cn(it.span && "sm:col-span-full")}>
          <dt className="text-[11.5px] font-medium uppercase tracking-wide text-ink-faint">{it.label}</dt>
          <dd className={cn("mt-0.5 text-[13.5px] text-ink", it.mono && "font-mono")}>{it.value ?? <span className="text-ink-faint">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
