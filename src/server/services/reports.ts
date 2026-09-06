import "server-only";
import { getSqlite } from "@/server/db/client";
import { getStockStatus } from "@/lib/stock";

export type DateRange = { from: string; to: string };

/* ----------------------------- Stock reports ------------------------------ */

export type StockReportRow = {
  id: number;
  reference: string;
  designation: string;
  brand: string | null;
  category: string | null;
  location: string | null;
  supplier: string | null;
  unit: string;
  quantity: number;
  minStock: number;
  purchasePrice: number;
  wholesalePrice: number;
  retailPrice: number;
  stockValue: number;
  retailValue: number;
  status: "RUPTURE" | "FAIBLE" | "DISPONIBLE";
};

export function stockReport(opts: { status?: "ALL" | "FAIBLE" | "RUPTURE" | "ALERTE"; categoryId?: number; includeInactive?: boolean } = {}): StockReportRow[] {
  const sqlite = getSqlite();
  const rows = sqlite
    .prepare(
      `SELECT p.id, p.reference, p.designation, b.name AS brand, c.name AS category, l.code AS location, s.name AS supplier, p.unit,
              p.quantity, p.min_stock AS minStock, p.purchase_price AS purchasePrice, p.wholesale_price AS wholesalePrice, p.retail_price AS retailPrice
       FROM parts p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN locations l ON l.id = p.location_id
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       WHERE (? = 1 OR p.is_active = 1) AND (? = 0 OR p.category_id = ?)
       ORDER BY c.name, p.reference`,
    )
    .all(opts.includeInactive ? 1 : 0, opts.categoryId ?? 0, opts.categoryId ?? 0) as Omit<StockReportRow, "stockValue" | "retailValue" | "status">[];
  const mapped = rows.map((r) => ({
    ...r,
    stockValue: r.quantity * r.purchasePrice,
    retailValue: r.quantity * r.retailPrice,
    status: getStockStatus(r.quantity, r.minStock),
  }));
  switch (opts.status) {
    case "FAIBLE":
      return mapped.filter((r) => r.status === "FAIBLE");
    case "RUPTURE":
      return mapped.filter((r) => r.status === "RUPTURE");
    case "ALERTE":
      return mapped.filter((r) => r.status !== "DISPONIBLE");
    default:
      return mapped;
  }
}

export function stockValuation() {
  const sqlite = getSqlite();
  const row = sqlite
    .prepare(
      `SELECT COALESCE(SUM(quantity),0) AS totalQuantity,
              COALESCE(SUM(quantity * purchase_price),0) AS purchaseValue,
              COALESCE(SUM(quantity * wholesale_price),0) AS wholesaleValue,
              COALESCE(SUM(quantity * retail_price),0) AS retailValue,
              COUNT(*) AS references
       FROM parts WHERE is_active = 1`,
    )
    .get() as { totalQuantity: number; purchaseValue: number; wholesaleValue: number; retailValue: number; references: number };
  return row;
}

export function stockValueByCategory() {
  const sqlite = getSqlite();
  return sqlite
    .prepare(
      `SELECT COALESCE(c.name, 'Sans catégorie') AS category, COUNT(*) AS refs, COALESCE(SUM(p.quantity),0) AS quantity,
              COALESCE(SUM(p.quantity * p.purchase_price),0) AS purchaseValue,
              COALESCE(SUM(p.quantity * p.wholesale_price),0) AS wholesaleValue,
              COALESCE(SUM(p.quantity * p.retail_price),0) AS retailValue
       FROM parts p LEFT JOIN categories c ON c.id = p.category_id WHERE p.is_active = 1
       GROUP BY c.id ORDER BY purchaseValue DESC`,
    )
    .all() as { category: string; refs: number; quantity: number; purchaseValue: number; wholesaleValue: number; retailValue: number }[];
}

/* ------------------------------ Sales reports ----------------------------- */

export function salesReport(range: DateRange) {
  const sqlite = getSqlite();
  const rows = sqlite
    .prepare(
      `SELECT s.id, s.number, s.sale_date AS saleDate, s.status, s.customer_name AS customerName, s.price_tier AS priceTier,
              s.payment_method AS paymentMethod, s.subtotal, s.discount_amount AS discountAmount, s.total, u.full_name AS userName,
              (SELECT COALESCE(SUM(quantity),0) FROM sale_items WHERE sale_id = s.id) AS itemCount,
              (SELECT COALESCE(SUM((unit_price - unit_cost) * quantity),0) FROM sale_items WHERE sale_id = s.id) AS margin
       FROM sales s LEFT JOIN users u ON u.id = s.user_id
       WHERE s.status = 'CONFIRMEE' AND s.sale_date >= ? AND s.sale_date <= ?
       ORDER BY s.sale_date DESC`,
    )
    .all(range.from, range.to) as {
    id: number;
    number: string;
    saleDate: string;
    status: string;
    customerName: string | null;
    priceTier: string;
    paymentMethod: string;
    subtotal: number;
    discountAmount: number;
    total: number;
    userName: string | null;
    itemCount: number;
    margin: number;
  }[];
  const summary = rows.reduce(
    (acc, r) => ({ count: acc.count + 1, total: acc.total + r.total, margin: acc.margin + r.margin, items: acc.items + r.itemCount, discount: acc.discount + r.discountAmount }),
    { count: 0, total: 0, margin: 0, items: 0, discount: 0 },
  );
  const byPayment = sqlite
    .prepare(
      `SELECT payment_method AS method, COUNT(*) AS count, COALESCE(SUM(total),0) AS total FROM sales
       WHERE status = 'CONFIRMEE' AND sale_date >= ? AND sale_date <= ? GROUP BY payment_method ORDER BY total DESC`,
    )
    .all(range.from, range.to) as { method: string; count: number; total: number }[];
  return { rows, summary, byPayment };
}

export function topSellingParts(range: DateRange, limit = 20) {
  const sqlite = getSqlite();
  return sqlite
    .prepare(
      `SELECT si.part_id AS partId, p.reference, p.designation, b.name AS brand, c.name AS category,
              SUM(si.quantity) AS quantity, SUM(si.line_total) AS total, SUM((si.unit_price - si.unit_cost) * si.quantity) AS margin,
              p.quantity AS stock, p.min_stock AS minStock
       FROM sale_items si JOIN sales s ON s.id = si.sale_id JOIN parts p ON p.id = si.part_id
       LEFT JOIN brands b ON b.id = p.brand_id LEFT JOIN categories c ON c.id = p.category_id
       WHERE s.status = 'CONFIRMEE' AND s.sale_date >= ? AND s.sale_date <= ?
       GROUP BY si.part_id ORDER BY quantity DESC, total DESC LIMIT ?`,
    )
    .all(range.from, range.to, limit) as {
    partId: number;
    reference: string;
    designation: string;
    brand: string | null;
    category: string | null;
    quantity: number;
    total: number;
    margin: number;
    stock: number;
    minStock: number;
  }[];
}

/* ----------------------------- Purchase reports --------------------------- */

export function purchasesReport(range: DateRange) {
  const sqlite = getSqlite();
  const rows = sqlite
    .prepare(
      `SELECT p.id, p.number, p.purchase_date AS purchaseDate, p.received_at AS receivedAt, p.status, s.name AS supplierName,
              p.supplier_invoice_number AS invoice, p.total, u.full_name AS userName,
              (SELECT COALESCE(SUM(quantity),0) FROM purchase_items WHERE purchase_id = p.id) AS itemCount
       FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id LEFT JOIN users u ON u.id = p.user_id
       WHERE p.status <> 'ANNULEE' AND p.purchase_date >= ? AND p.purchase_date <= ?
       ORDER BY p.purchase_date DESC`,
    )
    .all(range.from, range.to) as {
    id: number;
    number: string;
    purchaseDate: string;
    receivedAt: string | null;
    status: string;
    supplierName: string | null;
    invoice: string | null;
    total: number;
    userName: string | null;
    itemCount: number;
  }[];
  const summary = rows.reduce(
    (acc, r) => ({
      count: acc.count + 1,
      total: acc.total + r.total,
      received: acc.received + (r.status === "RECUE" ? r.total : 0),
      pending: acc.pending + (r.status === "COMMANDEE" ? r.total : 0),
      items: acc.items + r.itemCount,
    }),
    { count: 0, total: 0, received: 0, pending: 0, items: 0 },
  );
  const bySupplier = sqlite
    .prepare(
      `SELECT COALESCE(s.name, '—') AS supplier, COUNT(*) AS count, COALESCE(SUM(p.total),0) AS total
       FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id
       WHERE p.status <> 'ANNULEE' AND p.purchase_date >= ? AND p.purchase_date <= ? GROUP BY p.supplier_id ORDER BY total DESC`,
    )
    .all(range.from, range.to) as { supplier: string; count: number; total: number }[];
  return { rows, summary, bySupplier };
}

/* ----------------------------- Movement reports --------------------------- */

export function movementsSummary(range: DateRange) {
  const sqlite = getSqlite();
  const byType = sqlite
    .prepare(
      `SELECT type, COUNT(*) AS count, COALESCE(SUM(quantity),0) AS quantity, COALESCE(SUM(ABS(quantity) * COALESCE(unit_cost,0)),0) AS value
       FROM stock_movements WHERE created_at >= ? AND created_at <= ? GROUP BY type ORDER BY count DESC`,
    )
    .all(range.from, range.to) as { type: string; count: number; quantity: number; value: number }[];
  const totals = byType.reduce(
    (acc, r) => ({
      inQty: acc.inQty + (r.quantity > 0 ? r.quantity : 0),
      outQty: acc.outQty + (r.quantity < 0 ? -r.quantity : 0),
      count: acc.count + r.count,
    }),
    { inQty: 0, outQty: 0, count: 0 },
  );
  return { byType, totals };
}

/* ------------------------------ Stock rotation ---------------------------- */

export function stockRotation(range: DateRange) {
  const sqlite = getSqlite();
  const rows = sqlite
    .prepare(
      `SELECT p.id, p.reference, p.designation, b.name AS brand, c.name AS category, p.quantity AS stock, p.min_stock AS minStock,
              p.purchase_price AS purchasePrice,
              COALESCE((SELECT SUM(si.quantity) FROM sale_items si JOIN sales s ON s.id = si.sale_id
                        WHERE si.part_id = p.id AND s.status='CONFIRMEE' AND s.sale_date >= ? AND s.sale_date <= ?), 0) AS sold,
              (SELECT MAX(s.sale_date) FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE si.part_id = p.id AND s.status='CONFIRMEE') AS lastSaleAt
       FROM parts p LEFT JOIN brands b ON b.id = p.brand_id LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.is_active = 1
       ORDER BY sold DESC, p.reference`,
    )
    .all(range.from, range.to) as {
    id: number;
    reference: string;
    designation: string;
    brand: string | null;
    category: string | null;
    stock: number;
    minStock: number;
    purchasePrice: number;
    sold: number;
    lastSaleAt: string | null;
  }[];
  const days = Math.max(1, Math.round((new Date(range.to).getTime() - new Date(range.from).getTime()) / 86_400_000));
  return rows.map((r) => {
    const dailyRate = r.sold / days;
    const coverDays = dailyRate > 0 ? Math.round(r.stock / dailyRate) : null;
    return {
      ...r,
      dailyRate,
      coverDays,
      rotation: r.stock > 0 ? r.sold / r.stock : r.sold > 0 ? Infinity : 0,
      classification: r.sold === 0 ? ("DORMANT" as const) : coverDays !== null && coverDays < 15 ? ("RAPIDE" as const) : ("NORMAL" as const),
    };
  });
}
