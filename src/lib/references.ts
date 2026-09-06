/**
 * Reference normalisation helpers.
 *
 * Automotive references are messy: "0 986 494 090", "0986494090", "0986-494-090"
 * and "0986.494.090" all designate the same Bosch part. We therefore store a
 * normalised form (uppercase, alphanumerics only) alongside the original value
 * and match on the normalised form.
 */

/** Uppercase, strip every non-alphanumeric character. */
export function normalizeReference(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Split a raw reference cell into individual references.
 * Handles "7703800107 / 8200651172", "A / B", "A;B", "A , B", "A | B", line breaks…
 */
export function splitReferences(raw: string): string[] {
  if (!raw) return [];
  const parts = raw
    .split(/\s*(?:\/|;|,|\||\n|\r|\s{2,}|\s\+\s|\sou\s|\sOU\s)\s*/g)
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const n = normalizeReference(p);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(p);
  }
  return out;
}

/** Does the value look like a part reference (rather than a word)? */
export function looksLikeReference(token: string): boolean {
  const n = normalizeReference(token);
  if (n.length < 4) return false;
  const digits = (n.match(/[0-9]/g) ?? []).length;
  return digits >= 3 || (digits >= 2 && /^[A-Z]{1,3}[0-9]/.test(n));
}

/**
 * Lightweight text normalisation for search: lowercase, strip accents,
 * collapse whitespace. Keeps punctuation that matters ("1.5").
 */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
