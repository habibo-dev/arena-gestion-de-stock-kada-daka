import "server-only";
import { and, asc, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import { getDb, getSqlite, schema } from "@/server/db/client";
import { reindexPart } from "@/server/db/search-index";
import { normalizeReference, normalizeText, slugify } from "@/lib/references";
import { getStockStatus, type StockStatus } from "@/lib/stock";
import { BusinessError } from "@/lib/result";
import { searchParts } from "./search";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type PartListItem = {
  id: number;
  reference: string;
  designation: string;
  brand: string | null;
  brandId: number | null;
  category: string | null;
  categoryId: number | null;
  location: string | null;
  locationId: number | null;
  supplier: string | null;
  unit: string;
  quantity: number;
  minStock: number;
  purchasePrice: number;
  wholesalePrice: number;
  retailPrice: number;
  imagePath: string | null;
  isActive: boolean;
  status: StockStatus;
  updatedAt: string;
};

export type PartListFilters = {
  q?: string;
  status?: "ALL" | "FAIBLE" | "RUPTURE" | "DISPONIBLE" | "ALERTE";
  categoryId?: number;
  brandId?: number;
  locationId?: number;
  supplierId?: number;
  includeInactive?: boolean;
  onlyInactive?: boolean;
  sort?: "reference" | "designation" | "brand" | "quantity" | "purchasePrice" | "wholesalePrice" | "retailPrice" | "updatedAt" | "location";
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number; pageCount: number };

const listSelect = {
  id: schema.parts.id,
  reference: schema.parts.reference,
  designation: schema.parts.designation,
  brand: schema.brands.name,
  brandId: schema.parts.brandId,
  category: schema.categories.name,
  categoryId: schema.parts.categoryId,
  location: schema.locations.code,
  locationId: schema.parts.locationId,
  supplier: schema.suppliers.name,
  unit: schema.parts.unit,
  quantity: schema.parts.quantity,
  minStock: schema.parts.minStock,
  purchasePrice: schema.parts.purchasePrice,
  wholesalePrice: schema.parts.wholesalePrice,
  retailPrice: schema.parts.retailPrice,
  imagePath: schema.parts.imagePath,
  isActive: schema.parts.isActive,
  updatedAt: schema.parts.updatedAt,
};

function statusCondition(status: PartListFilters["status"]): SQL | undefined {
  switch (status) {
    case "RUPTURE":
      return sql`${schema.parts.quantity} <= 0`;
    case "FAIBLE":
      return sql`${schema.parts.quantity} > 0 AND ${schema.parts.minStock} > 0 AND ${schema.parts.quantity} <= ${schema.parts.minStock}`;
    case "ALERTE":
      return sql`(${schema.parts.quantity} <= 0 OR (${schema.parts.minStock} > 0 AND ${schema.parts.quantity} <= ${schema.parts.minStock}))`;
    case "DISPONIBLE":
      return sql`${schema.parts.quantity} > 0 AND (${schema.parts.minStock} = 0 OR ${schema.parts.quantity} > ${schema.parts.minStock})`;
    default:
      return undefined;
  }
}

/* -------------------------------------------------------------------------- */
/*  List / filters                                                            */
/* -------------------------------------------------------------------------- */

export function listParts(filters: PartListFilters = {}): Paginated<PartListItem> {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, filters.pageSize ?? 25));

  const conds: SQL[] = [];
  if (filters.onlyInactive) conds.push(eq(schema.parts.isActive, false));
  else if (!filters.includeInactive) conds.push(eq(schema.parts.isActive, true));
  const st = statusCondition(filters.status);
  if (st) conds.push(st);
  if (filters.categoryId) conds.push(eq(schema.parts.categoryId, filters.categoryId));
  if (filters.brandId) conds.push(eq(schema.parts.brandId, filters.brandId));
  if (filters.locationId) conds.push(eq(schema.parts.locationId, filters.locationId));
  if (filters.supplierId) conds.push(eq(schema.parts.supplierId, filters.supplierId));

  const q = filters.q?.trim();
  if (q) {
    const nref = normalizeReference(q);
    const text = `%${normalizeText(q)}%`;
    const refLike = `%${nref}%`;
    const refSub = db
      .select({ partId: schema.partReferences.partId })
      .from(schema.partReferences)
      .where(like(schema.partReferences.referenceNormalized, refLike));
    const parts: SQL[] = [
      sql`lower(${schema.parts.designation}) LIKE ${text}`,
      sql`lower(coalesce(${schema.parts.keywords}, '')) LIKE ${text}`,
      sql`lower(coalesce(${schema.brands.name}, '')) LIKE ${text}`,
      sql`lower(coalesce(${schema.locations.code}, '')) LIKE ${text}`,
    ];
    if (nref.length >= 2) {
      parts.push(like(schema.parts.referenceNormalized, refLike));
      parts.push(inArray(schema.parts.id, refSub));
      parts.push(eq(schema.parts.barcode, q));
    }
    conds.push(or(...parts)!);
  }

  const where = conds.length ? and(...conds) : undefined;

  const sortCol = {
    reference: schema.parts.reference,
    designation: schema.parts.designation,
    brand: schema.brands.name,
    quantity: schema.parts.quantity,
    purchasePrice: schema.parts.purchasePrice,
    wholesalePrice: schema.parts.wholesalePrice,
    retailPrice: schema.parts.retailPrice,
    updatedAt: schema.parts.updatedAt,
    location: schema.locations.code,
  }[filters.sort ?? "reference"];
  const orderBy = filters.dir === "desc" ? desc(sortCol) : asc(sortCol);

  const base = db
    .select(listSelect)
    .from(schema.parts)
    .leftJoin(schema.brands, eq(schema.brands.id, schema.parts.brandId))
    .leftJoin(schema.categories, eq(schema.categories.id, schema.parts.categoryId))
    .leftJoin(schema.locations, eq(schema.locations.id, schema.parts.locationId))
    .leftJoin(schema.suppliers, eq(schema.suppliers.id, schema.parts.supplierId));

  const rows = base
    .where(where)
    .orderBy(orderBy, asc(schema.parts.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();

  const countRow = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.parts)
    .leftJoin(schema.brands, eq(schema.brands.id, schema.parts.brandId))
    .leftJoin(schema.locations, eq(schema.locations.id, schema.parts.locationId))
    .where(where)
    .get();
  const count = countRow?.count ?? 0;

  return {
    items: rows.map((r) => ({ ...r, status: getStockStatus(r.quantity, r.minStock) })),
    total: count,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(count / pageSize)),
  };
}

export function getStockCounters(): { total: number; disponible: number; faible: number; rupture: number } {
  const sqlite = getSqlite();
  const row = sqlite
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN quantity <= 0 THEN 1 ELSE 0 END) AS rupture,
              SUM(CASE WHEN quantity > 0 AND min_stock > 0 AND quantity <= min_stock THEN 1 ELSE 0 END) AS faible
       FROM parts WHERE is_active = 1`,
    )
    .get() as { total: number; rupture: number; faible: number };
  return { total: row.total, rupture: row.rupture ?? 0, faible: row.faible ?? 0, disponible: row.total - (row.rupture ?? 0) - (row.faible ?? 0) };
}

/* -------------------------------------------------------------------------- */
/*  Detail                                                                    */
/* -------------------------------------------------------------------------- */

export type PartDetail = NonNullable<ReturnType<typeof getPartDetail>>;

export function getPartDetail(id: number) {
  const db = getDb();
  const part = db.query.parts.findFirst({
    where: eq(schema.parts.id, id),
    with: {
      brand: true,
      category: true,
      location: true,
      supplier: true,
      references: { orderBy: (r, { asc }) => [asc(r.type), asc(r.reference)] },
      compatibilities: {
        with: { vehicle: { with: { model: { with: { make: true } } } } },
      },
    },
  }).sync();
  if (!part) return null;

  const sqlite = getSqlite();
  const stats = sqlite
    .prepare(
      `SELECT
         COALESCE((SELECT SUM(si.quantity) FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE si.part_id = ? AND s.status = 'CONFIRMEE' AND s.sale_date >= datetime('now', '-90 days')), 0) AS sold90,
         COALESCE((SELECT SUM(si.quantity) FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE si.part_id = ? AND s.status = 'CONFIRMEE'), 0) AS soldTotal,
         (SELECT MAX(s.sale_date) FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE si.part_id = ? AND s.status = 'CONFIRMEE') AS lastSaleAt,
         (SELECT MAX(p.received_at) FROM purchase_items pi JOIN purchases p ON p.id = pi.purchase_id WHERE pi.part_id = ? AND p.status = 'RECUE') AS lastPurchaseAt,
         (SELECT pi.unit_cost FROM purchase_items pi JOIN purchases p ON p.id = pi.purchase_id WHERE pi.part_id = ? AND p.status = 'RECUE' ORDER BY p.received_at DESC LIMIT 1) AS lastPurchaseCost`,
    )
    .get(id, id, id, id, id) as { sold90: number; soldTotal: number; lastSaleAt: string | null; lastPurchaseAt: string | null; lastPurchaseCost: number | null };

  const compatibleVehicles = part.compatibilities
    .map((c) => ({
      vehicleId: c.vehicle.id,
      status: c.status,
      source: c.source,
      note: c.note,
      make: c.vehicle.model.make.name,
      model: c.vehicle.model.name,
      generation: c.vehicle.model.generation,
      engineLabel: c.vehicle.engineLabel,
      engineCode: c.vehicle.engineCode,
      fuel: c.vehicle.fuel,
      powerHp: c.vehicle.powerHp,
      yearFrom: c.vehicle.yearFrom,
      yearTo: c.vehicle.yearTo,
    }))
    .sort((a, b) => `${a.make} ${a.model} ${a.engineLabel}`.localeCompare(`${b.make} ${b.model} ${b.engineLabel}`));

  const { compatibilities: _c, ...rest } = part;
  void _c;
  return {
    ...rest,
    status: getStockStatus(part.quantity, part.minStock),
    compatibleVehicles,
    stats,
  };
}

/* -------------------------------------------------------------------------- */
/*  Reference data helpers                                                    */
/* -------------------------------------------------------------------------- */

export function listCategories() {
  return getDb().select().from(schema.categories).orderBy(asc(schema.categories.sortOrder), asc(schema.categories.name)).all();
}
export function listBrands() {
  return getDb().select().from(schema.brands).orderBy(asc(schema.brands.name)).all();
}
export function listLocations() {
  return getDb().select().from(schema.locations).orderBy(asc(schema.locations.code)).all();
}
export function listSuppliersLite() {
  return getDb()
    .select({ id: schema.suppliers.id, name: schema.suppliers.name, isActive: schema.suppliers.isActive })
    .from(schema.suppliers)
    .orderBy(asc(schema.suppliers.name))
    .all();
}

export function getOrCreateBrand(name: string): number {
  const db = getDb();
  const normalized = normalizeText(name);
  if (!normalized) throw new BusinessError("Nom de marque invalide.");
  const existing = db.select({ id: schema.brands.id }).from(schema.brands).where(eq(schema.brands.normalizedName, normalized)).get();
  if (existing) return existing.id;
  const [row] = db.insert(schema.brands).values({ name: name.trim(), normalizedName: normalized }).returning({ id: schema.brands.id }).all();
  return row!.id;
}

export function getOrCreateCategory(name: string): number {
  const db = getDb();
  const slug = slugify(name);
  if (!slug) throw new BusinessError("Nom de catégorie invalide.");
  const existing = db.select({ id: schema.categories.id }).from(schema.categories).where(eq(schema.categories.slug, slug)).get();
  if (existing) return existing.id;
  const [row] = db.insert(schema.categories).values({ name: name.trim(), slug }).returning({ id: schema.categories.id }).all();
  return row!.id;
}

export function getOrCreateLocation(code: string): number {
  const db = getDb();
  const clean = code.trim().toUpperCase();
  if (!clean) throw new BusinessError("Code emplacement invalide.");
  const existing = db.select({ id: schema.locations.id }).from(schema.locations).where(eq(schema.locations.code, clean)).get();
  if (existing) return existing.id;
  const [row] = db.insert(schema.locations).values({ code: clean }).returning({ id: schema.locations.id }).all();
  return row!.id;
}

export function getOrCreateSupplier(name: string): number {
  const db = getDb();
  const clean = name.trim();
  if (!clean) throw new BusinessError("Nom de fournisseur invalide.");
  const existing = db
    .select({ id: schema.suppliers.id })
    .from(schema.suppliers)
    .where(sql`lower(${schema.suppliers.name}) = lower(${clean})`)
    .get();
  if (existing) return existing.id;
  const [row] = db.insert(schema.suppliers).values({ name: clean }).returning({ id: schema.suppliers.id }).all();
  return row!.id;
}

/* -------------------------------------------------------------------------- */
/*  Mutations                                                                 */
/* -------------------------------------------------------------------------- */

export type PartInput = {
  reference: string;
  designation: string;
  description?: string | null;
  brandId?: number | null;
  brandName?: string | null;
  categoryId?: number | null;
  locationId?: number | null;
  locationCode?: string | null;
  supplierId?: number | null;
  unit: string;
  purchasePrice: number;
  wholesalePrice: number;
  retailPrice: number;
  minStock: number;
  barcode?: string | null;
  notes?: string | null;
  keywords?: string | null;
  isActive?: boolean;
  references?: { type: "OEM" | "ALTERNATIVE" | "SUPPLIER" | "BARCODE"; reference: string }[];
};

function resolveIds(input: PartInput) {
  let brandId = input.brandId ?? null;
  if (!brandId && input.brandName?.trim()) brandId = getOrCreateBrand(input.brandName);
  let locationId = input.locationId ?? null;
  if (!locationId && input.locationCode?.trim()) locationId = getOrCreateLocation(input.locationCode);
  return { brandId, locationId };
}

export function findPartByReference(reference: string, excludeId?: number) {
  const db = getDb();
  const n = normalizeReference(reference);
  const row = db
    .select({ id: schema.parts.id, reference: schema.parts.reference })
    .from(schema.parts)
    .where(excludeId ? and(eq(schema.parts.referenceNormalized, n), sql`${schema.parts.id} <> ${excludeId}`) : eq(schema.parts.referenceNormalized, n))
    .get();
  return row ?? null;
}

export function createPart(input: PartInput): number {
  const db = getDb();
  const sqlite = getSqlite();
  const reference = input.reference.trim();
  if (findPartByReference(reference)) throw new BusinessError(`La référence « ${reference} » existe déjà.`);

  const tx = sqlite.transaction(() => {
    const { brandId, locationId } = resolveIds(input);
    const now = new Date().toISOString();
    const [row] = db
      .insert(schema.parts)
      .values({
        reference,
        referenceNormalized: normalizeReference(reference),
        designation: input.designation.trim(),
        description: input.description?.trim() || null,
        brandId,
        categoryId: input.categoryId ?? null,
        locationId,
        supplierId: input.supplierId ?? null,
        unit: input.unit,
        purchasePrice: input.purchasePrice,
        wholesalePrice: input.wholesalePrice,
        retailPrice: input.retailPrice,
        quantity: 0,
        minStock: input.minStock,
        barcode: input.barcode?.trim() || null,
        notes: input.notes?.trim() || null,
        keywords: input.keywords?.trim() || null,
        isActive: input.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: schema.parts.id })
      .all();
    const id = row!.id;
    replaceReferences(id, input.references ?? []);
    reindexPart(sqlite, id);
    return id;
  });
  return tx();
}

export function updatePart(id: number, input: PartInput): void {
  const db = getDb();
  const sqlite = getSqlite();
  const reference = input.reference.trim();
  const dup = findPartByReference(reference, id);
  if (dup) throw new BusinessError(`La référence « ${reference} » est déjà utilisée par une autre pièce.`);

  const tx = sqlite.transaction(() => {
    const { brandId, locationId } = resolveIds(input);
    const res = db
      .update(schema.parts)
      .set({
        reference,
        referenceNormalized: normalizeReference(reference),
        designation: input.designation.trim(),
        description: input.description?.trim() || null,
        brandId,
        categoryId: input.categoryId ?? null,
        locationId,
        supplierId: input.supplierId ?? null,
        unit: input.unit,
        purchasePrice: input.purchasePrice,
        wholesalePrice: input.wholesalePrice,
        retailPrice: input.retailPrice,
        minStock: input.minStock,
        barcode: input.barcode?.trim() || null,
        notes: input.notes?.trim() || null,
        keywords: input.keywords?.trim() || null,
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.parts.id, id))
      .run();
    if (res.changes === 0) throw new BusinessError("Pièce introuvable.");
    if (input.references) replaceReferences(id, input.references);
    reindexPart(sqlite, id);
  });
  tx();
}

function replaceReferences(partId: number, refs: NonNullable<PartInput["references"]>) {
  const db = getDb();
  db.delete(schema.partReferences).where(eq(schema.partReferences.partId, partId)).run();
  const seen = new Set<string>();
  for (const r of refs) {
    const clean = r.reference.trim();
    const n = normalizeReference(clean);
    if (!n || seen.has(`${r.type}:${n}`)) continue;
    seen.add(`${r.type}:${n}`);
    db.insert(schema.partReferences).values({ partId, type: r.type, reference: clean, referenceNormalized: n }).run();
  }
}

export function setPartActive(id: number, isActive: boolean): void {
  const res = getDb().update(schema.parts).set({ isActive, updatedAt: new Date().toISOString() }).where(eq(schema.parts.id, id)).run();
  if (res.changes === 0) throw new BusinessError("Pièce introuvable.");
}

export function deletePart(id: number): void {
  const sqlite = getSqlite();
  const used = sqlite
    .prepare(`SELECT (SELECT COUNT(*) FROM sale_items WHERE part_id = ?) + (SELECT COUNT(*) FROM purchase_items WHERE part_id = ?) AS c`)
    .get(id, id) as { c: number };
  if (used.c > 0) {
    throw new BusinessError("Cette pièce est référencée dans des ventes ou des achats : archivez-la au lieu de la supprimer.");
  }
  const part = getDb().select({ quantity: schema.parts.quantity }).from(schema.parts).where(eq(schema.parts.id, id)).get();
  if (!part) throw new BusinessError("Pièce introuvable.");
  if (part.quantity !== 0) throw new BusinessError("Impossible de supprimer une pièce dont le stock n'est pas nul. Ajustez le stock à 0 d'abord.");
  getDb().delete(schema.parts).where(eq(schema.parts.id, id)).run();
}

export function setPartImage(id: number, imagePath: string | null): void {
  getDb().update(schema.parts).set({ imagePath, updatedAt: new Date().toISOString() }).where(eq(schema.parts.id, id)).run();
}

export function duplicatePartSource(id: number) {
  const part = getPartDetail(id);
  if (!part) return null;
  return {
    reference: "",
    designation: part.designation,
    description: part.description,
    brandId: part.brandId,
    categoryId: part.categoryId,
    locationId: part.locationId,
    supplierId: part.supplierId,
    unit: part.unit,
    purchasePrice: part.purchasePrice,
    wholesalePrice: part.wholesalePrice,
    retailPrice: part.retailPrice,
    minStock: part.minStock,
    barcode: null,
    notes: part.notes,
    keywords: part.keywords,
    references: part.references.map((r) => ({ type: r.type, reference: r.reference })),
  };
}

/* Compatibility management */
export function setCompatibility(partId: number, vehicleId: number, status: "VERIFIED" | "UNVERIFIED", note?: string | null, source?: string | null): void {
  const db = getDb();
  db.insert(schema.compatibilities)
    .values({ partId, vehicleId, status, note: note ?? null, source: source ?? "Saisie manuelle" })
    .onConflictDoUpdate({ target: [schema.compatibilities.partId, schema.compatibilities.vehicleId], set: { status, note: note ?? null } })
    .run();
  reindexPart(getSqlite(), partId);
}

export function removeCompatibility(partId: number, vehicleId: number): void {
  getDb()
    .delete(schema.compatibilities)
    .where(and(eq(schema.compatibilities.partId, partId), eq(schema.compatibilities.vehicleId, vehicleId)))
    .run();
  reindexPart(getSqlite(), partId);
}

/** Lightweight part lookup for pickers (sales/purchases): smart search first, LIKE fallback. */
export function pickerSearch(q: string, limit = 12): PartListItem[] {
  const query = q.trim();
  if (query.length < 1) return [];
  const hits = searchParts(query, { limit }).hits;
  if (hits.length > 0) {
    const byId = new Map(getPartsByIds(hits.map((h) => h.id)).map((p) => [p.id, p]));
    return hits.map((h) => byId.get(h.id)).filter((p): p is PartListItem => Boolean(p));
  }
  return listParts({ q: query, pageSize: limit, page: 1 }).items;
}

export function getPartsByIds(ids: number[]) {
  if (ids.length === 0) return [];
  return getDb()
    .select(listSelect)
    .from(schema.parts)
    .leftJoin(schema.brands, eq(schema.brands.id, schema.parts.brandId))
    .leftJoin(schema.categories, eq(schema.categories.id, schema.parts.categoryId))
    .leftJoin(schema.locations, eq(schema.locations.id, schema.parts.locationId))
    .leftJoin(schema.suppliers, eq(schema.suppliers.id, schema.parts.supplierId))
    .where(inArray(schema.parts.id, ids))
    .all()
    .map((r) => ({ ...r, status: getStockStatus(r.quantity, r.minStock) }));
}
