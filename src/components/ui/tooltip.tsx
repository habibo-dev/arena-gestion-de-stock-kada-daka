"use client";

import * as React from "react";
import { Tooltip as TP } from "radix-ui";
import { cn } from "@/lib/utils";

export const TooltipProvider = TP.Provider;

export function Tooltip({ content, children, side = "top", align = "center", delayDuration = 300, className }: { content: React.ReactNode; children: React.ReactElement; side?: "top" | "bottom" | "left" | "right"; align?: "start" | "center" | "end"; delayDuration?: number; className?: string }) {
  if (!content) return children;
  return (
    <TP.Root delayDuration={delayDuration}>
      <TP.Trigger asChild>{children}</TP.Trigger>
      <TP.Portal>
        <TP.Content side={side} align={align} sideOffset={6} className={cn("z-[60] max-w-xs rounded-md bg-ink px-2.5 py-1.5 text-xs text-white shadow-popover data-[state=delayed-open]:animate-fade-in", className)}>
          {content}
          <TP.Arrow className="fill-ink" />
        </TP.Content>
      </TP.Portal>
    </TP.Root>
  );
}
