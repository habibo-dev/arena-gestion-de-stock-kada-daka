"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/result";

/**
 * Small helper around server actions returning `ActionResult`.
 * Handles pending state, toasts and router refresh in one place.
 */
export function useAction<A extends unknown[], T>(
  action: (...args: A) => Promise<ActionResult<T>>,
  opts?: { success?: string | ((data: T) => string); onSuccess?: (data: T) => void; refresh?: boolean; silent?: boolean },
) {
  const [pending, setPending] = React.useState(false);
  const router = useRouter();
  const run = React.useCallback(
    async (...args: A): Promise<ActionResult<T>> => {
      setPending(true);
      try {
        const res = await action(...args);
        if (res.ok) {
          if (opts?.success && !opts.silent) toast.success(typeof opts.success === "function" ? opts.success(res.data) : opts.success);
          opts?.onSuccess?.(res.data);
          if (opts?.refresh !== false) router.refresh();
        } else if (!opts?.silent) {
          toast.error(res.error);
        }
        return res;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur inattendue";
        if (!opts?.silent) toast.error(message);
        return { ok: false, error: message };
      } finally {
        setPending(false);
      }
    },
    [action, opts, router],
  );
  return { run, pending };
}
