"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  size = "md",
  hideClose,
  ...props
}: Omit<React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>, "title"> & { title: React.ReactNode; description?: React.ReactNode; size?: "sm" | "md" | "lg" | "xl" | "full"; hideClose?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-line bg-white shadow-popover focus:outline-none data-[state=open]:animate-slide-up",
          size === "sm" && "max-w-md",
          size === "md" && "max-w-lg",
          size === "lg" && "max-w-2xl",
          size === "xl" && "max-w-4xl",
          size === "full" && "max-w-6xl",
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-[15px] font-semibold text-ink">{title}</DialogPrimitive.Title>
            {description ? <DialogPrimitive.Description className="mt-0.5 text-[13px] text-ink-muted">{description}</DialogPrimitive.Description> : <DialogPrimitive.Description className="sr-only">Dialogue</DialogPrimitive.Description>}
          </div>
          {!hideClose ? (
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Fermer">
                <X />
              </Button>
            </DialogPrimitive.Close>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("-mx-5 -mb-4 mt-4 flex flex-col-reverse gap-2 border-t border-line bg-slate-50/60 px-5 py-3 sm:flex-row sm:justify-end", className)}>{children}</div>;
}

/* ------------------------------------------------------------------------- */
/*  Confirm dialog                                                            */
/* ------------------------------------------------------------------------- */

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "primary",
  loading,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger" | "success";
  loading?: boolean;
  onConfirm: () => unknown;
  children?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <DialogContent title={title} description={description} size="sm">
        {children}
        <DialogFooter className={children ? "" : "mt-0"}>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={() => void onConfirm()} loading={loading}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
