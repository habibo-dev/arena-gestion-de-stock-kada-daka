"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Keeps list filters in the URL (shareable, back-button friendly) and gives a
 * transition-aware setter so tables can show a pending state while the server
 * component re-renders.
 */
export function useQueryState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const set = React.useCallback(
    (patch: Record<string, string | number | boolean | null | undefined>, opts?: { resetPage?: boolean; replace?: boolean }) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === null || v === "" || v === false || v === "ALL") params.delete(k);
        else params.set(k, String(v));
      }
      if (opts?.resetPage !== false && !("page" in patch)) params.delete("page");
      const qs = params.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      startTransition(() => {
        if (opts?.replace) router.replace(url, { scroll: false });
        else router.push(url, { scroll: false });
      });
    },
    [router, pathname, searchParams],
  );

  const get = React.useCallback((key: string) => searchParams.get(key), [searchParams]);

  return { get, set, isPending, params: searchParams };
}
