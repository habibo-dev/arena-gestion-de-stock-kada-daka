import "server-only";
import { LocalOcrProvider } from "./local-ocr";
import { RemoteVisionProvider } from "./remote";
import type { VisionAnalysis, VisionProvider } from "./types";
import { getSqlite } from "@/server/db/client";
import { looksLikeReference, normalizeReference, normalizeText } from "@/lib/references";
import { searchParts, type SearchHit } from "@/server/services/search";

export type { VisionAnalysis, VisionProvider } from "./types";

/* -------------------------------------------------------------------------- */
/*  Provider registry                                                         */
/* -------------------------------------------------------------------------- */

export function getVisionProvider(): VisionProvider {
  const url = process.env.VISION_API_URL?.trim();
  const key = process.env.VISION_API_KEY?.trim();
  if (url && key) return new RemoteVisionProvider(url, key);
  return new LocalOcrProvider();
}

export async function getVisionStatus(): Promise<{ providerId: string; label: string; available: boolean; mode: "local" | "remote" }> {
  const p = getVisionProvider();
  return { providerId: p.id, label: p.label, available: await p.isAvailable(), mode: p.id === "remote-vision" ? "remote" : "local" };
}

/* -------------------------------------------------------------------------- */
/*  Candidate extraction                                                      */
/* -------------------------------------------------------------------------- */

export type ImageSearchCandidate = {
  value: string;
  kind: "reference" | "brand" | "keyword";
  confidence: number;
  source: string;
};

export type ImageSearchResult = {
  analysis: Omit<VisionAnalysis, "blocks"> & { blocks: VisionAnalysis["blocks"] };
  candidates: ImageSearchCandidate[];
  matches: (SearchHit & { confidence: number; matchedOn: string })[];
  status: "matches" | "candidates-only" | "no-text";
};

/** OCR frequently confuses O/0, I/1, S/5, B/8 — generate a few variants for reference lookup. */
function ocrVariants(token: string): string[] {
  const base = normalizeReference(token);
  const variants = new Set<string>([base]);
  const swaps: [RegExp, string][] = [
    [/O/g, "0"],
    [/0/g, "O"],
    [/I/g, "1"],
    [/L/g, "1"],
    [/S/g, "5"],
    [/B/g, "8"],
    [/Z/g, "2"],
  ];
  for (const [re, rep] of swaps) {
    const v = base.replace(re, rep);
    if (v !== base) variants.add(v);
  }
  return [...variants];
}

export function extractCandidates(analysis: VisionAnalysis): ImageSearchCandidate[] {
  const sqlite = getSqlite();
  const brandRows = sqlite.prepare(`SELECT name, normalized_name AS n FROM brands`).all() as { name: string; n: string }[];
  const candidates: ImageSearchCandidate[] = [];
  const seen = new Set<string>();
  const push = (c: ImageSearchCandidate) => {
    const k = `${c.kind}:${normalizeReference(c.value) || c.value}`;
    if (seen.has(k)) return;
    seen.add(k);
    candidates.push(c);
  };

  for (const block of analysis.blocks) {
    const text = block.text;
    const norm = normalizeText(text);
    // Brands
    for (const b of brandRows) {
      if (b.n.length >= 3 && new RegExp(`(^|[^a-z])${b.n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(norm)) {
        push({ value: b.name, kind: "brand", confidence: Math.max(0.5, block.confidence), source: text });
      }
    }
    // Reference-like tokens: allow inner spaces / separators in Bosch-style numbers "0 986 494 090"
    const compact = text.replace(/[\s.\-/]+/g, "");
    if (looksLikeReference(compact) && compact.length >= 6 && compact.length <= 20) {
      push({ value: compact, kind: "reference", confidence: block.confidence, source: text });
    }
    for (const tok of text.split(/[\s,;|]+/)) {
      const clean = tok.replace(/[^A-Za-z0-9\-/.]/g, "");
      if (looksLikeReference(clean) && normalizeReference(clean).length >= 5) {
        push({ value: clean, kind: "reference", confidence: block.confidence, source: text });
      } else if (clean.length >= 4 && /^[A-Za-z]+$/.test(clean)) {
        const w = normalizeText(clean);
        if (["plaquette", "plaquettes", "filtre", "filter", "disque", "disc", "brake", "pad", "pads", "oil", "huile", "air", "fuel", "gasoil", "diesel", "kit", "courroie", "belt", "amortisseur", "shock", "bougie", "spark", "plug", "batterie", "battery", "embrayage", "clutch", "roulement", "bearing", "pompe", "pump", "radiateur", "radiator", "thermostat", "rotule", "ball", "joint", "lampe", "bulb"].includes(w)) {
          push({ value: w, kind: "keyword", confidence: block.confidence * 0.8, source: text });
        }
      }
    }
  }
  for (const b of analysis.brands) push({ value: b, kind: "brand", confidence: 0.7, source: "provider" });
  for (const l of analysis.labels) push({ value: l.label, kind: "keyword", confidence: l.confidence, source: "provider" });

  return candidates.sort((a, b) => (a.kind === "reference" ? 0 : 1) - (b.kind === "reference" ? 0 : 1) || b.confidence - a.confidence).slice(0, 20);
}

/* -------------------------------------------------------------------------- */
/*  End-to-end image search                                                   */
/* -------------------------------------------------------------------------- */

export async function searchByImage(image: { bytes: Buffer; mimeType: string }): Promise<ImageSearchResult> {
  const provider = getVisionProvider();
  const analysis = await provider.analyze(image);
  const candidates = extractCandidates(analysis);
  const sqlite = getSqlite();

  const matches = new Map<number, SearchHit & { confidence: number; matchedOn: string }>();
  const upsert = (hit: SearchHit, confidence: number, matchedOn: string) => {
    const cur = matches.get(hit.id);
    if (!cur || cur.confidence < confidence) matches.set(hit.id, { ...hit, confidence, matchedOn });
  };

  // 1) References: exact (incl. OCR variants) then partial
  for (const c of candidates.filter((c) => c.kind === "reference")) {
    for (const v of ocrVariants(c.value)) {
      const exact = sqlite
        .prepare(`SELECT id FROM parts WHERE reference_normalized = ? UNION SELECT part_id FROM part_references WHERE reference_normalized = ?`)
        .all(v, v) as { id: number }[];
      if (exact.length) {
        const res = searchParts(v, { limit: 5, includeInactive: false });
        for (const h of res.hits.filter((h) => exact.some((e) => e.id === h.id))) {
          upsert(h, Math.min(0.97, 0.75 + c.confidence * 0.22), `Référence lue « ${c.source.trim()} »`);
        }
      }
    }
    if (normalizeReference(c.value).length >= 6) {
      const partial = searchParts(c.value, { limit: 5 });
      for (const h of partial.hits) {
        if (!matches.has(h.id)) upsert(h, Math.min(0.7, 0.35 + c.confidence * 0.3) * h.score, `Référence partielle « ${c.value} »`);
      }
    }
  }

  // 2) Brand + keywords combination (weaker evidence)
  const brands = candidates.filter((c) => c.kind === "brand").map((c) => c.value);
  const keywords = candidates.filter((c) => c.kind === "keyword").map((c) => c.value);
  if (brands.length || keywords.length) {
    const q = [...brands.slice(0, 1), ...keywords.slice(0, 2)].join(" ");
    if (q.trim()) {
      const res = searchParts(q, { limit: 8 });
      for (const h of res.hits) {
        if (!matches.has(h.id)) upsert(h, Math.min(0.45, 0.2 + h.score * 0.25), `Marque / mots-clés « ${q} »`);
      }
    }
  }

  // Strong evidence (a read reference) makes weak brand/keyword suggestions mostly noise: keep only a few.
  const all = [...matches.values()].sort((a, b) => b.confidence - a.confidence);
  const hasStrong = all.some((m) => m.confidence >= 0.7);
  const ranked = (hasStrong ? all.filter((m) => m.confidence >= 0.7).concat(all.filter((m) => m.confidence < 0.7).slice(0, 3)) : all).slice(0, 12);
  const status: ImageSearchResult["status"] = ranked.length ? "matches" : candidates.length ? "candidates-only" : "no-text";
  return { analysis, candidates, matches: ranked, status };
}
