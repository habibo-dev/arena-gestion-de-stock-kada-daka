import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { getDb, getSqlite, schema } from "@/server/db/client";
import { reindexPart } from "@/server/db/search-index";
import { normalizeText } from "@/lib/references";
import { buildVehicleSearchText } from "@/lib/vehicles";
import { getStockStatus } from "@/lib/stock";
import { BusinessError } from "@/lib/result";

export type VehicleListItem = {
  id: number;
  makeId: number;
  make: string;
  modelId: number;
  model: string;
  generation: string | null;
  engineLabel: string;
  engineCode: string | null;
  fuel: string | null;
  powerHp: number | null;
  displacement: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  partCount: number;
  verifiedCount: number;
};

export function listVehicles(opts: { q?: string; makeId?: number; fuel?: string } = {}): VehicleListItem[] {
  const sqlite = getSqlite();
  const q = opts.q ? normalizeText(opts.q) : "";
  const tokens = q.split(" ").filter(Boolean);
  const rows = sqlite
    .prepare(
      `SELECT v.id, mk.id AS makeId, mk.name AS make, md.id AS modelId, md.name AS model, md.generation,
              v.engine_label AS engineLabel, v.engine_code AS engineCode, v.fuel, v.power_hp AS powerHp,
              v.displacement, v.year_from AS yearFrom, v.year_to AS yearTo, v.search_text AS searchText,
              (SELECT COUNT(*) FROM compatibilities c WHERE c.vehicle_id = v.id) AS partCount,
              (SELECT COUNT(*) FROM compatibilities c WHERE c.vehicle_id = v.id AND c.status = 'VERIFIED') AS verifiedCount
       FROM vehicles v
       JOIN vehicle_models md ON md.id = v.model_id
       JOIN vehicle_makes mk ON mk.id = md.make_id
       WHERE (? = 0 OR mk.id = ?) AND (? = '' OR v.fuel = ?)
       ORDER BY mk.name, md.name, md.year_from, v.engine_label`,
    )
    .all(opts.makeId ?? 0, opts.makeId ?? 0, opts.fuel ?? "", opts.fuel ?? "") as (VehicleListItem & { searchText: string })[];
  const filtered = tokens.length ? rows.filter((r) => tokens.every((t) => r.searchText.includes(t))) : rows;
  return filtered.map(({ searchText: _s, ...r }) => {
    void _s;
    return r;
  });
}

export function listMakes() {
  return getDb().select().from(schema.vehicleMakes).orderBy(asc(schema.vehicleMakes.name)).all();
}

export function listModels(makeId?: number) {
  const db = getDb();
  const base = db
    .select({
      id: schema.vehicleModels.id,
      makeId: schema.vehicleModels.makeId,
      make: schema.vehicleMakes.name,
      name: schema.vehicleModels.name,
      generation: schema.vehicleModels.generation,
      yearFrom: schema.vehicleModels.yearFrom,
      yearTo: schema.vehicleModels.yearTo,
    })
    .from(schema.vehicleModels)
    .innerJoin(schema.vehicleMakes, eq(schema.vehicleMakes.id, schema.vehicleModels.makeId))
    .orderBy(asc(schema.vehicleMakes.name), asc(schema.vehicleModels.name), asc(schema.vehicleModels.yearFrom));
  return makeId ? base.where(eq(schema.vehicleModels.makeId, makeId)).all() : base.all();
}

export function getVehicle(id: number) {
  const db = getDb();
  const v = db.query.vehicles.findFirst({ where: eq(schema.vehicles.id, id), with: { model: { with: { make: true } } } }).sync();
  if (!v) return null;
  const parts = db
    .select({
      id: schema.parts.id,
      reference: schema.parts.reference,
      designation: schema.parts.designation,
      brand: schema.brands.name,
      category: schema.categories.name,
      location: schema.locations.code,
      quantity: schema.parts.quantity,
      minStock: schema.parts.minStock,
      wholesalePrice: schema.parts.wholesalePrice,
      retailPrice: schema.parts.retailPrice,
      imagePath: schema.parts.imagePath,
      isActive: schema.parts.isActive,
      compatStatus: schema.compatibilities.status,
      compatSource: schema.compatibilities.source,
      compatNote: schema.compatibilities.note,
    })
    .from(schema.compatibilities)
    .innerJoin(schema.parts, eq(schema.parts.id, schema.compatibilities.partId))
    .leftJoin(schema.brands, eq(schema.brands.id, schema.parts.brandId))
    .leftJoin(schema.categories, eq(schema.categories.id, schema.parts.categoryId))
    .leftJoin(schema.locations, eq(schema.locations.id, schema.parts.locationId))
    .where(eq(schema.compatibilities.vehicleId, id))
    .orderBy(asc(schema.categories.name), asc(schema.parts.designation))
    .all()
    .map((p) => ({ ...p, status: getStockStatus(p.quantity, p.minStock) }));

  // Sibling engines of the same model (useful for navigation)
  const siblings = db
    .select({ id: schema.vehicles.id, engineLabel: schema.vehicles.engineLabel, fuel: schema.vehicles.fuel, engineCode: schema.vehicles.engineCode })
    .from(schema.vehicles)
    .where(eq(schema.vehicles.modelId, v.modelId))
    .orderBy(asc(schema.vehicles.engineLabel))
    .all();

  return { ...v, parts, siblings };
}

export type VehicleInput = {
  makeName: string;
  modelName: string;
  generation?: string | null;
  modelYearFrom?: number | null;
  modelYearTo?: number | null;
  engineLabel: string;
  displacement?: string | null;
  fuel?: "Diesel" | "Essence" | "GPL" | "Hybride" | "Électrique" | null;
  powerHp?: number | null;
  engineCode?: string | null;
  yearFrom?: number | null;
  yearTo?: number | null;
};

export function createVehicle(input: VehicleInput): number {
  const db = getDb();
  const sqlite = getSqlite();
  const tx = sqlite.transaction(() => {
    const makeNorm = normalizeText(input.makeName);
    if (!makeNorm) throw new BusinessError("La marque est obligatoire.");
    let make = db.select().from(schema.vehicleMakes).where(eq(schema.vehicleMakes.normalizedName, makeNorm)).get();
    if (!make) {
      [make] = db.insert(schema.vehicleMakes).values({ name: input.makeName.trim(), normalizedName: makeNorm }).returning().all();
    }
    const modelName = input.modelName.trim();
    if (!modelName) throw new BusinessError("Le modèle est obligatoire.");
    const gen = input.generation?.trim() || null;
    let model = db
      .select()
      .from(schema.vehicleModels)
      .where(sql`${schema.vehicleModels.makeId} = ${make!.id} AND lower(${schema.vehicleModels.name}) = lower(${modelName}) AND coalesce(${schema.vehicleModels.generation}, '') = coalesce(${gen}, '')`)
      .get();
    if (!model) {
      [model] = db
        .insert(schema.vehicleModels)
        .values({ makeId: make!.id, name: modelName, generation: gen, yearFrom: input.modelYearFrom ?? input.yearFrom ?? null, yearTo: input.modelYearTo ?? input.yearTo ?? null })
        .returning()
        .all();
    }
    const searchText = buildVehicleSearchText({
      make: make!.name,
      model: model!.name,
      generation: model!.generation,
      engineLabel: input.engineLabel,
      engineCode: input.engineCode,
      fuel: input.fuel,
      displacement: input.displacement,
      yearFrom: input.yearFrom,
      yearTo: input.yearTo,
    });
    const [v] = db
      .insert(schema.vehicles)
      .values({
        modelId: model!.id,
        engineLabel: input.engineLabel.trim(),
        displacement: input.displacement?.trim() || null,
        fuel: input.fuel ?? null,
        powerHp: input.powerHp ?? null,
        powerKw: input.powerHp ? Math.round(input.powerHp * 0.7355) : null,
        engineCode: input.engineCode?.trim() || null,
        yearFrom: input.yearFrom ?? null,
        yearTo: input.yearTo ?? null,
        searchText,
      })
      .returning({ id: schema.vehicles.id })
      .all();
    return v!.id;
  });
  return tx();
}

export function updateVehicle(id: number, input: Omit<VehicleInput, "makeName" | "modelName"> & { generation?: string | null }): void {
  const db = getDb();
  const sqlite = getSqlite();
  const tx = sqlite.transaction(() => {
    const v = db.query.vehicles.findFirst({ where: eq(schema.vehicles.id, id), with: { model: { with: { make: true } } } }).sync();
    if (!v) throw new BusinessError("Véhicule introuvable.");
    const searchText = buildVehicleSearchText({
      make: v.model.make.name,
      model: v.model.name,
      generation: v.model.generation,
      engineLabel: input.engineLabel,
      engineCode: input.engineCode,
      fuel: input.fuel,
      displacement: input.displacement,
      yearFrom: input.yearFrom,
      yearTo: input.yearTo,
    });
    db.update(schema.vehicles)
      .set({
        engineLabel: input.engineLabel.trim(),
        displacement: input.displacement?.trim() || null,
        fuel: input.fuel ?? null,
        powerHp: input.powerHp ?? null,
        powerKw: input.powerHp ? Math.round(input.powerHp * 0.7355) : null,
        engineCode: input.engineCode?.trim() || null,
        yearFrom: input.yearFrom ?? null,
        yearTo: input.yearTo ?? null,
        searchText,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.vehicles.id, id))
      .run();
    const partIds = db.select({ partId: schema.compatibilities.partId }).from(schema.compatibilities).where(eq(schema.compatibilities.vehicleId, id)).all();
    for (const p of partIds) reindexPart(sqlite, p.partId);
  });
  tx();
}

export function deleteVehicle(id: number): void {
  const db = getDb();
  const sqlite = getSqlite();
  const tx = sqlite.transaction(() => {
    const partIds = db.select({ partId: schema.compatibilities.partId }).from(schema.compatibilities).where(eq(schema.compatibilities.vehicleId, id)).all();
    const res = db.delete(schema.vehicles).where(eq(schema.vehicles.id, id)).run();
    if (res.changes === 0) throw new BusinessError("Véhicule introuvable.");
    for (const p of partIds) reindexPart(sqlite, p.partId);
  });
  tx();
}

/** Compact vehicle list for pickers. */
export function vehicleOptions(q?: string, limit = 30) {
  return listVehicles({ q })
    .slice(0, limit)
    .map((v) => ({ id: v.id, label: [v.make, v.model, v.generation, v.engineLabel].filter(Boolean).join(" "), sub: [v.engineCode, v.fuel, v.yearFrom ? `${v.yearFrom}–${v.yearTo ?? "…"}` : null].filter(Boolean).join(" · ") }));
}

export function getCompatibilityStats() {
  const row = getSqlite()
    .prepare(
      `SELECT (SELECT COUNT(*) FROM compatibilities) AS total,
              (SELECT COUNT(*) FROM compatibilities WHERE status = 'VERIFIED') AS verified,
              (SELECT COUNT(DISTINCT part_id) FROM compatibilities) AS partsWithVehicles,
              (SELECT COUNT(*) FROM parts WHERE is_active = 1) AS activeParts,
              (SELECT COUNT(*) FROM vehicles) AS vehicles`,
    )
    .get() as { total: number; verified: number; partsWithVehicles: number; activeParts: number; vehicles: number };
  return row;
}

/** Compatibility links awaiting verification (for the review queue). */
export function listUnverifiedCompatibilities(limit = 100) {
  return getSqlite()
    .prepare(
      `SELECT c.part_id AS partId, c.vehicle_id AS vehicleId, c.source, c.note, c.created_at AS createdAt,
              p.reference, p.designation, b.name AS brand,
              mk.name AS make, md.name AS model, md.generation, v.engine_label AS engineLabel, v.engine_code AS engineCode
       FROM compatibilities c
       JOIN parts p ON p.id = c.part_id
       LEFT JOIN brands b ON b.id = p.brand_id
       JOIN vehicles v ON v.id = c.vehicle_id
       JOIN vehicle_models md ON md.id = v.model_id
       JOIN vehicle_makes mk ON mk.id = md.make_id
       WHERE c.status = 'UNVERIFIED' AND p.is_active = 1
       ORDER BY c.created_at DESC, p.reference
       LIMIT ?`,
    )
    .all(limit) as {
    partId: number;
    vehicleId: number;
    source: string | null;
    note: string | null;
    createdAt: string;
    reference: string;
    designation: string;
    brand: string | null;
    make: string;
    model: string;
    generation: string | null;
    engineLabel: string;
    engineCode: string | null;
  }[];
}

/** Active parts with no vehicle association at all (data gap, not "universal"). */
export function listPartsWithoutCompatibility(limit = 100) {
  return getSqlite()
    .prepare(
      `SELECT p.id, p.reference, p.designation, b.name AS brand, c.name AS category, p.quantity, p.min_stock AS minStock
       FROM parts p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.is_active = 1 AND NOT EXISTS (SELECT 1 FROM compatibilities x WHERE x.part_id = p.id)
       ORDER BY p.quantity DESC, p.reference
       LIMIT ?`,
    )
    .all(limit) as { id: number; reference: string; designation: string; brand: string | null; category: string | null; quantity: number; minStock: number }[];
}

/** Coverage per make: how many vehicles / links / verified links. */
export function compatibilityCoverageByMake() {
  return getSqlite()
    .prepare(
      `SELECT mk.id, mk.name,
              COUNT(DISTINCT v.id) AS vehicles,
              COUNT(c.part_id) AS links,
              SUM(CASE WHEN c.status = 'VERIFIED' THEN 1 ELSE 0 END) AS verified,
              COUNT(DISTINCT c.part_id) AS parts
       FROM vehicle_makes mk
       JOIN vehicle_models md ON md.make_id = mk.id
       JOIN vehicles v ON v.model_id = md.id
       LEFT JOIN compatibilities c ON c.vehicle_id = v.id
       GROUP BY mk.id ORDER BY links DESC, mk.name`,
    )
    .all() as { id: number; name: string; vehicles: number; links: number; verified: number; parts: number }[];
}
