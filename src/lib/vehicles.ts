import { normalizeText } from "./references";

const ROMAN_VALUES: Record<string, number> = { i: 1, v: 5, x: 10 };

/** "IV" → 4, "III" → 3, "V (6R)" → 5, "Phase II" → null (not leading). */
export function leadingRomanToArabic(generation: string | null | undefined): number | null {
  if (!generation) return null;
  const m = /^([ivx]+)\b/i.exec(generation.trim());
  if (!m) return null;
  const s = m[1]!.toLowerCase();
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = ROMAN_VALUES[s[i]!] ?? 0;
    const next = ROMAN_VALUES[s[i + 1] ?? ""] ?? 0;
    total += cur < next ? -cur : cur;
  }
  return total > 0 ? total : null;
}

export type VehicleSearchInput = {
  make: string;
  model: string;
  generation?: string | null;
  aliases?: string | null;
  engineLabel: string;
  engineCode?: string | null;
  fuel?: string | null;
  displacement?: string | null;
  yearFrom?: number | null;
  yearTo?: number | null;
};

/**
 * Builds the denormalised, normalised search text for a vehicle so that
 * "clio 4", "clio iv", "clio4", "k9k", "1.5 dci", "r19" all match.
 */
export function buildVehicleSearchText(v: VehicleSearchInput): string {
  const gen = v.generation ?? "";
  const arabic = leadingRomanToArabic(gen);
  const modelCompact = normalizeText(v.model).replace(/\s+/g, "");
  const parts: (string | number | null | undefined)[] = [
    v.make,
    v.model,
    modelCompact !== normalizeText(v.model) ? modelCompact : null,
    gen,
    arabic,
    arabic ? `${modelCompact}${arabic}` : null,
    v.aliases,
    v.engineLabel,
    v.engineCode,
    v.fuel,
    v.displacement,
    v.yearFrom,
    v.yearTo,
  ];
  return normalizeText(parts.filter((p) => p !== null && p !== undefined && p !== "").join(" "));
}

export function vehicleLabel(v: { make: string; model: string; generation?: string | null; engineLabel: string }): string {
  return [v.make, v.model, v.generation, v.engineLabel].filter(Boolean).join(" ");
}

export const FUEL_OPTIONS = ["Diesel", "Essence", "GPL", "Hybride", "Électrique"] as const;
