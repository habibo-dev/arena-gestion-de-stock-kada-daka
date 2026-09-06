import "server-only";
import { getSqlite } from "@/server/db/client";
import { looksLikeReference, normalizeReference, normalizeText } from "@/lib/references";
import { getStockStatus, type StockStatus } from "@/lib/stock";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type SearchHit = {
  id: number;
  reference: string;
  designation: string;
  brand: string | null;
  category: string | null;
  location: string | null;
  quantity: number;
  minStock: number;
  status: StockStatus;
  purchasePrice: number;
  wholesalePrice: number;
  retailPrice: number;
  unit: string;
  imagePath: string | null;
  isActive: boolean;
  /** Which alternative/OEM reference matched, if any. */
  matchedReference: { type: string; reference: string } | null;
  /** Compatible vehicles, short labels. */
  vehicles: { id: number; label: string; verified: boolean }[];
  /** Whether the part is compatible with the vehicle detected in the query. */
  compatibleWithQueryVehicle: boolean;
  /** Why this result was returned. */
  matchReasons: string[];
  /** 0..1 relevance. */
  score: number;
};

export type QueryInterpretation = {
  raw: string;
  normalized: string;
  tokens: string[];
  referenceTokens: string[];
  vehicleTokens: string[];
  partTokens: string[];
  vehicleMatches: { id: number; label: string; score: number }[];
  brandMatches: string[];
  categoryMatches: string[];
};

export type SearchOptions = {
  limit?: number;
  offset?: number;
  onlyInStock?: boolean;
  includeInactive?: boolean;
  vehicleId?: number | null;
  categoryId?: number | null;
};

export type SearchResponse = {
  hits: SearchHit[];
  total: number;
  interpretation: QueryInterpretation;
  tookMs: number;
};

/* -------------------------------------------------------------------------- */
/*  Query interpretation                                                      */
/* -------------------------------------------------------------------------- */

const STOP_WORDS = new Set(["de", "du", "des", "le", "la", "les", "un", "une", "pour", "et", "a", "au", "aux", "en", "d", "l", "sur", "avec"]);

/** Counter jargon → canonical search word. */
const SYNONYMS: Record<string, string> = {
  plaquettes: "plaquette",
  plaq: "plaquette",
  plaquete: "plaquette",
  disques: "disque",
  filtres: "filtre",
  gazoil: "gasoil",
  gazole: "gasoil",
  carburant: "gasoil",
  bougies: "bougie",
  amortisseurs: "amortisseur",
  amorto: "amortisseur",
  amortos: "amortisseur",
  distri: "distribution",
  courroies: "courroie",
  rotules: "rotule",
  roulements: "roulement",
  batteries: "batterie",
  ampoules: "ampoule",
  balais: "balai",
  radiateurs: "radiateur",
  huiles: "huile",
  freins: "frein",
  freinage: "frein",
  av: "avant",
  ar: "arriere",
  arr: "arriere",
  arrière: "arriere",
  supports: "support",
  kits: "kit",
  embrayages: "embrayage",
  pompes: "pompe",
  thermostats: "thermostat",
  calorstat: "thermostat",
  cardans: "cardan",
  soufflets: "soufflet",
  phares: "phare",
  optique: "phare",
  retro: "retroviseur",
  rétro: "retroviseur",
};

const ROMAN: Record<string, string> = { "1": "i", "2": "ii", "3": "iii", "4": "iv", "5": "v", "6": "vi", "7": "vii", "8": "viii" };

export function tokenizeQuery(raw: string): { tokens: string[]; referenceTokens: string[]; keywordTokens: string[] } {
  const normalized = normalizeText(raw).replace(/[,;|]+/g, " ");
  const rawTokens = normalized.split(" ").filter(Boolean);
  const tokens: string[] = [];
  const referenceTokens: string[] = [];
  const keywordTokens: string[] = [];

  for (const t of rawTokens) {
    if (STOP_WORDS.has(t)) continue;
    const canonical = SYNONYMS[t] ?? t;
    tokens.push(canonical);
    if (looksLikeReference(canonical)) referenceTokens.push(canonical);
    else keywordTokens.push(canonical);
  }
  return { tokens, referenceTokens, keywordTokens };
}

type VehicleRow = { id: number; label: string; search_text: string };

const isSmallInt = (t: string) => /^[1-9]$/.test(t);
const isNumeric = (t: string) => /^\d+(\.\d+)?$/.test(t);

/**
 * Find vehicles covered by the vehicle-ish tokens of the query.
 *  - name tokens (make/model/engine code/fuel) → strong signal
 *  - generation numbers ("4" → "iv") and engine numbers ("1.5") → discriminating:
 *    a vehicle that does not carry them is excluded.
 */
function matchVehicles(vehicleTokens: string[], vehiclesCache: VehicleRow[]): { id: number; label: string; score: number }[] {
  if (vehicleTokens.length === 0) return [];
  const out: { id: number; label: string; score: number }[] = [];
  for (const v of vehiclesCache) {
    const words = new Set(v.search_text.split(" "));
    let matched = 0;
    let strong = 0;
    let conflict = false;
    for (const t of vehicleTokens) {
      if (isSmallInt(t)) {
        if (words.has(ROMAN[t]!) || words.has(t)) matched++;
        else conflict = true;
        continue;
      }
      if (isNumeric(t)) {
        if (words.has(t)) matched++;
        else conflict = true;
        continue;
      }
      if (words.has(t)) {
        matched++;
        strong++;
      }
    }
    if (strong === 0 || conflict) continue;
    const coverage = matched / vehicleTokens.length;
    if (coverage >= 0.5) out.push({ id: v.id, label: v.label, score: coverage });
  }
  out.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  return out.slice(0, 12);
}

/* -------------------------------------------------------------------------- */
/*  Main search                                                               */
/* -------------------------------------------------------------------------- */

const BASE_SELECT = `
  SELECT p.id, p.reference, p.designation, p.quantity, p.min_stock AS minStock,
         p.purchase_price AS purchasePrice, p.wholesale_price AS wholesalePrice, p.retail_price AS retailPrice,
         p.unit, p.image_path AS imagePath, p.is_active AS isActive,
         b.name AS brand, c.name AS category, l.code AS location
  FROM parts p
  LEFT JOIN brands b ON b.id = p.brand_id
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN locations l ON l.id = p.location_id
`;

type PartRow = {
  id: number;
  reference: string;
  designation: string;
  quantity: number;
  minStock: number;
  purchasePrice: number;
  wholesalePrice: number;
  retailPrice: number;
  unit: string;
  imagePath: string | null;
  isActive: number;
  brand: string | null;
  category: string | null;
  location: string | null;
};

const FTS_SQL = `SELECT part_id AS id, bm25(parts_fts, 0, 10.0, 6.0, 5.0, 4.0, 2.0, 1.0, 1.0, 3.0) AS rank
                 FROM parts_fts WHERE parts_fts MATCH ? ORDER BY rank LIMIT 300`;

function ftsPhrase(t: string): string {
  return `"${t.replace(/"/g, "")}"`;
}

export function searchParts(rawQuery: string, opts: SearchOptions = {}): SearchResponse {
  const t0 = performance.now();
  const sqlite = getSqlite();
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const query = rawQuery.trim();

  const { tokens, referenceTokens, keywordTokens } = tokenizeQuery(query);
  const normalized = normalizeText(query);
  const normalizedRef = normalizeReference(query);

  /* --------------------------- reference data ----------------------------- */
  const vehiclesCache = sqlite
    .prepare(
      `SELECT v.id, v.search_text,
              mk.name || ' ' || md.name || CASE WHEN md.generation IS NOT NULL THEN ' ' || md.generation ELSE '' END || ' ' || v.engine_label AS label
       FROM vehicles v JOIN vehicle_models md ON md.id = v.model_id JOIN vehicle_makes mk ON mk.id = md.make_id`,
    )
    .all() as VehicleRow[];
  const vehicleVocabulary = new Set<string>();
  for (const v of vehiclesCache) for (const w of v.search_text.split(" ")) vehicleVocabulary.add(w);

  const brandRows = sqlite.prepare(`SELECT name, normalized_name AS n FROM brands`).all() as { name: string; n: string }[];
  const categoryRows = sqlite.prepare(`SELECT id, name FROM categories`).all() as { id: number; name: string }[];

  /* -------------------------- token classification ------------------------ */
  // A token is "vehicle-ish" when it exists in the vehicle vocabulary
  // (make, model, generation, engine label/code, fuel, years) or is a generation digit.
  const vehicleTokens: string[] = [];
  const partTokens: string[] = [];
  for (const t of keywordTokens) {
    if (vehicleVocabulary.has(t) || (isSmallInt(t) && vehicleVocabulary.has(ROMAN[t]!))) vehicleTokens.push(t);
    else partTokens.push(t);
  }
  // Engine codes like "k9k" may be classified as references; they are vehicle tokens too.
  for (const t of referenceTokens) if (vehicleVocabulary.has(t)) vehicleTokens.push(t);

  // Digits alone ("4") only count as vehicle tokens when a name token is also present.
  const hasVehicleName = vehicleTokens.some((t) => !isNumeric(t));
  const effectiveVehicleTokens = hasVehicleName ? vehicleTokens : [];
  if (!hasVehicleName) for (const t of vehicleTokens) if (!partTokens.includes(t)) partTokens.push(t);

  const vehicleMatches = matchVehicles(effectiveVehicleTokens, vehiclesCache);
  const brandMatches = brandRows.filter((b) => tokens.some((t) => t.length >= 3 && b.n === t)).map((b) => b.name);
  const categoryMatches = categoryRows
    .filter((c) => partTokens.some((t) => t.length >= 4 && normalizeText(c.name).startsWith(t.slice(0, 5))))
    .map((c) => c.name);

  const interpretation: QueryInterpretation = {
    raw: query,
    normalized,
    tokens,
    referenceTokens,
    vehicleTokens: effectiveVehicleTokens,
    partTokens,
    vehicleMatches,
    brandMatches,
    categoryMatches,
  };

  /* ------------------------------ scoring --------------------------------- */
  type Score = { score: number; reasons: Set<string>; matchedRef: { type: string; reference: string } | null };
  const scores = new Map<number, Score>();
  const bump = (id: number, score: number, reason: string, matchedRef?: { type: string; reference: string }) => {
    const cur = scores.get(id) ?? { score: 0, reasons: new Set<string>(), matchedRef: null };
    cur.score = Math.max(cur.score, score) + Math.min(score, 0.15);
    cur.reasons.add(reason);
    if (matchedRef && !cur.matchedRef) cur.matchedRef = matchedRef;
    scores.set(id, cur);
  };
  const runFts = (match: string, weight: (i: number) => number, reason: string) => {
    try {
      const rows = sqlite.prepare(FTS_SQL).all(match) as { id: number; rank: number }[];
      rows.forEach((r, i) => bump(r.id, weight(i), reason));
    } catch {
      /* malformed FTS query – ignore */
    }
  };

  const compatibleIds = new Set<number>();
  if (vehicleMatches.length > 0) {
    const ids = vehicleMatches.map((v) => v.id);
    const rows = sqlite
      .prepare(`SELECT DISTINCT part_id AS id FROM compatibilities WHERE vehicle_id IN (${ids.map(() => "?").join(",")})`)
      .all(...ids) as { id: number }[];
    for (const r of rows) compatibleIds.add(r.id);
  }

  if (query.length > 0) {
    /* 1. Exact / partial reference matches on the whole query */
    if (normalizedRef.length >= 3 && (referenceTokens.length > 0 || tokens.length <= 2)) {
      const exactMain = sqlite.prepare(`SELECT id FROM parts WHERE reference_normalized = ?`).all(normalizedRef) as { id: number }[];
      for (const r of exactMain) bump(r.id, 1.0, "Référence exacte");

      const exactAlt = sqlite
        .prepare(`SELECT part_id AS id, type, reference FROM part_references WHERE reference_normalized = ?`)
        .all(normalizedRef) as { id: number; type: string; reference: string }[];
      for (const r of exactAlt) {
        const label = r.type === "OEM" ? "OEM" : r.type === "SUPPLIER" ? "fournisseur" : r.type === "BARCODE" ? "code-barres" : "alternative";
        bump(r.id, 0.98, `Référence ${label} exacte`, { type: r.type, reference: r.reference });
      }

      const barcode = sqlite.prepare(`SELECT id FROM parts WHERE barcode = ?`).all(query) as { id: number }[];
      for (const r of barcode) bump(r.id, 1.0, "Code-barres");

      if (normalizedRef.length >= 3) {
        const partialMain = sqlite
          .prepare(`SELECT id FROM parts WHERE reference_normalized LIKE ? LIMIT 200`)
          .all(`%${normalizedRef}%`) as { id: number }[];
        for (const r of partialMain) bump(r.id, normalizedRef.length >= 6 ? 0.85 : 0.7, "Référence partielle");

        const partialAlt = sqlite
          .prepare(`SELECT part_id AS id, type, reference FROM part_references WHERE reference_normalized LIKE ? LIMIT 200`)
          .all(`%${normalizedRef}%`) as { id: number; type: string; reference: string }[];
        for (const r of partialAlt)
          bump(r.id, normalizedRef.length >= 6 ? 0.82 : 0.66, "Référence alternative partielle", { type: r.type, reference: r.reference });
      }
    }

    /* 1b. Reference-like tokens inside a longer query ("bosch 0986", "huile 5w30") */
    for (const rt of referenceTokens) {
      const n = normalizeReference(rt);
      if (n.length < 4 || n === normalizedRef) continue;
      const rows = sqlite.prepare(`SELECT id FROM parts WHERE reference_normalized LIKE ? LIMIT 200`).all(`%${n}%`) as { id: number }[];
      for (const r of rows) bump(r.id, 0.6, `Référence contient « ${rt} »`);
      const alt = sqlite
        .prepare(`SELECT part_id AS id, type, reference FROM part_references WHERE reference_normalized LIKE ? LIMIT 200`)
        .all(`%${n}%`) as { id: number; type: string; reference: string }[];
      for (const r of alt) bump(r.id, 0.58, `Référence alternative contient « ${rt} »`, { type: r.type, reference: r.reference });
      // Reference tokens are also searched as text (e.g. "5w30" appears in designations)
      if (n.length >= 3) runFts(ftsPhrase(rt), () => 0.55, `Texte contient « ${rt} »`);
    }

    /* 2. Full-text search on part keywords (designation, brand, category, keywords) */
    const ftsPartTokens = [...new Set(partTokens)].filter((t) => t.length >= 3);
    if (ftsPartTokens.length > 0) {
      runFts(ftsPartTokens.map(ftsPhrase).join(" AND "), (i) => Math.max(0.35, 0.75 - i * 0.004), "Désignation / mots-clés");
      if (ftsPartTokens.length > 1) {
        runFts(ftsPartTokens.map(ftsPhrase).join(" OR "), (i) => Math.max(0.2, 0.45 - i * 0.003), "Correspondance partielle");
      }
    }

    /* 3. Short tokens (< 3 chars) via LIKE on designation/keywords */
    for (const st of partTokens.filter((t) => t.length > 0 && t.length < 3 && !isNumeric(t))) {
      const rows = sqlite
        .prepare(`SELECT id FROM parts WHERE lower(designation) LIKE ? OR lower(keywords) LIKE ? LIMIT 100`)
        .all(`%${st}%`, `%${st}%`) as { id: number }[];
      for (const r of rows) bump(r.id, 0.3, "Mot court");
    }

    /* 4. Vehicle handling */
    if (vehicleMatches.length > 0) {
      const vehicleLabel = vehicleMatches.length === 1 ? vehicleMatches[0]!.label : `${vehicleMatches[0]!.label}${vehicleMatches.length > 1 ? ` (+${vehicleMatches.length - 1})` : ""}`;
      const hasPartCriteria = ftsPartTokens.length > 0 || referenceTokens.some((t) => !vehicleVocabulary.has(t));
      if (!hasPartCriteria) {
        // Pure vehicle query: compatible parts ARE the answer.
        for (const id of compatibleIds) bump(id, 0.8, `Compatible ${vehicleLabel}`);
        // Plus text mentions of the vehicle (lower weight) so nothing relevant is hidden.
        const vt = effectiveVehicleTokens.filter((t) => t.length >= 3 && !isNumeric(t));
        if (vt.length) runFts(vt.map(ftsPhrase).join(" AND "), () => 0.4, "Mention dans la fiche");
      } else {
        // Part criteria + vehicle: boost compatible, demote non-compatible.
        for (const [id, sc] of scores) {
          if (compatibleIds.has(id)) {
            sc.score = Math.max(sc.score, 0.9) + 0.1;
            sc.reasons.add(`Compatible ${vehicleLabel}`);
          } else {
            sc.score *= 0.5;
          }
        }
      }
    }
  }

  /* Explicit filters */
  if (opts.vehicleId) {
    const rows = sqlite.prepare(`SELECT part_id AS id FROM compatibilities WHERE vehicle_id = ?`).all(opts.vehicleId) as { id: number }[];
    const allowed = new Set(rows.map((r) => r.id));
    if (query.length === 0) for (const id of allowed) bump(id, 0.8, "Compatible avec le véhicule sélectionné");
    for (const id of [...scores.keys()]) if (!allowed.has(id)) scores.delete(id);
  }

  const idList = [...scores.entries()].sort((a, b) => b[1].score - a[1].score).map(([id]) => id);
  if (idList.length === 0) {
    return { hits: [], total: 0, interpretation, tookMs: performance.now() - t0 };
  }

  /* Hydrate */
  const rowsAll: PartRow[] = [];
  for (let i = 0; i < idList.length; i += 500) {
    const slice = idList.slice(i, i + 500);
    rowsAll.push(...(sqlite.prepare(`${BASE_SELECT} WHERE p.id IN (${slice.map(() => "?").join(",")})`).all(...slice) as PartRow[]));
  }
  const byId = new Map(rowsAll.map((r) => [r.id, r]));

  let ordered = idList.map((id) => byId.get(id)).filter((r): r is PartRow => Boolean(r));
  if (!opts.includeInactive) ordered = ordered.filter((r) => r.isActive === 1);
  if (opts.onlyInStock) ordered = ordered.filter((r) => r.quantity > 0);
  if (opts.categoryId) {
    const cat = categoryRows.find((c) => c.id === opts.categoryId);
    if (cat) ordered = ordered.filter((r) => r.category === cat.name);
  }

  const total = ordered.length;
  const page = ordered.slice(offset, offset + limit);

  /* Vehicles for the page */
  const vehiclesByPart = new Map<number, { id: number; label: string; verified: boolean }[]>();
  if (page.length > 0) {
    const rows = sqlite
      .prepare(
        `SELECT cp.part_id AS partId, v.id, cp.status,
                mk.name || ' ' || md.name || CASE WHEN md.generation IS NOT NULL THEN ' ' || md.generation ELSE '' END || ' ' || v.engine_label AS label
         FROM compatibilities cp
         JOIN vehicles v ON v.id = cp.vehicle_id
         JOIN vehicle_models md ON md.id = v.model_id
         JOIN vehicle_makes mk ON mk.id = md.make_id
         WHERE cp.part_id IN (${page.map(() => "?").join(",")})
         ORDER BY mk.name, md.name, v.engine_label`,
      )
      .all(...page.map((p) => p.id)) as { partId: number; id: number; status: string; label: string }[];
    for (const r of rows) {
      if (!vehiclesByPart.has(r.partId)) vehiclesByPart.set(r.partId, []);
      vehiclesByPart.get(r.partId)!.push({ id: r.id, label: r.label, verified: r.status === "VERIFIED" });
    }
  }

  const maxScore = Math.max(...page.map((p) => scores.get(p.id)?.score ?? 0), 0.0001);
  const hits: SearchHit[] = page.map((r) => {
    const sc = scores.get(r.id)!;
    return {
      id: r.id,
      reference: r.reference,
      designation: r.designation,
      brand: r.brand,
      category: r.category,
      location: r.location,
      quantity: r.quantity,
      minStock: r.minStock,
      status: getStockStatus(r.quantity, r.minStock),
      purchasePrice: r.purchasePrice,
      wholesalePrice: r.wholesalePrice,
      retailPrice: r.retailPrice,
      unit: r.unit,
      imagePath: r.imagePath,
      isActive: r.isActive === 1,
      matchedReference: sc.matchedRef,
      vehicles: vehiclesByPart.get(r.id) ?? [],
      compatibleWithQueryVehicle: compatibleIds.has(r.id),
      matchReasons: [...sc.reasons].slice(0, 3),
      score: Math.min(1, sc.score / Math.max(maxScore, 1)),
    };
  });

  return { hits, total, interpretation, tookMs: performance.now() - t0 };
}

/** Lightweight variant for the top-bar command palette. */
export function quickSearch(query: string, limit = 8): SearchHit[] {
  if (query.trim().length < 2) return [];
  return searchParts(query, { limit }).hits;
}
