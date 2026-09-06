import "server-only";
import { startOfDay, subDays, format, eachDayOfInterval } from "date-fns";
import { getSqlite } from "@/server/db/client";
import type { MovementListItem } from "./movements";

export type DashboardData = {
  kpis: {
    stockValue: number;
    stockRetailValue: number;
    referenceCount: number;
    totalQuantity: number;
    lowStock: number;
    outOfStock: number;
    salesToday: { count: number; total: number };
    salesYesterday: { count: number; total: number };
    purchasesToday: { count: number; total: number };
    pendingPurchases: { count: number; total: number };
    draftSales: number;
  };
  salesSeries: { date: string; label: string; total: number; count: number; margin: number }[];
  stockSeries: { date: string; label: string; quantity: number }[];
  topParts: { partId: number; reference: string; designation: string; quantity: number; total: number }[];
  categoryBreakdown: { category: string; value: number; quantity: number; count: number }[];
  recentMovements: MovementListItem[];
  alerts: { id: number; reference: string; designation: string; quantity: number; minStock: number; location: string | null; brand: string | null }[];
};

export function getDashboardData(): DashboardData {
  const sqlite = getSqlite();
  const now = new Date();
  const todayStart = startOfDay(now).toISOString();
  const yesterdayStart = startOfDay(subDays(now, 1)).toISOString();

  const stock = sqlite
    .prepare(
      `SELECT COALESCE(SUM(quantity * purchase_price),0) AS stockValue,
              COALESCE(SUM(quantity * retail_price),0) AS stockRetailValue,
              COUNT(*) AS referenceCount,
              COALESCE(SUM(quantity),0) AS totalQuantity,
              SUM(CASE WHEN quantity > 0 AND min_stock > 0 AND quantity <= min_stock THEN 1 ELSE 0 END) AS lowStock,
              SUM(CASE WHEN quantity <= 0 THEN 1 ELSE 0 END) AS outOfStock
       FROM parts WHERE is_active = 1`,
    )
    .get() as { stockValue: number; stockRetailValue: number; referenceCount: number; totalQuantity: number; lowStock: number; outOfStock: number };

  const salesToday = sqlite
    .prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(total),0) AS total FROM sales WHERE status='CONFIRMEE' AND sale_date >= ?`)
    .get(todayStart) as { count: number; total: number };
  const salesYesterday = sqlite
    .prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(total),0) AS total FROM sales WHERE status='CONFIRMEE' AND sale_date >= ? AND sale_date < ?`)
    .get(yesterdayStart, todayStart) as { count: number; total: number };
  const purchasesToday = sqlite
    .prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(total),0) AS total FROM purchases WHERE status='RECUE' AND received_at >= ?`)
    .get(todayStart) as { count: number; total: number };
  const pendingPurchases = sqlite
    .prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(total),0) AS total FROM purchases WHERE status='COMMANDEE'`)
    .get() as { count: number; total: number };
  const draftSales = (sqlite.prepare(`SELECT COUNT(*) AS c FROM sales WHERE status='BROUILLON'`).get() as { c: number }).c;

  /* Sales series – last 30 days, grouped by local day */
  const days = eachDayOfInterval({ start: subDays(startOfDay(now), 29), end: startOfDay(now) });
  const salesRows = sqlite
    .prepare(
      `SELECT s.id, s.sale_date AS saleDate, s.total,
              (SELECT COALESCE(SUM((si.unit_price - si.unit_cost) * si.quantity),0) FROM sale_items si WHERE si.sale_id = s.id) AS margin
       FROM sales s WHERE s.status='CONFIRMEE' AND s.sale_date >= ?`,
    )
    .all(subDays(startOfDay(now), 29).toISOString()) as { id: number; saleDate: string; total: number; margin: number }[];
  const salesByDay = new Map<string, { total: number; count: number; margin: number }>();
  for (const r of salesRows) {
    const key = format(new Date(r.saleDate), "yyyy-MM-dd");
    const cur = salesByDay.get(key) ?? { total: 0, count: 0, margin: 0 };
    cur.total += r.total;
    cur.count += 1;
    cur.margin += r.margin;
    salesByDay.set(key, cur);
  }
  const salesSeries = days.map((d) => {
    const key = format(d, "yyyy-MM-dd");
    const v = salesByDay.get(key) ?? { total: 0, count: 0, margin: 0 };
    return { date: key, label: format(d, "dd/MM"), total: Math.round(v.total), count: v.count, margin: Math.round(v.margin) };
  });

  /* Stock quantity series – reconstructed backwards from movements */
  const movementsByDay = sqlite
    .prepare(`SELECT created_at AS createdAt, quantity FROM stock_movements WHERE created_at >= ? ORDER BY created_at`)
    .all(subDays(startOfDay(now), 29).toISOString()) as { createdAt: string; quantity: number }[];
  const deltaByDay = new Map<string, number>();
  for (const m of movementsByDay) {
    const key = format(new Date(m.createdAt), "yyyy-MM-dd");
    deltaByDay.set(key, (deltaByDay.get(key) ?? 0) + m.quantity);
  }
  let running = stock.totalQuantity;
  const stockSeriesReversed: { date: string; label: string; quantity: number }[] = [];
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i]!;
    const key = format(d, "yyyy-MM-dd");
    stockSeriesReversed.push({ date: key, label: format(d, "dd/MM"), quantity: running });
    running -= deltaByDay.get(key) ?? 0;
  }
  const stockSeries = stockSeriesReversed.reverse();

  /* Top parts (30 days) */
  const topParts = sqlite
    .prepare(
      `SELECT si.part_id AS partId, p.reference, p.designation, SUM(si.quantity) AS quantity, SUM(si.line_total) AS total
       FROM sale_items si JOIN sales s ON s.id = si.sale_id JOIN parts p ON p.id = si.part_id
       WHERE s.status='CONFIRMEE' AND s.sale_date >= ?
       GROUP BY si.part_id ORDER BY quantity DESC, total DESC LIMIT 8`,
    )
    .all(subDays(startOfDay(now), 29).toISOString()) as DashboardData["topParts"];

  /* Category breakdown by stock value */
  const categoryBreakdown = sqlite
    .prepare(
      `SELECT COALESCE(c.name, 'Sans catégorie') AS category, COALESCE(SUM(p.quantity * p.purchase_price),0) AS value,
              COALESCE(SUM(p.quantity),0) AS quantity, COUNT(*) AS count
       FROM parts p LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.is_active = 1 GROUP BY c.id ORDER BY value DESC`,
    )
    .all() as DashboardData["categoryBreakdown"];

  /* Recent movements */
  const recentMovements = sqlite
    .prepare(
      `SELECT m.id, m.part_id AS partId, p.reference, p.designation, m.type, m.quantity, m.previous_quantity AS previousQuantity,
              m.new_quantity AS newQuantity, m.unit_cost AS unitCost, m.reason, m.document_type AS documentType, m.document_id AS documentId,
              m.document_number AS documentNumber, u.full_name AS userName,
              (SELECT code FROM locations WHERE id = m.from_location_id) AS fromLocation,
              (SELECT code FROM locations WHERE id = m.to_location_id) AS toLocation,
              m.created_at AS createdAt
       FROM stock_movements m JOIN parts p ON p.id = m.part_id LEFT JOIN users u ON u.id = m.user_id
       ORDER BY m.created_at DESC, m.id DESC LIMIT 10`,
    )
    .all() as MovementListItem[];

  /* Alerts */
  const alerts = sqlite
    .prepare(
      `SELECT p.id, p.reference, p.designation, p.quantity, p.min_stock AS minStock, l.code AS location, b.name AS brand
       FROM parts p LEFT JOIN locations l ON l.id = p.location_id LEFT JOIN brands b ON b.id = p.brand_id
       WHERE p.is_active = 1 AND (p.quantity <= 0 OR (p.min_stock > 0 AND p.quantity <= p.min_stock))
       ORDER BY (p.quantity <= 0) DESC, (CAST(p.quantity AS REAL) / NULLIF(p.min_stock, 0)) ASC, p.reference LIMIT 8`,
    )
    .all() as DashboardData["alerts"];

  return {
    kpis: {
      stockValue: stock.stockValue,
      stockRetailValue: stock.stockRetailValue,
      referenceCount: stock.referenceCount,
      totalQuantity: stock.totalQuantity,
      lowStock: stock.lowStock ?? 0,
      outOfStock: stock.outOfStock ?? 0,
      salesToday,
      salesYesterday,
      purchasesToday,
      pendingPurchases,
      draftSales,
    },
    salesSeries,
    stockSeries,
    topParts,
    categoryBreakdown,
    recentMovements,
    alerts,
  };
}

export function getNotifications() {
  const sqlite = getSqlite();
  const alerts = sqlite
    .prepare(
      `SELECT p.id, p.reference, p.designation, p.quantity, p.min_stock AS minStock
       FROM parts p WHERE p.is_active = 1 AND (p.quantity <= 0 OR (p.min_stock > 0 AND p.quantity <= p.min_stock))
       ORDER BY (p.quantity <= 0) DESC, p.updated_at DESC LIMIT 6`,
    )
    .all() as { id: number; reference: string; designation: string; quantity: number; minStock: number }[];
  const counts = sqlite
    .prepare(
      `SELECT (SELECT COUNT(*) FROM parts WHERE is_active=1 AND quantity <= 0) AS rupture,
              (SELECT COUNT(*) FROM parts WHERE is_active=1 AND quantity > 0 AND min_stock > 0 AND quantity <= min_stock) AS faible,
              (SELECT COUNT(*) FROM purchases WHERE status='COMMANDEE') AS pendingPurchases,
              (SELECT COUNT(*) FROM sales WHERE status='BROUILLON') AS draftSales`,
    )
    .get() as { rupture: number; faible: number; pendingPurchases: number; draftSales: number };
  const pending = sqlite
    .prepare(`SELECT p.id, p.number, s.name AS supplier, p.expected_at AS expectedAt FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE p.status='COMMANDEE' ORDER BY p.expected_at LIMIT 3`)
    .all() as { id: number; number: string; supplier: string | null; expectedAt: string | null }[];
  return { alerts, counts, pending };
}
