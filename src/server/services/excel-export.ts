import "server-only";
import ExcelJS from "exceljs";
import { format } from "date-fns";
import { getSqlite } from "@/server/db/client";
import { stockReport, salesReport, purchasesReport, topSellingParts, stockRotation, type DateRange } from "./reports";
import { listMovements } from "./movements";
import { listSuppliers } from "./suppliers";
import { MOVEMENT_TYPE_LABELS, PAYMENT_METHOD_LABELS, PRICE_TIER_LABELS, PURCHASE_STATUS_LABELS, STOCK_STATUS_LABELS, type MovementTypeKey } from "@/lib/stock";

export type ExportKind =
  | "stock"
  | "stock-faible"
  | "ruptures"
  | "valeur-stock"
  | "ventes"
  | "achats"
  | "mouvements"
  | "fournisseurs"
  | "top-ventes"
  | "rotation"
  | "modele-import";

type Column = { header: string; key: string; width?: number; numFmt?: string };

const MONEY = '#,##0.00 "DA"';
const INT = "#,##0";

function styleSheet(ws: ExcelJS.Worksheet, columns: Column[], title: string, subtitle?: string) {
  ws.columns = columns.map((c) => ({ key: c.key, width: c.width ?? 18 }));
  // Title rows
  ws.spliceRows(1, 0, [title], [subtitle ?? `Généré le ${format(new Date(), "dd/MM/yyyy à HH:mm")} — AutoStock`], []);
  ws.getCell("A1").font = { bold: true, size: 14, color: { argb: "FF0F172A" } };
  ws.getCell("A2").font = { italic: true, size: 10, color: { argb: "FF64748B" } };
  ws.mergeCells(1, 1, 1, Math.max(columns.length, 1));
  ws.mergeCells(2, 1, 2, Math.max(columns.length, 1));
  // Header row (row 4)
  const headerRow = ws.getRow(4);
  headerRow.values = columns.map((c) => c.header);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.alignment = { vertical: "middle" };
  headerRow.height = 22;
  columns.forEach((_, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FF334155" } } };
  });
  ws.views = [{ state: "frozen", ySplit: 4 }];
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: columns.length } };
  columns.forEach((c, i) => {
    if (c.numFmt) ws.getColumn(i + 1).numFmt = c.numFmt;
  });
}

function addRows(ws: ExcelJS.Worksheet, rows: Record<string, unknown>[], columns: Column[]) {
  for (const r of rows) {
    const row = ws.addRow(columns.map((c) => r[c.key] ?? null));
    row.alignment = { vertical: "middle" };
  }
  // Zebra striping
  ws.eachRow((row, n) => {
    if (n > 4 && n % 2 === 0) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      });
    }
  });
}

function addTotalRow(ws: ExcelJS.Worksheet, label: string, values: Record<number, number>) {
  const row = ws.addRow([]);
  row.getCell(1).value = label;
  row.font = { bold: true };
  for (const [col, v] of Object.entries(values)) row.getCell(Number(col)).value = v;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = { top: { style: "medium", color: { argb: "FF1E293B" } } };
  });
}

export async function buildExport(kind: ExportKind, range?: DateRange): Promise<{ buffer: Buffer; fileName: string }> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AutoStock";
  wb.created = new Date();
  const stamp = format(new Date(), "yyyy-MM-dd_HHmm");
  const rangeLabel = range ? `Période du ${format(new Date(range.from), "dd/MM/yyyy")} au ${format(new Date(range.to), "dd/MM/yyyy")}` : undefined;

  const STOCK_COLUMNS: Column[] = [
    { header: "Référence", key: "reference", width: 20 },
    { header: "Désignation", key: "designation", width: 44 },
    { header: "Marque", key: "brand", width: 16 },
    { header: "Catégorie", key: "category", width: 16 },
    { header: "Quantité", key: "quantity", width: 11, numFmt: INT },
    { header: "Stock min.", key: "minStock", width: 11, numFmt: INT },
    { header: "Prix d'Achat", key: "purchasePrice", width: 15, numFmt: MONEY },
    { header: "Prix Gros", key: "wholesalePrice", width: 15, numFmt: MONEY },
    { header: "Prix Détail", key: "retailPrice", width: 15, numFmt: MONEY },
    { header: "UM", key: "unit", width: 8 },
    { header: "Rayon", key: "location", width: 10 },
    { header: "Fournisseur", key: "supplier", width: 28 },
    { header: "Valeur stock (achat)", key: "stockValue", width: 20, numFmt: MONEY },
    { header: "Statut", key: "status", width: 13 },
  ];

  let fileName = `autostock_${kind}_${stamp}.xlsx`;

  switch (kind) {
    case "stock":
    case "stock-faible":
    case "ruptures": {
      const status = kind === "stock" ? "ALL" : kind === "stock-faible" ? "FAIBLE" : "RUPTURE";
      const rows = stockReport({ status });
      const ws = wb.addWorksheet(kind === "stock" ? "Stock" : kind === "stock-faible" ? "Stock faible" : "Ruptures");
      styleSheet(ws, STOCK_COLUMNS, kind === "stock" ? "État du stock complet" : kind === "stock-faible" ? "Articles en stock faible" : "Articles en rupture de stock", `${rows.length} article(s) — généré le ${format(new Date(), "dd/MM/yyyy à HH:mm")}`);
      addRows(ws, rows.map((r) => ({ ...r, status: STOCK_STATUS_LABELS[r.status] })), STOCK_COLUMNS);
      addTotalRow(ws, "Total", { 5: rows.reduce((a, r) => a + r.quantity, 0), 13: rows.reduce((a, r) => a + r.stockValue, 0) });
      break;
    }
    case "valeur-stock": {
      const sqlite = getSqlite();
      const rows = sqlite
        .prepare(
          `SELECT COALESCE(c.name,'Sans catégorie') AS category, COUNT(*) AS refs, COALESCE(SUM(p.quantity),0) AS quantity,
                  COALESCE(SUM(p.quantity*p.purchase_price),0) AS purchaseValue, COALESCE(SUM(p.quantity*p.wholesale_price),0) AS wholesaleValue,
                  COALESCE(SUM(p.quantity*p.retail_price),0) AS retailValue
           FROM parts p LEFT JOIN categories c ON c.id=p.category_id WHERE p.is_active=1 GROUP BY c.id ORDER BY purchaseValue DESC`,
        )
        .all() as Record<string, unknown>[];
      const cols: Column[] = [
        { header: "Catégorie", key: "category", width: 24 },
        { header: "Références", key: "refs", width: 12, numFmt: INT },
        { header: "Quantité", key: "quantity", width: 12, numFmt: INT },
        { header: "Valeur achat", key: "purchaseValue", width: 18, numFmt: MONEY },
        { header: "Valeur gros", key: "wholesaleValue", width: 18, numFmt: MONEY },
        { header: "Valeur détail", key: "retailValue", width: 18, numFmt: MONEY },
      ];
      const ws = wb.addWorksheet("Valeur du stock");
      styleSheet(ws, cols, "Valeur du stock par catégorie");
      addRows(ws, rows, cols);
      addTotalRow(ws, "Total", {
        2: rows.reduce((a, r) => a + Number(r.refs), 0),
        3: rows.reduce((a, r) => a + Number(r.quantity), 0),
        4: rows.reduce((a, r) => a + Number(r.purchaseValue), 0),
        5: rows.reduce((a, r) => a + Number(r.wholesaleValue), 0),
        6: rows.reduce((a, r) => a + Number(r.retailValue), 0),
      });
      const detail = wb.addWorksheet("Détail articles");
      const detailRows = stockReport({});
      styleSheet(detail, STOCK_COLUMNS, "Détail de la valeur du stock");
      addRows(detail, detailRows.map((r) => ({ ...r, status: STOCK_STATUS_LABELS[r.status] })), STOCK_COLUMNS);
      break;
    }
    case "ventes": {
      const r = range ?? defaultRange();
      const { rows, summary } = salesReport(r);
      const cols: Column[] = [
        { header: "N° vente", key: "number", width: 16 },
        { header: "Date", key: "saleDate", width: 18 },
        { header: "Client", key: "customerName", width: 28 },
        { header: "Tarif", key: "priceTier", width: 12 },
        { header: "Paiement", key: "paymentMethod", width: 12 },
        { header: "Articles", key: "itemCount", width: 10, numFmt: INT },
        { header: "Sous-total", key: "subtotal", width: 16, numFmt: MONEY },
        { header: "Remise", key: "discountAmount", width: 14, numFmt: MONEY },
        { header: "Total", key: "total", width: 16, numFmt: MONEY },
        { header: "Marge", key: "margin", width: 16, numFmt: MONEY },
        { header: "Vendeur", key: "userName", width: 20 },
      ];
      const ws = wb.addWorksheet("Ventes");
      styleSheet(ws, cols, "Journal des ventes confirmées", rangeLabel);
      addRows(
        ws,
        rows.map((x) => ({
          ...x,
          saleDate: format(new Date(x.saleDate), "dd/MM/yyyy HH:mm"),
          priceTier: PRICE_TIER_LABELS[x.priceTier as keyof typeof PRICE_TIER_LABELS] ?? x.priceTier,
          paymentMethod: PAYMENT_METHOD_LABELS[x.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] ?? x.paymentMethod,
        })),
        cols,
      );
      addTotalRow(ws, "Total", { 6: summary.items, 8: summary.discount, 9: summary.total, 10: summary.margin });
      // Line detail
      const sqlite = getSqlite();
      const lines = sqlite
        .prepare(
          `SELECT s.number, s.sale_date AS saleDate, si.reference, si.designation, si.quantity, si.unit_price AS unitPrice, si.line_total AS lineTotal
           FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE s.status='CONFIRMEE' AND s.sale_date >= ? AND s.sale_date <= ? ORDER BY s.sale_date DESC`,
        )
        .all(r.from, r.to) as Record<string, unknown>[];
      const lcols: Column[] = [
        { header: "N° vente", key: "number", width: 16 },
        { header: "Date", key: "saleDate", width: 18 },
        { header: "Référence", key: "reference", width: 20 },
        { header: "Désignation", key: "designation", width: 44 },
        { header: "Quantité", key: "quantity", width: 10, numFmt: INT },
        { header: "Prix unitaire", key: "unitPrice", width: 16, numFmt: MONEY },
        { header: "Total ligne", key: "lineTotal", width: 16, numFmt: MONEY },
      ];
      const ws2 = wb.addWorksheet("Lignes de vente");
      styleSheet(ws2, lcols, "Détail des lignes de vente", rangeLabel);
      addRows(ws2, lines.map((l) => ({ ...l, saleDate: format(new Date(String(l.saleDate)), "dd/MM/yyyy HH:mm") })), lcols);
      break;
    }
    case "achats": {
      const r = range ?? defaultRange();
      const { rows, summary } = purchasesReport(r);
      const cols: Column[] = [
        { header: "N° achat", key: "number", width: 16 },
        { header: "Date", key: "purchaseDate", width: 18 },
        { header: "Fournisseur", key: "supplierName", width: 32 },
        { header: "Facture fourn.", key: "invoice", width: 16 },
        { header: "Statut", key: "status", width: 12 },
        { header: "Articles", key: "itemCount", width: 10, numFmt: INT },
        { header: "Total", key: "total", width: 16, numFmt: MONEY },
        { header: "Réceptionné le", key: "receivedAt", width: 18 },
        { header: "Saisi par", key: "userName", width: 20 },
      ];
      const ws = wb.addWorksheet("Achats");
      styleSheet(ws, cols, "Journal des achats", rangeLabel);
      addRows(
        ws,
        rows.map((x) => ({
          ...x,
          purchaseDate: format(new Date(x.purchaseDate), "dd/MM/yyyy"),
          receivedAt: x.receivedAt ? format(new Date(x.receivedAt), "dd/MM/yyyy HH:mm") : "",
          status: PURCHASE_STATUS_LABELS[x.status as keyof typeof PURCHASE_STATUS_LABELS] ?? x.status,
        })),
        cols,
      );
      addTotalRow(ws, "Total", { 6: summary.items, 7: summary.total });
      const sqlite = getSqlite();
      const lines = sqlite
        .prepare(
          `SELECT p.number, p.purchase_date AS purchaseDate, pi.reference, pi.designation, pi.quantity, pi.unit_cost AS unitCost, pi.line_total AS lineTotal
           FROM purchase_items pi JOIN purchases p ON p.id = pi.purchase_id WHERE p.status <> 'ANNULEE' AND p.purchase_date >= ? AND p.purchase_date <= ? ORDER BY p.purchase_date DESC`,
        )
        .all(r.from, r.to) as Record<string, unknown>[];
      const lcols: Column[] = [
        { header: "N° achat", key: "number", width: 16 },
        { header: "Date", key: "purchaseDate", width: 14 },
        { header: "Référence", key: "reference", width: 20 },
        { header: "Désignation", key: "designation", width: 44 },
        { header: "Quantité", key: "quantity", width: 10, numFmt: INT },
        { header: "Prix d'achat", key: "unitCost", width: 16, numFmt: MONEY },
        { header: "Total ligne", key: "lineTotal", width: 16, numFmt: MONEY },
      ];
      const ws2 = wb.addWorksheet("Lignes d'achat");
      styleSheet(ws2, lcols, "Détail des lignes d'achat", rangeLabel);
      addRows(ws2, lines.map((l) => ({ ...l, purchaseDate: format(new Date(String(l.purchaseDate)), "dd/MM/yyyy") })), lcols);
      break;
    }
    case "mouvements": {
      const r = range ?? defaultRange();
      const { items } = listMovements({ from: r.from, to: r.to, pageSize: 200, page: 1 });
      // listMovements caps at 200 per page: iterate pages for a full export
      const all = [...items];
      let page = 2;
      while (all.length < 20000) {
        const next = listMovements({ from: r.from, to: r.to, pageSize: 200, page });
        if (next.items.length === 0) break;
        all.push(...next.items);
        if (page >= next.pageCount) break;
        page++;
      }
      const cols: Column[] = [
        { header: "Date", key: "createdAt", width: 18 },
        { header: "Type", key: "type", width: 18 },
        { header: "Référence", key: "reference", width: 20 },
        { header: "Désignation", key: "designation", width: 44 },
        { header: "Quantité", key: "quantity", width: 10, numFmt: "+#,##0;-#,##0;0" },
        { header: "Stock avant", key: "previousQuantity", width: 12, numFmt: INT },
        { header: "Stock après", key: "newQuantity", width: 12, numFmt: INT },
        { header: "Document", key: "documentNumber", width: 16 },
        { header: "Motif", key: "reason", width: 36 },
        { header: "Utilisateur", key: "userName", width: 20 },
      ];
      const ws = wb.addWorksheet("Mouvements");
      styleSheet(ws, cols, "Journal des mouvements de stock", rangeLabel);
      addRows(
        ws,
        all.map((m) => ({ ...m, createdAt: format(new Date(m.createdAt), "dd/MM/yyyy HH:mm"), type: MOVEMENT_TYPE_LABELS[m.type as MovementTypeKey] ?? m.type })),
        cols,
      );
      break;
    }
    case "fournisseurs": {
      const rows = listSuppliers({ includeInactive: true });
      const cols: Column[] = [
        { header: "Nom", key: "name", width: 34 },
        { header: "Contact", key: "contactName", width: 24 },
        { header: "Téléphone", key: "phone", width: 16 },
        { header: "Email", key: "email", width: 28 },
        { header: "Ville", key: "city", width: 16 },
        { header: "Pièces fournies", key: "partCount", width: 14, numFmt: INT },
        { header: "Nb achats", key: "purchaseCount", width: 12, numFmt: INT },
        { header: "Total achats reçus", key: "purchaseTotal", width: 20, numFmt: MONEY },
        { header: "Actif", key: "isActive", width: 8 },
      ];
      const ws = wb.addWorksheet("Fournisseurs");
      styleSheet(ws, cols, "Liste des fournisseurs");
      addRows(ws, rows.map((r) => ({ ...r, isActive: r.isActive ? "Oui" : "Non" })), cols);
      break;
    }
    case "top-ventes": {
      const r = range ?? defaultRange();
      const rows = topSellingParts(r, 100);
      const cols: Column[] = [
        { header: "Référence", key: "reference", width: 20 },
        { header: "Désignation", key: "designation", width: 44 },
        { header: "Marque", key: "brand", width: 16 },
        { header: "Catégorie", key: "category", width: 16 },
        { header: "Qté vendue", key: "quantity", width: 12, numFmt: INT },
        { header: "CA", key: "total", width: 16, numFmt: MONEY },
        { header: "Marge", key: "margin", width: 16, numFmt: MONEY },
        { header: "Stock actuel", key: "stock", width: 12, numFmt: INT },
      ];
      const ws = wb.addWorksheet("Top ventes");
      styleSheet(ws, cols, "Pièces les plus vendues", rangeLabel);
      addRows(ws, rows, cols);
      break;
    }
    case "rotation": {
      const r = range ?? defaultRange();
      const rows = stockRotation(r);
      const cols: Column[] = [
        { header: "Référence", key: "reference", width: 20 },
        { header: "Désignation", key: "designation", width: 44 },
        { header: "Marque", key: "brand", width: 16 },
        { header: "Catégorie", key: "category", width: 16 },
        { header: "Stock", key: "stock", width: 10, numFmt: INT },
        { header: "Vendu (période)", key: "sold", width: 14, numFmt: INT },
        { header: "Couverture (jours)", key: "coverDays", width: 16 },
        { header: "Classification", key: "classification", width: 14 },
        { header: "Dernière vente", key: "lastSaleAt", width: 16 },
      ];
      const ws = wb.addWorksheet("Rotation");
      styleSheet(ws, cols, "Rotation du stock", rangeLabel);
      addRows(
        ws,
        rows.map((x) => ({
          ...x,
          coverDays: x.coverDays ?? "—",
          classification: x.classification === "RAPIDE" ? "Rapide" : x.classification === "DORMANT" ? "Dormant" : "Normal",
          lastSaleAt: x.lastSaleAt ? format(new Date(x.lastSaleAt), "dd/MM/yyyy") : "",
        })),
        cols,
      );
      break;
    }
    case "modele-import": {
      fileName = "autostock_modele_import.xlsx";
      const cols: Column[] = [
        { header: "Référence", key: "reference", width: 22 },
        { header: "Désignation", key: "designation", width: 44 },
        { header: "Marque", key: "brand", width: 16 },
        { header: "Quantité", key: "quantity", width: 11, numFmt: INT },
        { header: "Prix d'Achat", key: "purchasePrice", width: 15, numFmt: MONEY },
        { header: "Prix Gros", key: "wholesalePrice", width: 15, numFmt: MONEY },
        { header: "Prix Détail", key: "retailPrice", width: 15, numFmt: MONEY },
        { header: "UM", key: "unit", width: 8 },
        { header: "Rayon", key: "location", width: 10 },
        { header: "Stock Minimum", key: "minStock", width: 14, numFmt: INT },
        { header: "Catégorie", key: "category", width: 16 },
        { header: "Fournisseur", key: "supplier", width: 28 },
        { header: "Référence OEM", key: "oem", width: 24 },
        { header: "Code-barres", key: "barcode", width: 16 },
      ];
      const ws = wb.addWorksheet("Articles");
      styleSheet(ws, cols, "Modèle d'import AutoStock", "Renseignez une ligne par article. Colonnes obligatoires : Référence, Désignation.");
      addRows(
        ws,
        [
          { reference: "0986494090", designation: "Jeu de plaquettes de frein avant", brand: "Bosch", quantity: 10, purchasePrice: 2450, wholesalePrice: 2900, retailPrice: 3400, unit: "Jeu", location: "A01", minStock: 4, category: "Freinage", supplier: "SARL Auto Pièces Blida", oem: "7701208265 / 410605536R", barcode: "4047024551831" },
          { reference: "W75/3", designation: "Filtre à huile", brand: "Mann-Filter", quantity: 25, purchasePrice: 520, wholesalePrice: 650, retailPrice: 800, unit: "Pièce", location: "B01", minStock: 10, category: "Filtration", supplier: "", oem: "7700274177 / 8200768927", barcode: "" },
        ],
        cols,
      );
      break;
    }
  }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, fileName };
}

function defaultRange(): DateRange {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86_400_000);
  return { from: from.toISOString(), to: to.toISOString() };
}
