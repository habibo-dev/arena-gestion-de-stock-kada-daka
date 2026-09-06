import "server-only";
import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { getDb, getSqlite, schema } from "@/server/db/client";
import { applyStockMovement, withTransaction } from "./inventory";
import { getSetting } from "./settings";
import type { Paginated } from "./parts";
import { computeDiscount, round2 } from "@/lib/stock";
import { BusinessError } from "@/lib/result";

export type SaleStatus = "BROUILLON" | "CONFIRMEE" | "ANNULEE";
export type PriceTier = "DETAIL" | "GROS";
export type PaymentMethod = "ESPECES" | "CARTE" | "VIREMENT" | "CHEQUE" | "CREDIT";

export type SaleItemInput = { partId: number; quantity: number; unitPrice: number };

export type SaleInput = {
  customerId?: number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  priceTier: PriceTier;
  paymentMethod: PaymentMethod;
  discountType: "NONE" | "PERCENT" | "AMOUNT";
  discountValue: number;
  notes?: string | null;
  saleDate?: string | null;
  items: SaleItemInput[];
};

export type SaleListItem = {
  id: number;
  number: string;
  status: SaleStatus;
  customerName: string | null;
  priceTier: PriceTier;
  paymentMethod: PaymentMethod;
  total: number;
  itemCount: number;
  userName: string | null;
  saleDate: string;
};

export type SaleFilters = {
  status?: SaleStatus | "ALL";
  q?: string;
  from?: string;
  to?: string;
  customerId?: number;
  page?: number;
  pageSize?: number;
};

function nextNumber(prefix: string, table: "sales" | "purchases"): string {
  const sqlite = getSqlite();
  const year = new Date().getFullYear();
  const like = `${prefix}-${year}-%`;
  const row = sqlite.prepare(`SELECT number FROM ${table} WHERE number LIKE ? ORDER BY number DESC LIMIT 1`).get(like) as { number: string } | undefined;
  const last = row ? Number(row.number.split("-").pop()) : 0;
  return `${prefix}-${year}-${String((Number.isFinite(last) ? last : 0) + 1).padStart(4, "0")}`;
}

export function listSales(filters: SaleFilters = {}): Paginated<SaleListItem> {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, filters.pageSize ?? 25));
  const conds: SQL[] = [];
  if (filters.status && filters.status !== "ALL") conds.push(eq(schema.sales.status, filters.status));
  if (filters.from) conds.push(gte(schema.sales.saleDate, filters.from));
  if (filters.to) conds.push(lte(schema.sales.saleDate, filters.to));
  if (filters.customerId) conds.push(eq(schema.sales.customerId, filters.customerId));
  if (filters.q?.trim()) {
    const t = `%${filters.q.trim().toLowerCase()}%`;
    conds.push(sql`(lower(${schema.sales.number}) LIKE ${t} OR lower(coalesce(${schema.sales.customerName}, '')) LIKE ${t} OR lower(coalesce(${schema.sales.customerPhone}, '')) LIKE ${t})`);
  }
  const where = conds.length ? and(...conds) : undefined;

  const rows = db
    .select({
      id: schema.sales.id,
      number: schema.sales.number,
      status: schema.sales.status,
      customerName: schema.sales.customerName,
      priceTier: schema.sales.priceTier,
      paymentMethod: schema.sales.paymentMethod,
      total: schema.sales.total,
      itemCount: sql<number>`(SELECT COALESCE(SUM(quantity),0) FROM sale_items WHERE sale_id = ${schema.sales.id})`,
      userName: schema.users.fullName,
      saleDate: schema.sales.saleDate,
    })
    .from(schema.sales)
    .leftJoin(schema.users, eq(schema.users.id, schema.sales.userId))
    .where(where)
    .orderBy(desc(schema.sales.saleDate), desc(schema.sales.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();
  const count = db.select({ count: sql<number>`count(*)` }).from(schema.sales).where(where).get()?.count ?? 0;
  return { items: rows, total: count, page, pageSize, pageCount: Math.max(1, Math.ceil(count / pageSize)) };
}

export type SaleDetail = NonNullable<ReturnType<typeof getSale>>;

export function getSale(id: number) {
  const db = getDb();
  const sale = db.query.sales.findFirst({
    where: eq(schema.sales.id, id),
    with: {
      customer: true,
      user: { columns: { id: true, fullName: true } },
      items: { with: { part: { columns: { id: true, quantity: true, imagePath: true, retailPrice: true, wholesalePrice: true, unit: true } } } },
    },
  }).sync();
  return sale ?? null;
}

function validateItems(items: SaleItemInput[]) {
  if (items.length === 0) throw new BusinessError("Ajoutez au moins une pièce à la vente.");
  for (const it of items) {
    if (!Number.isInteger(it.quantity) || it.quantity <= 0) throw new BusinessError("Les quantités doivent être des entiers positifs.");
    if (!Number.isFinite(it.unitPrice) || it.unitPrice < 0) throw new BusinessError("Prix unitaire invalide.");
  }
  const ids = items.map((i) => i.partId);
  if (new Set(ids).size !== ids.length) throw new BusinessError("Une même pièce apparaît plusieurs fois : regroupez les lignes.");
}

/** Server-side recomputation of totals. Client totals are never trusted. */
function computeTotals(items: { quantity: number; unitPrice: number }[], discountType: SaleInput["discountType"], discountValue: number) {
  const subtotal = round2(items.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0));
  const { discountAmount, total } = computeDiscount(subtotal, discountType, discountValue);
  return { subtotal, discountAmount, total };
}

type PartSnapshot = { id: number; reference: string; designation: string; purchasePrice: number; quantity: number; isActive: boolean };

function loadParts(ids: number[]): Map<number, PartSnapshot> {
  const db = getDb();
  const rows = db
    .select({
      id: schema.parts.id,
      reference: schema.parts.reference,
      designation: schema.parts.designation,
      purchasePrice: schema.parts.purchasePrice,
      quantity: schema.parts.quantity,
      isActive: schema.parts.isActive,
    })
    .from(schema.parts)
    .where(sql`${schema.parts.id} IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`)
    .all();
  return new Map(rows.map((r) => [r.id, r]));
}

function writeItems(saleId: number, items: SaleItemInput[], parts: Map<number, PartSnapshot>) {
  const db = getDb();
  db.delete(schema.saleItems).where(eq(schema.saleItems.saleId, saleId)).run();
  for (const it of items) {
    const p = parts.get(it.partId);
    if (!p) throw new BusinessError(`Pièce #${it.partId} introuvable.`);
    db.insert(schema.saleItems)
      .values({
        saleId,
        partId: it.partId,
        reference: p.reference,
        designation: p.designation,
        quantity: it.quantity,
        unitPrice: round2(it.unitPrice),
        unitCost: p.purchasePrice,
        lineTotal: round2(it.quantity * it.unitPrice),
      })
      .run();
  }
}

export function createSale(input: SaleInput, userId: number, confirm: boolean): { id: number; number: string } {
  validateItems(input.items);
  return withTransaction((db) => {
    const parts = loadParts(input.items.map((i) => i.partId));
    for (const it of input.items) {
      const p = parts.get(it.partId);
      if (!p) throw new BusinessError(`Pièce #${it.partId} introuvable.`);
      if (!p.isActive) throw new BusinessError(`La pièce ${p.reference} est archivée et ne peut pas être vendue.`);
    }
    const totals = computeTotals(input.items, input.discountType, input.discountValue);
    const now = new Date().toISOString();
    const number = nextNumber(getSetting("sales.numberPrefix"), "sales");
    const [sale] = db
      .insert(schema.sales)
      .values({
        number,
        status: "BROUILLON",
        customerId: input.customerId ?? null,
        customerName: input.customerName?.trim() || null,
        customerPhone: input.customerPhone?.trim() || null,
        priceTier: input.priceTier,
        paymentMethod: input.paymentMethod,
        subtotal: totals.subtotal,
        discountType: input.discountType,
        discountValue: input.discountValue,
        discountAmount: totals.discountAmount,
        total: totals.total,
        notes: input.notes?.trim() || null,
        userId,
        saleDate: input.saleDate ?? now,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: schema.sales.id, number: schema.sales.number })
      .all();
    writeItems(sale!.id, input.items, parts);
    if (confirm) confirmSaleInTx(sale!.id, userId);
    return { id: sale!.id, number: sale!.number };
  });
}

export function updateSale(id: number, input: SaleInput, userId: number, confirm: boolean): void {
  validateItems(input.items);
  withTransaction((db) => {
    const existing = db.select({ status: schema.sales.status }).from(schema.sales).where(eq(schema.sales.id, id)).get();
    if (!existing) throw new BusinessError("Vente introuvable.");
    if (existing.status !== "BROUILLON") throw new BusinessError("Seul un brouillon peut être modifié.");
    const parts = loadParts(input.items.map((i) => i.partId));
    const totals = computeTotals(input.items, input.discountType, input.discountValue);
    db.update(schema.sales)
      .set({
        customerId: input.customerId ?? null,
        customerName: input.customerName?.trim() || null,
        customerPhone: input.customerPhone?.trim() || null,
        priceTier: input.priceTier,
        paymentMethod: input.paymentMethod,
        subtotal: totals.subtotal,
        discountType: input.discountType,
        discountValue: input.discountValue,
        discountAmount: totals.discountAmount,
        total: totals.total,
        notes: input.notes?.trim() || null,
        ...(input.saleDate ? { saleDate: input.saleDate } : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.sales.id, id))
      .run();
    writeItems(id, input.items, parts);
    if (confirm) confirmSaleInTx(id, userId);
  });
}

/** Confirms a draft: decreases stock line by line and records one movement per line. */
function confirmSaleInTx(saleId: number, userId: number) {
  const db = getDb();
  const sale = db.select().from(schema.sales).where(eq(schema.sales.id, saleId)).get();
  if (!sale) throw new BusinessError("Vente introuvable.");
  if (sale.status !== "BROUILLON") throw new BusinessError("Cette vente n'est pas un brouillon.");
  const items = db.select().from(schema.saleItems).where(eq(schema.saleItems.saleId, saleId)).all();
  if (items.length === 0) throw new BusinessError("La vente ne contient aucune ligne.");
  const now = new Date().toISOString();
  for (const it of items) {
    applyStockMovement(db, {
      partId: it.partId,
      type: "SORTIE_VENTE",
      quantity: -it.quantity,
      userId,
      reason: `Vente ${sale.number}`,
      unitCost: it.unitCost,
      documentType: "SALE",
      documentId: sale.id,
      documentNumber: sale.number,
      createdAt: now,
    });
  }
  db.update(schema.sales).set({ status: "CONFIRMEE", confirmedAt: now, updatedAt: now }).where(eq(schema.sales.id, saleId)).run();
}

export function confirmSale(id: number, userId: number): void {
  withTransaction(() => confirmSaleInTx(id, userId));
}

/** Cancels a sale. A confirmed sale puts the goods back in stock through RETOUR_CLIENT movements. */
export function cancelSale(id: number, userId: number, reason?: string | null): void {
  withTransaction((db) => {
    const sale = db.select().from(schema.sales).where(eq(schema.sales.id, id)).get();
    if (!sale) throw new BusinessError("Vente introuvable.");
    if (sale.status === "ANNULEE") throw new BusinessError("Cette vente est déjà annulée.");
    const now = new Date().toISOString();
    if (sale.status === "CONFIRMEE") {
      const items = db.select().from(schema.saleItems).where(eq(schema.saleItems.saleId, id)).all();
      for (const it of items) {
        applyStockMovement(db, {
          partId: it.partId,
          type: "RETOUR_CLIENT",
          quantity: it.quantity,
          userId,
          reason: reason?.trim() || `Annulation vente ${sale.number}`,
          unitCost: it.unitCost,
          documentType: "SALE",
          documentId: sale.id,
          documentNumber: sale.number,
          createdAt: now,
        });
      }
    }
    db.update(schema.sales)
      .set({ status: "ANNULEE", cancelledAt: now, updatedAt: now, notes: reason?.trim() ? `${sale.notes ? sale.notes + "\n" : ""}Annulation : ${reason.trim()}` : sale.notes })
      .where(eq(schema.sales.id, id))
      .run();
  });
}

export function deleteDraftSale(id: number): void {
  const db = getDb();
  const sale = db.select({ status: schema.sales.status }).from(schema.sales).where(eq(schema.sales.id, id)).get();
  if (!sale) throw new BusinessError("Vente introuvable.");
  if (sale.status !== "BROUILLON") throw new BusinessError("Seul un brouillon peut être supprimé.");
  db.delete(schema.sales).where(eq(schema.sales.id, id)).run();
}

/* Customers */
export function listCustomers(q?: string) {
  const db = getDb();
  const rows = q?.trim()
    ? db.select().from(schema.customers).where(sql`lower(${schema.customers.name}) LIKE ${`%${q.trim().toLowerCase()}%`} OR coalesce(${schema.customers.phone}, '') LIKE ${`%${q.trim()}%`}`).orderBy(schema.customers.name).limit(20).all()
    : db.select().from(schema.customers).orderBy(schema.customers.name).limit(200).all();
  return rows;
}

export function createCustomer(input: { name: string; phone?: string | null; customerType: "PARTICULIER" | "PROFESSIONNEL"; address?: string | null }): number {
  const [row] = getDb()
    .insert(schema.customers)
    .values({ name: input.name.trim(), phone: input.phone?.trim() || null, customerType: input.customerType, address: input.address?.trim() || null })
    .returning({ id: schema.customers.id })
    .all();
  return row!.id;
}
