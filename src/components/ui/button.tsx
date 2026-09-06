import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800",
        secondary: "border border-line-strong bg-white text-ink shadow-sm hover:bg-slate-50 active:bg-slate-100",
        ghost: "text-ink-secondary hover:bg-slate-100 hover:text-ink",
        danger: "bg-danger-600 text-white shadow-sm hover:bg-danger-700",
        "danger-outline": "border border-danger-600/30 bg-white text-danger-700 hover:bg-danger-50",
        success: "bg-success-600 text-white shadow-sm hover:bg-success-700",
        link: "text-brand-600 underline-offset-4 hover:underline",
        dark: "bg-ink text-white hover:bg-slate-800",
      },
      size: {
        xs: "h-7 px-2 text-xs [&_svg]:size-3.5",
        sm: "h-8 px-3 text-[13px] [&_svg]:size-4",
        md: "h-9 px-3.5 [&_svg]:size-4",
        lg: "h-10 px-4 text-[15px] [&_svg]:size-4.5",
        icon: "size-9 [&_svg]:size-4",
        "icon-sm": "size-8 [&_svg]:size-4",
        "icon-xs": "size-7 [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} disabled={disabled || loading} {...props}>
        {loading ? <LoaderCircle className="animate-spin" /> : null}
        {asChild ? children : <>{children}</>}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
