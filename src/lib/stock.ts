export type StockStatus = "RUPTURE" | "FAIBLE" | "DISPONIBLE";

/**
 * Business rule (single source of truth):
 *  - quantity <= 0            → Rupture
 *  - quantity <= minimum      → Stock faible
 *  - otherwise                → Disponible
 */
export function getStockStatus(quantity: number, minStock: number): StockStatus {
  if (quantity <= 0) return "RUPTURE";
  if (minStock > 0 && quantity <= minStock) return "FAIBLE";
  return "DISPONIBLE";
}

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  RUPTURE: "Rupture",
  FAIBLE: "Stock faible",
  DISPONIBLE: "Disponible",
};

export const MOVEMENT_TYPE_LABELS = {
  ENTREE_ACHAT: "Entrée achat",
  SORTIE_VENTE: "Sortie vente",
  AJUSTEMENT_POSITIF: "Ajustement +",
  AJUSTEMENT_NEGATIF: "Ajustement −",
  RETOUR_CLIENT: "Retour client",
  RETOUR_FOURNISSEUR: "Retour fournisseur",
  TRANSFERT: "Transfert",
  INVENTAIRE: "Inventaire",
  IMPORT: "Import Excel",
} as const;

export type MovementTypeKey = keyof typeof MOVEMENT_TYPE_LABELS;

export const MOVEMENT_DIRECTION: Record<MovementTypeKey, "IN" | "OUT" | "NEUTRAL"> = {
  ENTREE_ACHAT: "IN",
  SORTIE_VENTE: "OUT",
  AJUSTEMENT_POSITIF: "IN",
  AJUSTEMENT_NEGATIF: "OUT",
  RETOUR_CLIENT: "IN",
  RETOUR_FOURNISSEUR: "OUT",
  TRANSFERT: "NEUTRAL",
  INVENTAIRE: "NEUTRAL",
  IMPORT: "IN",
};

export const SALE_STATUS_LABELS = {
  BROUILLON: "Brouillon",
  CONFIRMEE: "Confirmée",
  ANNULEE: "Annulée",
} as const;

export const PURCHASE_STATUS_LABELS = {
  BROUILLON: "Brouillon",
  COMMANDEE: "Commandée",
  RECUE: "Reçue",
  ANNULEE: "Annulée",
} as const;

export const PAYMENT_METHOD_LABELS = {
  ESPECES: "Espèces",
  CARTE: "Carte",
  VIREMENT: "Virement",
  CHEQUE: "Chèque",
  CREDIT: "Crédit",
} as const;

export const PRICE_TIER_LABELS = {
  DETAIL: "Prix détail",
  GROS: "Prix gros",
} as const;

export const REFERENCE_TYPE_LABELS = {
  OEM: "Référence OEM",
  ALTERNATIVE: "Référence alternative",
  SUPPLIER: "Référence fournisseur",
  BARCODE: "Code-barres",
} as const;

export const ROLE_LABELS = {
  ADMIN: "Administrateur",
  MANAGER: "Gérant",
  EMPLOYEE: "Employé",
} as const;

export const UNITS = ["Pièce", "Jeu", "Kit", "Litre", "Mètre", "Paire", "Boîte", "Carton"] as const;

/** Round to 2 decimals without floating drift. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeDiscount(
  subtotal: number,
  type: "NONE" | "PERCENT" | "AMOUNT",
  value: number,
): { discountAmount: number; total: number } {
  let discountAmount = 0;
  if (type === "PERCENT") discountAmount = round2((subtotal * Math.min(Math.max(value, 0), 100)) / 100);
  if (type === "AMOUNT") discountAmount = round2(Math.min(Math.max(value, 0), subtotal));
  return { discountAmount, total: round2(subtotal - discountAmount) };
}
