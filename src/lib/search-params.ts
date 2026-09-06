/** Helpers to read Next.js `searchParams` safely (server components). */
export type SearchParams = Record<string, string | string[] | undefined>;

export function sp(params: SearchParams, key: string): string | undefined {
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

export function spInt(params: SearchParams, key: string, fallback?: number): number | undefined {
  const v = sp(params, key);
  if (v === undefined || v === "") return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function spEnum<T extends string>(params: SearchParams, key: string, allowed: readonly T[], fallback: T): T {
  const v = sp(params, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export function spPage(params: SearchParams): { page: number; pageSize: number } {
  return { page: Math.max(1, spInt(params, "page", 1) ?? 1), pageSize: Math.min(100, Math.max(10, spInt(params, "taille", 25) ?? 25)) };
}
