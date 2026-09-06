import type Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { subDays, subMinutes, setHours, setMinutes } from "date-fns";
import type { DB } from "./client";
import * as s from "./schema";
import { rebuildSearchIndex } from "./search-index";
import { normalizeReference, normalizeText, slugify } from "@/lib/references";
import { buildVehicleSearchText } from "@/lib/vehicles";
import { computeDiscount, round2 } from "@/lib/stock";
import {
  SEED_BRANDS,
  SEED_CATEGORIES,
  SEED_CUSTOMERS,
  SEED_LOCATIONS,
  SEED_PARTS,
  SEED_SUPPLIERS,
  SEED_USERS,
  SEED_VEHICLES,
} from "./seed-data";

/** Deterministic pseudo-random generator so demo data is stable between resets. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** UTC ISO timestamp for a local wall-clock time `daysAgo` days ago. All timestamps are stored as UTC ISO strings. */
function isoAt(daysAgo: number, hour: number, minute: number): string {
  const d = setMinutes(setHours(subDays(new Date(), daysAgo), hour), minute);
  return d.toISOString();
}

/** UTC ISO timestamp `minutesAgo` minutes before now. */
function isoMinutesAgo(minutesAgo: number): string {
  return subMinutes(new Date(), minutesAgo).toISOString();
}

export function seedIfEmpty(db: DB, sqlite: Database.Database): void {
  if (process.env.SEED_DEMO_DATA === "false") return;
  const count = sqlite.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number };
  if (count.c > 0) return;
  runSeed(db, sqlite);
}

export function runSeed(db: DB, sqlite: Database.Database): void {
  const rand = mulberry32(20260411);
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)] as T;
  const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

  const seedTx = sqlite.transaction(() => {
    /* ------------------------------ Users --------------------------------- */
    const userIds: Record<string, number> = {};
    for (const u of SEED_USERS) {
      const [row] = db
        .insert(s.users)
        .values({
          username: u.username,
          fullName: u.fullName,
          email: u.email,
          role: u.role,
          passwordHash: bcrypt.hashSync(u.password, 10),
        })
        .returning({ id: s.users.id })
        .all();
      userIds[u.username] = row!.id;
    }
    const adminId = userIds.admin!;
    const managerId = userIds.gerant!;
    const employeeId = userIds.vendeur!;

    /* --------------------------- Reference data ----------------------------- */
    const categoryIds = new Map<string, number>();
    SEED_CATEGORIES.forEach((name, i) => {
      const [row] = db
        .insert(s.categories)
        .values({ name, slug: slugify(name), sortOrder: i })
        .returning({ id: s.categories.id })
        .all();
      categoryIds.set(name, row!.id);
    });

    const brandIds = new Map<string, number>();
    for (const b of SEED_BRANDS) {
      const [row] = db
        .insert(s.brands)
        .values({ name: b.name, normalizedName: normalizeText(b.name), country: b.country, isOem: b.isOem ?? false })
        .returning({ id: s.brands.id })
        .all();
      brandIds.set(b.name, row!.id);
    }

    const locationIds = new Map<string, number>();
    for (const l of SEED_LOCATIONS) {
      const [row] = db.insert(s.locations).values(l).returning({ id: s.locations.id }).all();
      locationIds.set(l.code, row!.id);
    }

    const supplierIds: number[] = [];
    for (const sup of SEED_SUPPLIERS) {
      const [row] = db.insert(s.suppliers).values(sup).returning({ id: s.suppliers.id }).all();
      supplierIds.push(row!.id);
    }

    const customerIds: number[] = [];
    for (const c of SEED_CUSTOMERS) {
      const [row] = db.insert(s.customers).values(c).returning({ id: s.customers.id }).all();
      customerIds.push(row!.id);
    }

    /* ------------------------------ Vehicles -------------------------------- */
    const makeIds = new Map<string, number>();
    const modelIds = new Map<string, number>();
    const vehicleIds = new Map<string, number>();

    for (const v of SEED_VEHICLES) {
      if (!makeIds.has(v.make)) {
        const [row] = db
          .insert(s.vehicleMakes)
          .values({ name: v.make, normalizedName: normalizeText(v.make) })
          .returning({ id: s.vehicleMakes.id })
          .all();
        makeIds.set(v.make, row!.id);
      }
      const modelKey = `${v.make}|${v.model}|${v.generation}`;
      if (!modelIds.has(modelKey)) {
        const [row] = db
          .insert(s.vehicleModels)
          .values({
            makeId: makeIds.get(v.make)!,
            name: v.model,
            generation: v.generation,
            yearFrom: v.modelYearFrom,
            yearTo: v.modelYearTo,
          })
          .returning({ id: s.vehicleModels.id })
          .all();
        modelIds.set(modelKey, row!.id);
      }
      const searchText = buildVehicleSearchText({
        make: v.make,
        model: v.model,
        generation: v.generation,
        aliases: v.aliases ?? null,
        engineLabel: v.engineLabel,
        engineCode: v.engineCode,
        fuel: v.fuel,
        displacement: v.displacement,
        yearFrom: v.yearFrom,
        yearTo: v.yearTo,
      });
      const [row] = db
        .insert(s.vehicles)
        .values({
          modelId: modelIds.get(modelKey)!,
          engineLabel: v.engineLabel,
          displacement: v.displacement,
          fuel: v.fuel,
          powerHp: v.powerHp,
          powerKw: Math.round(v.powerHp * 0.7355),
          engineCode: v.engineCode,
          yearFrom: v.yearFrom,
          yearTo: v.yearTo,
          searchText,
        })
        .returning({ id: s.vehicles.id })
        .all();
      vehicleIds.set(v.key, row!.id);
    }

    /* -------------------------------- Parts --------------------------------- */
    const partIds: number[] = [];
    const partSeedById = new Map<number, (typeof SEED_PARTS)[number]>();
    const createdAtBase = 120; // parts created ~4 months ago

    for (const p of SEED_PARTS) {
      const createdAt = isoAt(createdAtBase - randInt(0, 20), randInt(8, 17), randInt(0, 59));
      const [row] = db
        .insert(s.parts)
        .values({
          reference: p.reference,
          referenceNormalized: normalizeReference(p.reference),
          referenceRaw: p.referenceRaw ?? null,
          designation: p.designation,
          description: p.description ?? null,
          brandId: brandIds.get(p.brand) ?? null,
          categoryId: categoryIds.get(p.category) ?? null,
          locationId: locationIds.get(p.location) ?? null,
          supplierId: supplierIds[p.supplier] ?? null,
          unit: p.unit ?? "Pièce",
          purchasePrice: p.purchasePrice,
          wholesalePrice: p.wholesalePrice,
          retailPrice: p.retailPrice,
          quantity: 0,
          minStock: p.minStock,
          barcode: p.barcode ?? null,
          keywords: p.keywords ?? null,
          createdAt,
          updatedAt: createdAt,
        })
        .returning({ id: s.parts.id })
        .all();
      const partId = row!.id;
      partIds.push(partId);
      partSeedById.set(partId, p);

      for (const oem of p.oem ?? []) {
        db.insert(s.partReferences)
          .values({ partId, type: "OEM", reference: oem, referenceNormalized: normalizeReference(oem) })
          .run();
      }
      for (const alt of p.alt ?? []) {
        db.insert(s.partReferences)
          .values({ partId, type: "ALTERNATIVE", reference: alt, referenceNormalized: normalizeReference(alt) })
          .run();
      }
      for (const vk of p.vehicles) {
        const vehicleId = vehicleIds.get(vk);
        if (!vehicleId) continue;
        db.insert(s.compatibilities)
          .values({ partId, vehicleId, status: "VERIFIED", source: "Catalogue fournisseur" })
          .run();
      }
    }

    /* ---------------------- Stock history (movements) ----------------------- */
    // Local helper that mirrors the application's inventory service, but lets us
    // back-date movements to build a believable history.
    const currentQty = new Map<number, number>();
    for (const id of partIds) currentQty.set(id, 0);

    const getPart = sqlite.prepare("SELECT quantity FROM parts WHERE id = ?");
    const updateQty = sqlite.prepare("UPDATE parts SET quantity = ?, updated_at = ? WHERE id = ?");

    function applyMovement(input: {
      partId: number;
      type: s.MovementType;
      qty: number;
      at: string;
      userId: number;
      reason?: string;
      documentType?: "SALE" | "PURCHASE" | "ADJUSTMENT" | "IMPORT" | "RETURN";
      documentId?: number;
      documentNumber?: string;
      unitCost?: number;
    }) {
      const { quantity: previous } = getPart.get(input.partId) as { quantity: number };
      const next = previous + input.qty;
      if (next < 0) throw new Error(`Seed would produce negative stock for part ${input.partId}`);
      updateQty.run(next, input.at, input.partId);
      db.insert(s.stockMovements)
        .values({
          partId: input.partId,
          type: input.type,
          quantity: input.qty,
          previousQuantity: previous,
          newQuantity: next,
          unitCost: input.unitCost ?? null,
          reason: input.reason ?? null,
          documentType: input.documentType ?? null,
          documentId: input.documentId ?? null,
          documentNumber: input.documentNumber ?? null,
          userId: input.userId,
          createdAt: input.at,
        })
        .run();
      currentQty.set(input.partId, next);
    }

    // 1) Initial stock take ("Inventaire initial") ~100 days ago, quantity = target + later sales - later purchases.
    //    To keep things simple: we load target + a buffer now, then sales/purchases below shape the history,
    //    and a final reconciliation adjusts to the target quantity.
    const initialAt = isoAt(100, 9, 0);
    let importBatchId: number | undefined;
    {
      const [batch] = db
        .insert(s.importBatches)
        .values({
          fileName: "Liste des Articles samedi 11-04-2026.xlsx",
          sheetName: "Articles",
          totalRows: SEED_PARTS.length,
          importedRows: SEED_PARTS.length,
          skippedRows: 0,
          mapping: JSON.stringify({
            Référence: "reference",
            Désignation: "designation",
            Marque: "brand",
            Quantité: "quantity",
            "Prix d'Achat": "purchasePrice",
            "Prix Gros": "wholesalePrice",
            "Prix Détail": "retailPrice",
            UM: "unit",
            Rayon: "location",
          }),
          userId: adminId,
          createdAt: initialAt,
        })
        .returning({ id: s.importBatches.id })
        .all();
      importBatchId = batch!.id;
    }
    for (const partId of partIds) {
      const seed = partSeedById.get(partId)!;
      const initial = Math.max(seed.quantity + randInt(2, 6), 1);
      applyMovement({
        partId,
        type: "IMPORT",
        qty: initial,
        at: initialAt,
        userId: adminId,
        reason: "Inventaire initial — import Excel",
        documentType: "IMPORT",
        documentId: importBatchId,
        documentNumber: "Liste des Articles samedi 11-04-2026.xlsx",
        unitCost: seed.purchasePrice,
      });
    }

    /* ------------------- Purchases & sales (chronological) ------------------ */
    // All documents are generated as dated events first and then applied in
    // strict chronological order so that every movement's previous/new
    // quantity chain is consistent when read back in time order.
    type Event =
      | { kind: "purchase"; at: string; supplierId: number; partIds: number[]; status: "RECUE" | "COMMANDEE" }
      | { kind: "sale"; at: string; customerIdx: number }
      | { kind: "adjust"; at: string; partIdx: number; qty: number; type: s.MovementType; reason: string; documentType: "ADJUSTMENT" | "RETURN" };

    const events: Event[] = [];

    const partsBySupplier = new Map<number, number[]>();
    for (const partId of partIds) {
      const seed = partSeedById.get(partId)!;
      const supId = supplierIds[seed.supplier]!;
      if (!partsBySupplier.has(supId)) partsBySupplier.set(supId, []);
      partsBySupplier.get(supId)!.push(partId);
    }

    for (const daysAgo of [88, 74, 61, 47, 33, 21, 12, 5, 1]) {
      const supplierId = pick(supplierIds);
      const pool = partsBySupplier.get(supplierId) ?? partIds;
      const chosen = [...pool].sort(() => rand() - 0.5).slice(0, Math.min(pool.length, randInt(3, 7)));
      events.push({ kind: "purchase", at: isoAt(daysAgo, randInt(9, 11), randInt(0, 59)), supplierId, partIds: chosen, status: "RECUE" });
    }
    {
      const supplierId = supplierIds[0]!;
      const pool = partsBySupplier.get(supplierId)!;
      const chosen = [...pool].sort(() => rand() - 0.5).slice(0, 4);
      events.push({ kind: "purchase", at: isoAt(2, 15, 20), supplierId, partIds: chosen, status: "COMMANDEE" });
    }

    for (let daysAgo = 89; daysAgo >= 0; daysAgo--) {
      const dow = subDays(new Date(), daysAgo).getDay();
      if (dow === 5) continue; // shop closed on Friday
      const salesToday = daysAgo === 0 ? 3 : randInt(1, 5);
      for (let n = 0; n < salesToday; n++) {
        // Today's sales are placed in the last few hours so the dashboard shows live activity.
        const at = daysAgo === 0 ? isoMinutesAgo(randInt(25, 200)) : isoAt(daysAgo, randInt(8, 18), randInt(0, 59));
        events.push({ kind: "sale", at, customerIdx: rand() < 0.5 ? 0 : randInt(0, customerIds.length - 1) });
      }
    }

    events.push({ kind: "adjust", at: isoAt(15, 17, 45), partIdx: 0, qty: -1, type: "AJUSTEMENT_NEGATIF", reason: "Article endommagé (emballage ouvert)", documentType: "ADJUSTMENT" });
    events.push({ kind: "adjust", at: isoAt(9, 11, 10), partIdx: 17, qty: 1, type: "RETOUR_CLIENT", reason: "Retour client — mauvaise référence commandée", documentType: "RETURN" });

    events.sort((a, b) => a.at.localeCompare(b.at));

    let purchaseSeq = 0;
    let saleSeq = 0;
    const paymentMethods = ["ESPECES", "ESPECES", "ESPECES", "CARTE", "VIREMENT", "CREDIT"] as const;
    const fastMovers = partIds.filter((id) => {
      const seed = partSeedById.get(id)!;
      return ["Filtration", "Freinage", "Allumage", "Lubrification"].includes(seed.category);
    });

    for (const ev of events) {
      const d = new Date(ev.at);
      if (ev.kind === "purchase") {
        const number = `ACH-${d.getFullYear()}-${String(++purchaseSeq).padStart(4, "0")}`;
        const items = ev.partIds.map((partId) => {
          const seed = partSeedById.get(partId)!;
          const qty = randInt(2, 12);
          return { partId, seed, qty, unitCost: seed.purchasePrice, lineTotal: round2(qty * seed.purchasePrice) };
        });
        const subtotal = round2(items.reduce((acc, i) => acc + i.lineTotal, 0));
        const orderedAt = subDays(d, 2).toISOString();
        const isReceived = ev.status === "RECUE";
        const [purchase] = db
          .insert(s.purchases)
          .values({
            number,
            status: ev.status,
            supplierId: ev.supplierId,
            supplierInvoiceNumber: isReceived ? `F-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}-${randInt(100, 999)}` : null,
            subtotal,
            total: subtotal,
            userId: managerId,
            orderedAt,
            receivedAt: isReceived ? ev.at : null,
            expectedAt: isReceived ? null : isoAt(-3, 10, 0),
            purchaseDate: orderedAt,
            createdAt: orderedAt,
            updatedAt: ev.at,
            notes: isReceived ? null : "Commande hebdomadaire — livraison prévue jeudi.",
          })
          .returning({ id: s.purchases.id })
          .all();
        for (const it of items) {
          db.insert(s.purchaseItems)
            .values({ purchaseId: purchase!.id, partId: it.partId, reference: it.seed.reference, designation: it.seed.designation, quantity: it.qty, unitCost: it.unitCost, lineTotal: it.lineTotal })
            .run();
          if (isReceived) {
            applyMovement({ partId: it.partId, type: "ENTREE_ACHAT", qty: it.qty, at: ev.at, userId: managerId, reason: `Réception ${number}`, documentType: "PURCHASE", documentId: purchase!.id, documentNumber: number, unitCost: it.unitCost });
          }
        }
      } else if (ev.kind === "sale") {
        const customerId = customerIds[ev.customerIdx]!;
        const customer = SEED_CUSTOMERS[ev.customerIdx]!;
        const priceTier = customer.customerType === "PROFESSIONNEL" ? "GROS" : "DETAIL";
        const pool = rand() < 0.75 ? fastMovers : partIds;
        const chosenIds = [...new Set(Array.from({ length: randInt(1, 4) }, () => pick(pool)))];
        const items: { partId: number; qty: number; unitPrice: number; unitCost: number; seed: (typeof SEED_PARTS)[number] }[] = [];
        for (const partId of chosenIds) {
          const available = currentQty.get(partId) ?? 0;
          if (available <= 1) continue;
          const seed = partSeedById.get(partId)!;
          const qty = Math.min(randInt(1, 3), available - 1);
          if (qty <= 0) continue;
          items.push({ partId, qty, unitPrice: priceTier === "GROS" ? seed.wholesalePrice : seed.retailPrice, unitCost: seed.purchasePrice, seed });
        }
        if (items.length === 0) continue;
        const number = `VTE-${d.getFullYear()}-${String(++saleSeq).padStart(4, "0")}`;
        const subtotal = round2(items.reduce((acc, i) => acc + i.qty * i.unitPrice, 0));
        const discountType = rand() < 0.2 ? "PERCENT" : "NONE";
        const discountValue = discountType === "PERCENT" ? pick([5, 10]) : 0;
        const { discountAmount, total } = computeDiscount(subtotal, discountType, discountValue);
        const sellerId = rand() < 0.7 ? employeeId : managerId;
        const [sale] = db
          .insert(s.sales)
          .values({
            number,
            status: "CONFIRMEE",
            customerId,
            customerName: customer.name,
            customerPhone: customer.phone ?? null,
            priceTier,
            paymentMethod: pick(paymentMethods),
            subtotal,
            discountType,
            discountValue,
            discountAmount,
            total,
            userId: sellerId,
            confirmedAt: ev.at,
            saleDate: ev.at,
            createdAt: ev.at,
            updatedAt: ev.at,
          })
          .returning({ id: s.sales.id })
          .all();
        for (const it of items) {
          db.insert(s.saleItems)
            .values({ saleId: sale!.id, partId: it.partId, reference: it.seed.reference, designation: it.seed.designation, quantity: it.qty, unitPrice: it.unitPrice, unitCost: it.unitCost, lineTotal: round2(it.qty * it.unitPrice) })
            .run();
          applyMovement({ partId: it.partId, type: "SORTIE_VENTE", qty: -it.qty, at: ev.at, userId: sellerId, reason: `Vente ${number}`, documentType: "SALE", documentId: sale!.id, documentNumber: number, unitCost: it.unitCost });
        }
      } else {
        const partId = partIds[ev.partIdx]!;
        if ((currentQty.get(partId) ?? 0) + ev.qty < 0) continue;
        applyMovement({ partId, type: ev.type, qty: ev.qty, at: ev.at, userId: ev.type === "RETOUR_CLIENT" ? employeeId : managerId, reason: ev.reason, documentType: ev.documentType });
      }
    }

    // 2) Final reconciliation so that stock matches the demo target quantities
    //    (recorded transparently as an "Inventaire" movement, never silently).
    const reconcileAt = isoMinutesAgo(10);
    for (const partId of partIds) {
      const seed = partSeedById.get(partId)!;
      const current = currentQty.get(partId) ?? 0;
      const diff = seed.quantity - current;
      if (diff === 0) continue;
      applyMovement({
        partId,
        type: "INVENTAIRE",
        qty: diff,
        at: reconcileAt,
        userId: adminId,
        reason: "Inventaire physique — régularisation",
        documentType: "ADJUSTMENT",
      });
    }

    /* ----------------------------- Settings --------------------------------- */
    const defaults: Record<string, string> = {
      "company.name": "Kada Daka Pièces Auto",
      "company.address": "Boufarik, Blida",
      "company.phone": "025 47 00 00",
      "stock.allowNegative": "false",
      "sales.defaultPriceTier": "DETAIL",
      "sales.numberPrefix": "VTE",
      "purchases.numberPrefix": "ACH",
      "currency.code": "DZD",
      "currency.symbol": "DA",
    };
    for (const [key, value] of Object.entries(defaults)) {
      db.insert(s.settings).values({ key, value }).run();
    }
  });

  seedTx();
  rebuildSearchIndex(sqlite);
}
