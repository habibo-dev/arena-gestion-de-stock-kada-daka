import "server-only";
import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/server/db/client";
import type { MovementType } from "@/server/db/schema";
import { applyStockMovement, withTransaction } from "./inventory";
import type { Paginated } from "./parts";
import { BusinessError } from "@/lib/result";

export type MovementListItem = {
  id: number;
  partId: number;
  reference: string;
  designation: string;
  type: MovementType;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  unitCost: number | null;
  reason: string | null;
  documentType: string | null;
  documentId: number | null;
  documentNumber: string | null;
  userName: string | null;
  fromLocation: string | null;
  toLocation: string | null;
  createdAt: string;
};

export type MovementFilters = {
  partId?: number;
  type?: MovementType | "ALL" | "IN" | "OUT";
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

export function listMovements(filters: MovementFilters = {}): Paginated<MovementListItem> {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(5, filters.pageSize ?? 30));

  const conds: SQL[] = [];
  if (filters.partId) conds.push(eq(schema.stockMovements.partId, filters.partId));
  if (filters.type && filters.type !== "ALL") {
    if (filters.type === "IN") conds.push(sql`${schema.stockMovements.quantity} > 0`);
    else if (filters.type === "OUT") conds.push(sql`${schema.stockMovements.quantity} < 0`);
    else conds.push(eq(schema.stockMovements.type, filters.type));
  }
  if (filters.from) conds.push(gte(schema.stockMovements.createdAt, filters.from));
  if (filters.to) conds.push(lte(schema.stockMovements.createdAt, filters.to));
  if (filters.q?.trim()) {
    const t = `%${filters.q.trim().toLowerCase()}%`;
    conds.push(
      sql`(lower(${schema.parts.reference}) LIKE ${t} OR lower(${schema.parts.designation}) LIKE ${t} OR lower(coalesce(${schema.stockMovements.documentNumber}, '')) LIKE ${t} OR lower(coalesce(${schema.stockMovements.reason}, '')) LIKE ${t})`,
    );
  }
  const where = conds.length ? and(...conds) : undefined;

  const fromLoc = schema.locations;
  const rows = db
    .select({
      id: schema.stockMovements.id,
      partId: schema.stockMovements.partId,
      reference: schema.parts.reference,
      designation: schema.parts.designation,
      type: schema.stockMovements.type,
      quantity: schema.stockMovements.quantity,
      previousQuantity: schema.stockMovements.previousQuantity,
      newQuantity: schema.stockMovements.newQuantity,
      unitCost: schema.stockMovements.unitCost,
      reason: schema.stockMovements.reason,
      documentType: schema.stockMovements.documentType,
      documentId: schema.stockMovements.documentId,
      documentNumber: schema.stockMovements.documentNumber,
      userName: schema.users.fullName,
      fromLocation: sql<string | null>`(SELECT code FROM locations WHERE id = ${schema.stockMovements.fromLocationId})`,
      toLocation: sql<string | null>`(SELECT code FROM locations WHERE id = ${schema.stockMovements.toLocationId})`,
      createdAt: schema.stockMovements.createdAt,
    })
    .from(schema.stockMovements)
    .innerJoin(schema.parts, eq(schema.parts.id, schema.stockMovements.partId))
    .leftJoin(schema.users, eq(schema.users.id, schema.stockMovements.userId))
    .where(where)
    .orderBy(desc(schema.stockMovements.createdAt), desc(schema.stockMovements.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();
  void fromLoc;

  const countRow = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.stockMovements)
    .innerJoin(schema.parts, eq(schema.parts.id, schema.stockMovements.partId))
    .where(where)
    .get();
  const count = countRow?.count ?? 0;

  return { items: rows, total: count, page, pageSize, pageCount: Math.max(1, Math.ceil(count / pageSize)) };
}

export type AdjustmentInput = {
  partId: number;
  mode: "ADD" | "REMOVE" | "SET";
  quantity: number;
  reason: string;
  type?: "AJUSTEMENT" | "RETOUR_CLIENT" | "RETOUR_FOURNISSEUR" | "INVENTAIRE";
  userId: number;
};

/** Manual stock adjustment (entrée / sortie / inventaire) — always through a movement. */
export function adjustStock(input: AdjustmentInput) {
  return withTransaction((db) => {
    const part = db.select({ quantity: schema.parts.quantity }).from(schema.parts).where(eq(schema.parts.id, input.partId)).get();
    if (!part) throw new BusinessError("Pièce introuvable.");

    let delta: number;
    if (input.mode === "SET") delta = input.quantity - part.quantity;
    else if (input.mode === "ADD") delta = Math.abs(input.quantity);
    else delta = -Math.abs(input.quantity);
    if (delta === 0) throw new BusinessError("Aucun changement : la quantité saisie est identique au stock actuel.");

    let type: MovementType;
    if (input.type === "RETOUR_CLIENT") type = "RETOUR_CLIENT";
    else if (input.type === "RETOUR_FOURNISSEUR") type = "RETOUR_FOURNISSEUR";
    else if (input.type === "INVENTAIRE" || input.mode === "SET") type = "INVENTAIRE";
    else type = delta > 0 ? "AJUSTEMENT_POSITIF" : "AJUSTEMENT_NEGATIF";

    return applyStockMovement(db, {
      partId: input.partId,
      type,
      quantity: delta,
      userId: input.userId,
      reason: input.reason,
      documentType: type.startsWith("RETOUR") ? "RETURN" : "ADJUSTMENT",
    });
  });
}

export function transferStock(input: { partId: number; toLocationId: number; reason: string; userId: number }) {
  return withTransaction((db) => {
    const part = db
      .select({ quantity: schema.parts.quantity, locationId: schema.parts.locationId })
      .from(schema.parts)
      .where(eq(schema.parts.id, input.partId))
      .get();
    if (!part) throw new BusinessError("Pièce introuvable.");
    if (part.locationId === input.toLocationId) throw new BusinessError("La pièce est déjà à cet emplacement.");
    const now = new Date().toISOString();
    db.update(schema.parts).set({ locationId: input.toLocationId, updatedAt: now }).where(eq(schema.parts.id, input.partId)).run();
    const [row] = db
      .insert(schema.stockMovements)
      .values({
        partId: input.partId,
        type: "TRANSFERT",
        quantity: 0,
        previousQuantity: part.quantity,
        newQuantity: part.quantity,
        reason: input.reason,
        documentType: "TRANSFER",
        fromLocationId: part.locationId,
        toLocationId: input.toLocationId,
        userId: input.userId,
        createdAt: now,
      })
      .returning({ id: schema.stockMovements.id })
      .all();
    return { movementId: row!.id, previousQuantity: part.quantity, newQuantity: part.quantity };
  });
}
