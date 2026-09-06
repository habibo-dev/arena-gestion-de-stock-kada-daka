"use client";

import * as React from "react";
import { DropdownMenu as DM } from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dropdown = DM.Root;
export const DropdownTrigger = DM.Trigger;
export const DropdownGroup = DM.Group;
export const DropdownSub = DM.Sub;
export const DropdownSubTrigger = DM.SubTrigger;
export const DropdownSubContent = DM.SubContent;
export const DropdownRadioGroup = DM.RadioGroup;

export function DropdownContent({ className, sideOffset = 6, align = "end", ...props }: React.ComponentPropsWithoutRef<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        sideOffset={sideOffset}
        align={align}
        className={cn("z-50 min-w-44 overflow-hidden rounded-lg border border-line bg-white p-1 text-ink shadow-popover data-[state=open]:animate-slide-up", className)}
        {...props}
      />
    </DM.Portal>
  );
}

export function DropdownItem({ className, destructive, ...props }: React.ComponentPropsWithoutRef<typeof DM.Item> & { destructive?: boolean }) {
  return (
    <DM.Item
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-[13px] outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-slate-100 [&_svg]:size-4 [&_svg]:text-ink-muted",
        destructive && "text-danger-700 data-[highlighted]:bg-danger-50 [&_svg]:text-danger-600",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownCheckboxItem({ className, children, checked, ...props }: React.ComponentPropsWithoutRef<typeof DM.CheckboxItem>) {
  return (
    <DM.CheckboxItem checked={checked} className={cn("relative flex cursor-pointer select-none items-center gap-2 rounded-md py-1.5 pl-7 pr-2 text-[13px] outline-none data-[highlighted]:bg-slate-100", className)} {...props}>
      <span className="absolute left-2 flex size-4 items-center justify-center">
        <DM.ItemIndicator>
          <Check className="size-3.5" />
        </DM.ItemIndicator>
      </span>
      {children}
    </DM.CheckboxItem>
  );
}

export function DropdownLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof DM.Label>) {
  return <DM.Label className={cn("px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint", className)} {...props} />;
}

export function DropdownSeparator({ className, ...props }: React.ComponentPropsWithoutRef<typeof DM.Separator>) {
  return <DM.Separator className={cn("-mx-1 my-1 h-px bg-line", className)} {...props} />;
}
