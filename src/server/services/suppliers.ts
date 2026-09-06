import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { getDb, getSqlite, schema } from "@/server/db/client";
import { BusinessError } from "@/lib/result";
import { getStockStatus } from "@/lib/stock";

export type SupplierListItem = {
  id: number;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  isActive: boolean;
  partCount: number;
  purchaseCount: number;
  purchaseTotal: number;
  lastPurchaseAt: string | null;
};

export function listSuppliers(opts: { q?: string; includeInactive?: boolean } = {}): SupplierListItem[] {
  const sqlite = getSqlite();
  const q = opts.q?.trim().toLowerCase();
  const rows = sqlite
    .prepare(
      `SELECT s.id, s.name, s.contact_name AS contactName, s.phone, s.email, s.city, s.is_active AS isActive,
              (SELECT COUNT(*) FROM parts p WHERE p.supplier_id = s.id AND p.is_active = 1) AS partCount,
              (SELECT COUNT(*) FROM purchases pu WHERE pu.supplier_id = s.id AND pu.status <> 'ANNULEE') AS purchaseCount,
              (SELECT COALESCE(SUM(total),0) FROM purchases pu WHERE pu.supplier_id = s.id AND pu.status = 'RECUE') AS purchaseTotal,
              (SELECT MAX(purchase_date) FROM purchases pu WHERE pu.supplier_id = s.id AND pu.status <> 'ANNULEE') AS lastPurchaseAt
       FROM suppliers s
       WHERE (? = 1 OR s.is_active = 1)
         AND (? = '' OR lower(s.name) LIKE ? OR lower(coalesce(s.contact_name,'')) LIKE ? OR lower(coalesce(s.city,'')) LIKE ? OR coalesce(s.phone,'') LIKE ?)
       ORDER BY s.is_active DESC, s.name`,
    )
    .all(opts.includeInactive ? 1 : 0, q ?? "", `%${q ?? ""}%`, `%${q ?? ""}%`, `%${q ?? ""}%`, `%${q ?? ""}%`) as (Omit<SupplierListItem, "isActive"> & { isActive: number })[];
  return rows.map((r) => ({ ...r, isActive: r.isActive === 1 }));
}

export function getSupplier(id: number) {
  const db = getDb();
  const supplier = db.select().from(schema.suppliers).where(eq(schema.suppliers.id, id)).get();
  if (!supplier) return null;

  const parts = db
    .select({
      id: schema.parts.id,
      reference: schema.parts.reference,
      designation: schema.parts.designation,
      brand: schema.brands.name,
      quantity: schema.parts.quantity,
      minStock: schema.parts.minStock,
      purchasePrice: schema.parts.purchasePrice,
      location: schema.locations.code,
      isActive: schema.parts.isActive,
    })
    .from(schema.parts)
    .leftJoin(schema.brands, eq(schema.brands.id, schema.parts.brandId))
    .leftJoin(schema.locations, eq(schema.locations.id, schema.parts.locationId))
    .where(eq(schema.parts.supplierId, id))
    .orderBy(asc(schema.parts.reference))
    .all()
    .map((p) => ({ ...p, status: getStockStatus(p.quantity, p.minStock) }));

  const purchases = db
    .select({
      id: schema.purchases.id,
      number: schema.purchases.number,
      status: schema.purchases.status,
      total: schema.purchases.total,
      purchaseDate: schema.purchases.purchaseDate,
      receivedAt: schema.purchases.receivedAt,
      itemCount: sql<number>`(SELECT COALESCE(SUM(quantity),0) FROM purchase_items WHERE purchase_id = ${schema.purchases.id})`,
    })
    .from(schema.purchases)
    .where(eq(schema.purchases.supplierId, id))
    .orderBy(desc(schema.purchases.purchaseDate))
    .limit(50)
    .all();

  const stats = getSqlite()
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN status='RECUE' THEN total ELSE 0 END),0) AS receivedTotal,
              COALESCE(SUM(CASE WHEN status='COMMANDEE' THEN total ELSE 0 END),0) AS pendingTotal,
              COUNT(CASE WHEN status <> 'ANNULEE' THEN 1 END) AS purchaseCount,
              COALESCE(SUM(CASE WHEN status='RECUE' AND purchase_date >= datetime('now','-365 days') THEN total ELSE 0 END),0) AS received12m
       FROM purchases WHERE supplier_id = ?`,
    )
    .get(id) as { receivedTotal: number; pendingTotal: number; purchaseCount: number; received12m: number };

  return { ...supplier, parts, purchases, stats };
}

export type SupplierInput = {
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  notes?: string | null;
  isActive?: boolean;
};

export function createSupplier(input: SupplierInput): number {
  const [row] = getDb()
    .insert(schema.suppliers)
    .values({
      name: input.name.trim(),
      contactName: input.contactName?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      notes: input.notes?.trim() || null,
      isActive: input.isActive ?? true,
    })
    .returning({ id: schema.suppliers.id })
    .all();
  return row!.id;
}

export function updateSupplier(id: number, input: SupplierInput): void {
  const res = getDb()
    .update(schema.suppliers)
    .set({
      name: input.name.trim(),
      contactName: input.contactName?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      notes: input.notes?.trim() || null,
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.suppliers.id, id))
    .run();
  if (res.changes === 0) throw new BusinessError("Fournisseur introuvable.");
}

export function setSupplierActive(id: number, isActive: boolean): void {
  getDb().update(schema.suppliers).set({ isActive, updatedAt: new Date().toISOString() }).where(eq(schema.suppliers.id, id)).run();
}
