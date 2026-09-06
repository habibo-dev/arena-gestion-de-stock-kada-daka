import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, invalid, leftIcon, rightSlot, type = "text", ...props }, ref) => {
  const input = (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-9 w-full rounded-lg border border-line-strong bg-white px-3 text-sm text-ink placeholder:text-ink-faint shadow-xs transition-colors focus-ring focus:border-brand-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-ink-muted",
        invalid && "border-danger-600 focus:border-danger-600 focus-visible:ring-danger-600/30",
        leftIcon && "pl-9",
        rightSlot && "pr-10",
        className,
      )}
      {...props}
    />
  );
  if (!leftIcon && !rightSlot) return input;
  return (
    <div className="relative w-full">
      {leftIcon ? <span className="pointer-events-none absolute inset-y-0 left-0 flex w-9 items-center justify-center text-ink-faint [&_svg]:size-4">{leftIcon}</span> : null}
      {input}
      {rightSlot ? <span className="absolute inset-y-0 right-0 flex items-center pr-2">{rightSlot}</span> : null}
    </div>
  );
});
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "min-h-20 w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-faint shadow-xs transition-colors focus-ring focus:border-brand-500 disabled:cursor-not-allowed disabled:bg-slate-50",
        invalid && "border-danger-600",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  ({ className, invalid, children, ...props }, ref) => (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-9 w-full appearance-none rounded-lg border border-line-strong bg-white bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat pr-8 pl-3 text-sm text-ink shadow-xs transition-colors focus-ring focus:border-brand-500 disabled:cursor-not-allowed disabled:bg-slate-50",
        invalid && "border-danger-600",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export function Label({ className, required, children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={cn("mb-1.5 block text-[13px] font-medium text-ink-secondary", className)} {...props}>
      {children}
      {required ? <span className="ml-0.5 text-danger-600">*</span> : null}
    </label>
  );
}

export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-danger-600">{message}</p>;
}

export function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs text-ink-muted">{children}</p>;
}

export function Field({ label, required, error, hint, htmlFor, children, className }: { label?: string; required?: boolean; error?: string | null; hint?: React.ReactNode; htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      {label ? (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      ) : null}
      {children}
      <FieldError message={error} />
      {!error && hint ? <FieldHint>{hint}</FieldHint> : null}
    </div>
  );
}

export function Checkbox({ className, label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: React.ReactNode }) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2 text-sm text-ink", props.disabled && "cursor-not-allowed opacity-60", className)}>
      <input type="checkbox" className="size-4 rounded border-line-strong text-brand-600 focus-ring accent-brand-600" {...props} />
      {label}
    </label>
  );
}

export function Switch({ checked, onCheckedChange, disabled, label, description }: { checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean; label?: React.ReactNode; description?: React.ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3", disabled && "cursor-not-allowed opacity-60")}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn("relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-ring", checked ? "bg-brand-600" : "bg-slate-300")}
      >
        <span className={cn("inline-block size-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-4.5" : "translate-x-0.5")} />
      </button>
      {label || description ? (
        <span className="flex flex-col">
          {label ? <span className="text-sm font-medium text-ink">{label}</span> : null}
          {description ? <span className="text-xs text-ink-muted">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}
