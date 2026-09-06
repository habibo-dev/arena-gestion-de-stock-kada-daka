import * as React from "react";
import { CircleAlert, Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function EmptyState({ icon: Icon = Inbox, title, description, action, className, compact }: { icon?: LucideIcon; title: string; description?: React.ReactNode; action?: React.ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "px-4 py-8" : "px-6 py-16", className)}>
      <div className={cn("mb-3 flex items-center justify-center rounded-full bg-slate-100 text-ink-muted", compact ? "size-10 [&_svg]:size-5" : "size-14 [&_svg]:size-7")}>
        <Icon />
      </div>
      <h3 className={cn("font-semibold text-ink", compact ? "text-sm" : "text-[15px]")}>{title}</h3>
      {description ? <p className={cn("mt-1 max-w-sm text-ink-muted", compact ? "text-xs" : "text-[13px]")}>{description}</p> : null}
      {action ? <div className="mt-4 flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title = "Une erreur s'est produite", description, retry, className }: { title?: string; description?: React.ReactNode; retry?: () => void; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-card border border-danger-100 bg-danger-50/40 px-6 py-12 text-center", className)}>
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-danger-100 text-danger-600">
        <CircleAlert className="size-6" />
      </div>
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {description ? <p className="mt-1 max-w-md text-[13px] text-ink-muted">{description}</p> : null}
      {retry ? (
        <Button variant="secondary" size="sm" className="mt-4" onClick={retry}>
          Réessayer
        </Button>
      ) : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4 w-full", className)} />;
}

export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-line">
      <div className="flex gap-4 px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn("h-3.5 flex-1", c === 0 && "max-w-28", c === cols - 1 && "max-w-16")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("card p-5", className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-32" />
      <Skeleton className="mt-2 h-3 w-40" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-3.5 w-80" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <div className="card overflow-hidden">
        <TableSkeleton />
      </div>
    </div>
  );
}

export function LoadingState({ label = "Chargement…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 py-12 text-sm text-ink-muted", className)}>
      <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
      {label}
    </div>
  );
}

export function InlineAlert({ variant = "info", title, children, className, icon }: { variant?: "info" | "warning" | "danger" | "success"; title?: React.ReactNode; children?: React.ReactNode; className?: string; icon?: React.ReactNode }) {
  return (
    <div
      role={variant === "danger" ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-lg border px-3.5 py-3 text-[13px]",
        variant === "info" && "border-info-100 bg-info-50 text-info-700",
        variant === "warning" && "border-warning-100 bg-warning-50 text-warning-700",
        variant === "danger" && "border-danger-100 bg-danger-50 text-danger-700",
        variant === "success" && "border-success-100 bg-success-50 text-success-700",
        className,
      )}
    >
      {icon ? <span className="mt-0.5 shrink-0 [&_svg]:size-4">{icon}</span> : null}
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5 opacity-90")}>{children}</div> : null}
      </div>
    </div>
  );
}
