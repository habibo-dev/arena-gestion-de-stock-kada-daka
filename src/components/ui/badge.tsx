import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4 [&_svg]:size-3", {
  variants: {
    variant: {
      neutral: "border-line bg-slate-50 text-ink-secondary",
      outline: "border-line-strong bg-white text-ink-secondary",
      success: "border-success-100 bg-success-50 text-success-700",
      warning: "border-warning-100 bg-warning-50 text-warning-700",
      danger: "border-danger-100 bg-danger-50 text-danger-700",
      info: "border-info-100 bg-info-50 text-info-700",
      brand: "border-brand-100 bg-brand-50 text-brand-700",
      dark: "border-ink bg-ink text-white",
      violet: "border-violet-100 bg-violet-50 text-violet-700",
    },
    size: {
      sm: "px-1.5 py-0 text-[10.5px]",
      md: "",
      lg: "px-2 py-1 text-xs",
    },
  },
  defaultVariants: { variant: "neutral", size: "md" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, variant, size, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

export { badgeVariants };
