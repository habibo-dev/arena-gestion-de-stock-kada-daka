import "server-only";
import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { getDb, getSqlite, schema } from "@/server/db/client";
import { applyStockMovement, withTransaction } from "./inventory";
import { getSetting } from "./settings";
import type { Paginated } from "./parts";
import { round2 } from "@/lib/stock";
import { BusinessError } from "@/lib/result";

export type PurchaseStatus = "BROUILLON" | "COMMANDEE" | "RECUE" | "ANNULEE";

export type PurchaseItemInput = { partId: number; quantity: number; unitCost: number };

export type PurchaseInput = {
  supplierId: number;
  supplierInvoiceNumber?: string | null;
  expectedAt?: string | null;
  notes?: string | null;
  items: PurchaseItemInput[];
};

export type PurchaseListItem = {
  id: number;
  number: string;
  status: PurchaseStatus;
  supplierName: string | null;
  supplierId: number | null;
  total: number;
  itemCount: number;
  userName: string | null;
  purchaseDate: string;
  receivedAt: string | null;
  expectedAt: string | null;
};

export type PurchaseFilters = {
  status?: PurchaseStatus | "ALL";
  q?: string;
  from?: string;
  to?: string;
  supplierId?: number;
  page?: number;
  pageSize?: number;
};

function nextNumber(prefix: string): string {
  const sqlite = getSqlite();
  const year = new Date().getFullYear();
  const row = sqlite.prepare(`SELECT number FROM purchases WHERE number LIKE ? ORDER BY number DESC LIMIT 1`).get(`${prefix}-${year}-%`) as { number: string } | undefined;
  const last = row ? Number(row.number.split("-").pop()) : 0;
  return `${prefix}-${year}-${String((Number.isFinite(last) ? last : 0) + 1).padStart(4, "0")}`;
}

export function listPurchases(filters: PurchaseFilters = {}): Paginated<PurchaseListItem> {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, filters.pageSize ?? 25));
  const conds: SQL[] = [];
  if (filters.status && filters.status !== "ALL") conds.push(eq(schema.purchases.status, filters.status));
  if (filters.from) conds.push(gte(schema.purchases.purchaseDate, filters.from));
  if (filters.to) conds.push(lte(schema.purchases.purchaseDate, filters.to));
  if (filters.supplierId) conds.push(eq(schema.purchases.supplierId, filters.supplierId));
  if (filters.q?.trim()) {
    const t = `%${filters.q.trim().toLowerCase()}%`;
    conds.push(sql`(lower(${schema.purchases.number}) LIKE ${t} OR lower(coalesce(${schema.suppliers.name}, '')) LIKE ${t} OR lower(coalesce(${schema.purchases.supplierInvoiceNumber}, '')) LIKE ${t})`);
  }
  const where = conds.length ? and(...conds) : undefined;

  const rows = db
    .select({
      id: schema.purchases.id,
      number: schema.purchases.number,
      status: schema.purchases.status,
      supplierName: schema.suppliers.name,
      supplierId: schema.purchases.supplierId,
      total: schema.purchases.total,
      itemCount: sql<number>`(SELECT COALESCE(SUM(quantity),0) FROM purchase_items WHERE purchase_id = ${schema.purchases.id})`,
      userName: schema.users.fullName,
      purchaseDate: schema.purchases.purchaseDate,
      receivedAt: schema.purchases.receivedAt,
      expectedAt: schema.purchases.expectedAt,
    })
    .from(schema.purchases)
    .leftJoin(schema.suppliers, eq(schema.suppliers.id, schema.purchases.supplierId))
    .leftJoin(schema.users, eq(schema.users.id, schema.purchases.userId))
    .where(where)
    .orderBy(desc(schema.purchases.purchaseDate), desc(schema.purchases.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();
  const countRow = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.purchases)
    .leftJoin(schema.suppliers, eq(schema.suppliers.id, schema.purchases.supplierId))
    .where(where)
    .get();
  const count = countRow?.count ?? 0;
  return { items: rows, total: count, page, pageSize, pageCount: Math.max(1, Math.ceil(count / pageSize)) };
}

export type PurchaseDetail = NonNullable<ReturnType<typeof getPurchase>>;

export function getPurchase(id: number) {
  const db = getDb();
  const purchase = db.query.purchases.findFirst({
    where: eq(schema.purchases.id, id),
    with: {
      supplier: true,
      user: { columns: { id: true, fullName: true } },
      items: { with: { part: { columns: { id: true, quantity: true, imagePath: true, purchasePrice: true, unit: true } } } },
    },
  }).sync();
  return purchase ?? null;
}

function validateItems(items: PurchaseItemInput[]) {
  if (items.length === 0) throw new BusinessError("Ajoutez au moins une pièce à l'achat.");
  for (const it of items) {
    if (!Number.isInteger(it.quantity) || it.quantity <= 0) throw new BusinessError("Les quantités doivent être des entiers positifs.");
    if (!Number.isFinite(it.unitCost) || it.unitCost < 0) throw new BusinessError("Prix d'achat invalide.");
  }
  const ids = items.map((i) => i.partId);
  if (new Set(ids).size !== ids.length) throw new BusinessError("Une même pièce apparaît plusieurs fois : regroupez les lignes.");
}

function writeItems(purchaseId: number, items: PurchaseItemInput[]) {
  const db = getDb();
  db.delete(schema.purchaseItems).where(eq(schema.purchaseItems.purchaseId, purchaseId)).run();
  for (const it of items) {
    const p = db
      .select({ reference: schema.parts.reference, designation: schema.parts.designation })
      .from(schema.parts)
      .where(eq(schema.parts.id, it.partId))
      .get();
    if (!p) throw new BusinessError(`Pièce #${it.partId} introuvable.`);
    db.insert(schema.purchaseItems)
      .values({
        purchaseId,
        partId: it.partId,
        reference: p.reference,
        designation: p.designation,
        quantity: it.quantity,
        unitCost: round2(it.unitCost),
        lineTotal: round2(it.quantity * it.unitCost),
      })
      .run();
  }
}

export function createPurchase(input: PurchaseInput, userId: number, action: "DRAFT" | "ORDER" | "RECEIVE"): { id: number; number: string } {
  validateItems(input.items);
  return withTransaction((db) => {
    const supplier = db.select({ id: schema.suppliers.id }).from(schema.suppliers).where(eq(schema.suppliers.id, input.supplierId)).get();
    if (!supplier) throw new BusinessError("Fournisseur introuvable.");
    const subtotal = round2(input.items.reduce((acc, i) => acc + i.quantity * i.unitCost, 0));
    const now = new Date().toISOString();
    const number = nextNumber(getSetting("purchases.numberPrefix"));
    const [purchase] = db
      .insert(schema.purchases)
      .values({
        number,
        status: "BROUILLON",
        supplierId: input.supplierId,
        supplierInvoiceNumber: input.supplierInvoiceNumber?.trim() || null,
        expectedAt: input.expectedAt || null,
        subtotal,
        total: subtotal,
        notes: input.notes?.trim() || null,
        userId,
        purchaseDate: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: schema.purchases.id, number: schema.purchases.number })
      .all();
    writeItems(purchase!.id, input.items);
    if (action === "ORDER") markOrderedInTx(purchase!.id);
    if (action === "RECEIVE") {
      markOrderedInTx(purchase!.id);
      receiveInTx(purchase!.id, userId);
    }
    return { id: purchase!.id, number: purchase!.number };
  });
}

export function updatePurchase(id: number, input: PurchaseInput, userId: number, action: "DRAFT" | "ORDER" | "RECEIVE"): void {
  validateItems(input.items);
  withTransaction((db) => {
    const existing = db.select({ status: schema.purchases.status }).from(schema.purchases).where(eq(schema.purchases.id, id)).get();
    if (!existing) throw new BusinessError("Achat introuvable.");
    if (existing.status !== "BROUILLON" && existing.status !== "COMMANDEE") throw new BusinessError("Seuls les achats en brouillon ou commandés peuvent être modifiés.");
    const subtotal = round2(input.items.reduce((acc, i) => acc + i.quantity * i.unitCost, 0));
    db.update(schema.purchases)
      .set({
        supplierId: input.supplierId,
        supplierInvoiceNumber: input.supplierInvoiceNumber?.trim() || null,
        expectedAt: input.expectedAt || null,
        subtotal,
        total: subtotal,
        notes: input.notes?.trim() || null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.purchases.id, id))
      .run();
    writeItems(id, input.items);
    if (action === "ORDER" && existing.status === "BROUILLON") markOrderedInTx(id);
    if (action === "RECEIVE") {
      if (existing.status === "BROUILLON") markOrderedInTx(id);
      receiveInTx(id, userId);
    }
  });
}

function markOrderedInTx(id: number) {
  const db = getDb();
  const now = new Date().toISOString();
  db.update(schema.purchases).set({ status: "COMMANDEE", orderedAt: now, updatedAt: now }).where(eq(schema.purchases.id, id)).run();
}

/** Receiving a purchase increases stock for each line and records ENTREE_ACHAT movements. */
function receiveInTx(id: number, userId: number) {
  const db = getDb();
  const purchase = db.select().from(schema.purchases).where(eq(schema.purchases.id, id)).get();
  if (!purchase) throw new BusinessError("Achat introuvable.");
  if (purchase.status === "RECUE") throw new BusinessError("Cet achat a déjà été réceptionné.");
  if (purchase.status === "ANNULEE") throw new BusinessError("Cet achat est annulé.");
  const items = db.select().from(schema.purchaseItems).where(eq(schema.purchaseItems.purchaseId, id)).all();
  if (items.length === 0) throw new BusinessError("L'achat ne contient aucune ligne.");
  const now = new Date().toISOString();
  for (const it of items) {
    applyStockMovement(db, {
      partId: it.partId,
      type: "ENTREE_ACHAT",
      quantity: it.quantity,
      userId,
      reason: `Réception ${purchase.number}`,
      unitCost: it.unitCost,
      documentType: "PURCHASE",
      documentId: purchase.id,
      documentNumber: purchase.number,
      createdAt: now,
    });
    // Keep the part's purchase price in sync with the latest cost.
    db.update(schema.parts).set({ purchasePrice: it.unitCost, updatedAt: now }).where(eq(schema.parts.id, it.partId)).run();
  }
  db.update(schema.purchases).set({ status: "RECUE", receivedAt: now, updatedAt: now }).where(eq(schema.purchases.id, id)).run();
}

export function markPurchaseOrdered(id: number): void {
  withTransaction((db) => {
    const p = db.select({ status: schema.purchases.status }).from(schema.purchases).where(eq(schema.purchases.id, id)).get();
    if (!p) throw new BusinessError("Achat introuvable.");
    if (p.status !== "BROUILLON") throw new BusinessError("Seul un brouillon peut être passé en commande.");
    markOrderedInTx(id);
  });
}

export function receivePurchase(id: number, userId: number): void {
  withTransaction((db) => {
    const p = db.select({ status: schema.purchases.status }).from(schema.purchases).where(eq(schema.purchases.id, id)).get();
    if (!p) throw new BusinessError("Achat introuvable.");
    if (p.status === "BROUILLON") markOrderedInTx(id);
    receiveInTx(id, userId);
  });
}

/** Cancels a purchase. A received purchase is reversed through RETOUR_FOURNISSEUR movements. */
export function cancelPurchase(id: number, userId: number, reason?: string | null): void {
  withTransaction((db) => {
    const purchase = db.select().from(schema.purchases).where(eq(schema.purchases.id, id)).get();
    if (!purchase) throw new BusinessError("Achat introuvable.");
    if (purchase.status === "ANNULEE") throw new BusinessError("Cet achat est déjà annulé.");
    const now = new Date().toISOString();
    if (purchase.status === "RECUE") {
      const items = db.select().from(schema.purchaseItems).where(eq(schema.purchaseItems.purchaseId, id)).all();
      for (const it of items) {
        applyStockMovement(db, {
          partId: it.partId,
          type: "RETOUR_FOURNISSEUR",
          quantity: -it.quantity,
          userId,
          reason: reason?.trim() || `Annulation achat ${purchase.number}`,
          unitCost: it.unitCost,
          documentType: "PURCHASE",
          documentId: purchase.id,
          documentNumber: purchase.number,
          createdAt: now,
        });
      }
    }
    db.update(schema.purchases)
      .set({ status: "ANNULEE", cancelledAt: now, updatedAt: now, notes: reason?.trim() ? `${purchase.notes ? purchase.notes + "\n" : ""}Annulation : ${reason.trim()}` : purchase.notes })
      .where(eq(schema.purchases.id, id))
      .run();
  });
}

export function deleteDraftPurchase(id: number): void {
  const db = getDb();
  const p = db.select({ status: schema.purchases.status }).from(schema.purchases).where(eq(schema.purchases.id, id)).get();
  if (!p) throw new BusinessError("Achat introuvable.");
  if (p.status !== "BROUILLON") throw new BusinessError("Seul un brouillon peut être supprimé.");
  db.delete(schema.purchases).where(eq(schema.purchases.id, id)).run();
}

/** Suggested reorder lines: active parts at or below minimum stock, grouped by their main supplier. */
export function getReorderSuggestions(supplierId?: number) {
  const sqlite = getSqlite();
  const rows = sqlite
    .prepare(
      `SELECT p.id, p.reference, p.designation, p.quantity, p.min_stock AS minStock, p.purchase_price AS purchasePrice,
              p.supplier_id AS supplierId, s.name AS supplierName, b.name AS brand
       FROM parts p LEFT JOIN suppliers s ON s.id = p.supplier_id LEFT JOIN brands b ON b.id = p.brand_id
       WHERE p.is_active = 1 AND (p.quantity <= 0 OR (p.min_stock > 0 AND p.quantity <= p.min_stock))
         ${supplierId ? "AND p.supplier_id = ?" : ""}
       ORDER BY (p.quantity <= 0) DESC, p.reference`,
    )
    .all(...(supplierId ? [supplierId] : [])) as {
    id: number;
    reference: string;
    designation: string;
    quantity: number;
    minStock: number;
    purchasePrice: number;
    supplierId: number | null;
    supplierName: string | null;
    brand: string | null;
  }[];
  return rows.map((r) => ({ ...r, suggestedQuantity: Math.max(r.minStock * 2 - r.quantity, 1) }));
}
