import "server-only";
import { eq } from "drizzle-orm";
import { getDb, getSqlite, schema, type DB } from "@/server/db/client";
import type { MovementType } from "@/server/db/schema";
import { BusinessError } from "@/lib/result";
import { getSetting } from "./settings";

export type MovementInput = {
  partId: number;
  type: MovementType;
  /** Signed quantity: > 0 stock in, < 0 stock out. */
  quantity: number;
  userId: number | null;
  reason?: string | null;
  unitCost?: number | null;
  documentType?: "SALE" | "PURCHASE" | "ADJUSTMENT" | "IMPORT" | "TRANSFER" | "RETURN" | null;
  documentId?: number | null;
  documentNumber?: string | null;
  fromLocationId?: number | null;
  toLocationId?: number | null;
  createdAt?: string;
};

export type MovementResult = {
  movementId: number;
  previousQuantity: number;
  newQuantity: number;
};

/**
 * The ONLY function allowed to change `parts.quantity`.
 *
 * - Reads the current quantity inside the caller's transaction (SQLite write
 *   transactions are serialised, so this is race-safe).
 * - Refuses negative stock unless the business setting allows it.
 * - Writes an immutable movement row with previous/new quantities.
 */
export function applyStockMovement(db: DB, input: MovementInput): MovementResult {
  if (!Number.isInteger(input.quantity)) throw new BusinessError("La quantité doit être un nombre entier.");
  if (input.quantity === 0 && input.type !== "TRANSFERT") {
    throw new BusinessError("La quantité du mouvement ne peut pas être nulle.");
  }

  const part = db
    .select({ id: schema.parts.id, quantity: schema.parts.quantity, reference: schema.parts.reference, isActive: schema.parts.isActive })
    .from(schema.parts)
    .where(eq(schema.parts.id, input.partId))
    .get();
  if (!part) throw new BusinessError("Pièce introuvable.");

  const previousQuantity = part.quantity;
  const newQuantity = previousQuantity + input.quantity;

  if (newQuantity < 0) {
    const allowNegative = getSetting("stock.allowNegative") === "true";
    if (!allowNegative) {
      throw new BusinessError(
        `Stock insuffisant pour ${part.reference} : disponible ${previousQuantity}, demandé ${Math.abs(input.quantity)}.`,
      );
    }
  }

  const now = input.createdAt ?? new Date().toISOString();
  db.update(schema.parts)
    .set({ quantity: newQuantity, updatedAt: now, ...(input.toLocationId ? { locationId: input.toLocationId } : {}) })
    .where(eq(schema.parts.id, input.partId))
    .run();

  const [movement] = db
    .insert(schema.stockMovements)
    .values({
      partId: input.partId,
      type: input.type,
      quantity: input.quantity,
      previousQuantity,
      newQuantity,
      unitCost: input.unitCost ?? null,
      reason: input.reason ?? null,
      documentType: input.documentType ?? null,
      documentId: input.documentId ?? null,
      documentNumber: input.documentNumber ?? null,
      fromLocationId: input.fromLocationId ?? null,
      toLocationId: input.toLocationId ?? null,
      userId: input.userId,
      createdAt: now,
    })
    .returning({ id: schema.stockMovements.id })
    .all();

  return { movementId: movement!.id, previousQuantity, newQuantity };
}

/** Run `fn` inside a SQLite transaction (synchronous, serialised). */
export function withTransaction<T>(fn: (db: DB) => T): T {
  const db = getDb();
  const sqlite = getSqlite();
  const tx = sqlite.transaction(() => fn(db));
  return tx();
}
