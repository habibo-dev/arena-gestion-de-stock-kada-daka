import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white", className)} aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 15v-3a2 2 0 0 1 2-2h1l2-4h6l2 4h1a2 2 0 0 1 2 2v3" />
        <path d="M3 15h18" />
        <circle cx="7.5" cy="17.5" r="1.5" />
        <circle cx="16.5" cy="17.5" r="1.5" />
        <path d="M9 6V4m6 2V4" />
      </svg>
    </span>
  );
}

export function Logo({ variant = "dark", compact, href = "/" }: { variant?: "dark" | "light"; compact?: boolean; href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 focus-ring rounded-md">
      <LogoMark />
      {!compact ? (
        <span className={cn("text-[15px] font-semibold tracking-tight", variant === "light" ? "text-white" : "text-ink")}>
          Auto<span className="text-brand-500">Stock</span>
        </span>
      ) : null}
    </Link>
  );
}
