import "server-only";
import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { getDb, getSqlite, schema } from "@/server/db/client";
import { rebuildSearchIndex } from "@/server/db/search-index";
import { normalizeReference, normalizeText, splitReferences } from "@/lib/references";
import { BusinessError } from "@/lib/result";
import type {
  ColumnMapping,
  ImportCommitResult,
  ImportOptions,
  ImportSheetInfo,
  ImportTargetField,
  ImportValidationResult,
  ImportWorkbookInfo,
  RowIssue,
  ValidatedRow,
} from "@/lib/import-types";
import { applyStockMovement } from "./inventory";
import { getOrCreateBrand, getOrCreateCategory, getOrCreateLocation, getOrCreateSupplier } from "./parts";

/* -------------------------------------------------------------------------- */
/*  Temporary storage of uploaded workbooks                                   */
/* -------------------------------------------------------------------------- */

function uploadDir(): string {
  const configured = process.env.UPLOAD_DIR ?? "./data/uploads";
  const dir = path.join(path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured), "imports");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function tokenPath(token: string): string {
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(token)) throw new BusinessError("Jeton d'import invalide.");
  return path.join(uploadDir(), `${token}.xlsx`);
}

/** Remove uploads older than 2 hours. */
function cleanupOldUploads() {
  try {
    const dir = uploadDir();
    const cutoff = Date.now() - 2 * 3600_000;
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).mtimeMs < cutoff) fs.unlinkSync(p);
    }
  } catch {
    /* ignore */
  }
}

/* -------------------------------------------------------------------------- */
/*  Header → field auto-mapping                                               */
/* -------------------------------------------------------------------------- */

const HEADER_ALIASES: Record<ImportTargetField, string[]> = {
  reference: ["reference", "ref", "referance", "référence", "code", "code article", "article", "ref article", "part number", "pn", "sku"],
  designation: ["designation", "désignation", "libelle", "libellé", "nom", "name", "description article", "produit", "article designation"],
  brand: ["marque", "brand", "fabricant", "constructeur", "make"],
  quantity: ["quantite", "quantité", "qte", "qté", "qty", "stock", "quantity", "stock actuel", "qte stock"],
  purchasePrice: ["prix d'achat", "prix achat", "prix dachat", "pa", "p.a", "achat", "cout", "coût", "purchase price", "prix ht achat", "prix d achat"],
  wholesalePrice: ["prix gros", "prix de gros", "gros", "pg", "p.g", "wholesale", "prix grossiste", "prix revendeur"],
  retailPrice: ["prix detail", "prix détail", "detail", "détail", "pd", "p.d", "prix vente", "prix de vente", "pv", "retail", "prix public", "prix unitaire"],
  unit: ["um", "unite", "unité", "u.m", "unit", "uom", "unite de mesure"],
  location: ["rayon", "emplacement", "location", "casier", "etagere", "étagère", "position", "zone", "magasin"],
  minStock: ["stock minimum", "stock min", "min", "minimum", "seuil", "stock mini", "min stock", "alerte"],
  category: ["categorie", "catégorie", "category", "famille", "groupe", "type"],
  supplier: ["fournisseur", "supplier", "vendor", "fourn"],
  oem: ["oem", "ref oem", "reference oem", "référence oem", "ref constructeur", "reference constructeur", "origine"],
  alternative: ["alternative", "ref alternative", "equivalence", "équivalence", "equivalent", "autres references", "cross"],
  barcode: ["code barre", "code-barres", "code barres", "codebarre", "barcode", "ean", "ean13", "gencod"],
  description: ["description", "descriptif", "commentaire", "details", "détails"],
  notes: ["notes", "note", "remarque", "remarques", "observation", "observations"],
};

function suggestField(header: string): ImportTargetField | "" {
  const h = normalizeText(header).replace(/[^a-z0-9' .]/g, " ").replace(/\s+/g, " ").trim();
  if (!h) return "";
  // exact alias first, then contains
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [ImportTargetField, string[]][]) {
    if (aliases.some((a) => normalizeText(a) === h)) return field;
  }
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [ImportTargetField, string[]][]) {
    if (aliases.some((a) => a.length >= 3 && h.includes(normalizeText(a)))) return field;
  }
  return "";
}

/* -------------------------------------------------------------------------- */
/*  Reading                                                                   */
/* -------------------------------------------------------------------------- */

function cellToString(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  if (typeof v === "boolean") return v ? "1" : "0";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v && Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("").trim();
    if ("result" in v && v.result !== undefined && v.result !== null) return String(v.result).trim();
    if ("text" in v && typeof v.text === "string") return v.text.trim();
    if ("hyperlink" in v && typeof v.hyperlink === "string") return String(v.text ?? v.hyperlink).trim();
  }
  return String(v).trim();
}

async function loadWorkbook(token: string): Promise<ExcelJS.Workbook> {
  const p = tokenPath(token);
  if (!fs.existsSync(p)) throw new BusinessError("Le fichier importé a expiré. Veuillez le téléverser à nouveau.");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(p);
  return wb;
}

function readSheet(ws: ExcelJS.Worksheet, maxRows?: number): { headers: string[]; rows: { rowNumber: number; cells: string[] }[]; headerRowNumber: number } {
  // Detect header row: first row with >= 2 non-empty cells within the first 10 rows
  let headerRowNumber = 1;
  for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
    const row = ws.getRow(r);
    let filled = 0;
    row.eachCell({ includeEmpty: false }, (c) => {
      if (cellToString(c)) filled++;
    });
    if (filled >= 2) {
      headerRowNumber = r;
      break;
    }
  }
  const headerRow = ws.getRow(headerRowNumber);
  const colCount = Math.max(headerRow.cellCount, ws.columnCount);
  const headers: string[] = [];
  for (let c = 1; c <= colCount; c++) headers.push(cellToString(headerRow.getCell(c)));
  // Trim trailing empty headers
  while (headers.length && !headers[headers.length - 1]) headers.pop();

  const rows: { rowNumber: number; cells: string[] }[] = [];
  const last = maxRows ? Math.min(ws.rowCount, headerRowNumber + maxRows) : ws.rowCount;
  for (let r = headerRowNumber + 1; r <= last; r++) {
    const row = ws.getRow(r);
    const cells: string[] = [];
    let any = false;
    for (let c = 1; c <= headers.length; c++) {
      const s = cellToString(row.getCell(c));
      if (s) any = true;
      cells.push(s);
    }
    if (any) rows.push({ rowNumber: r, cells });
  }
  return { headers, rows, headerRowNumber };
}

export async function storeUploadedWorkbook(file: { name: string; bytes: Buffer }): Promise<ImportWorkbookInfo> {
  cleanupOldUploads();
  if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
    if (/\.xls$/i.test(file.name)) throw new BusinessError("Le format .xls (Excel 97-2003) n'est pas pris en charge. Ouvrez le fichier dans Excel et enregistrez-le au format .xlsx.");
    throw new BusinessError("Format non pris en charge. Veuillez importer un fichier .xlsx.");
  }
  if (file.bytes.length > 25 * 1024 * 1024) throw new BusinessError("Fichier trop volumineux (max 25 Mo).");

  const token = nanoid(24);
  fs.writeFileSync(tokenPath(token), file.bytes);

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(file.bytes as unknown as ArrayBuffer);
  } catch {
    fs.unlinkSync(tokenPath(token));
    throw new BusinessError("Impossible de lire ce fichier Excel. Vérifiez qu'il n'est pas corrompu ou protégé.");
  }

  const sheets: ImportSheetInfo[] = [];
  for (const ws of wb.worksheets) {
    const { headers, rows } = readSheet(ws, 8);
    const rowCount = Math.max(0, ws.actualRowCount - 1);
    const suggestedMapping: ColumnMapping = {};
    const used = new Set<string>();
    headers.forEach((h, i) => {
      const f = suggestField(h);
      if (f && !used.has(f)) {
        suggestedMapping[i] = f;
        used.add(f);
      } else suggestedMapping[i] = "";
    });
    sheets.push({ name: ws.name, rowCount, headers, sample: rows.slice(0, 6).map((r) => r.cells), suggestedMapping });
  }
  if (sheets.length === 0) throw new BusinessError("Le classeur ne contient aucune feuille.");
  return { token, fileName: file.name, sheets };
}

/* -------------------------------------------------------------------------- */
/*  Validation                                                                */
/* -------------------------------------------------------------------------- */

function parseNumber(raw: string): { value: number | null; invalid: boolean } {
  if (raw === "" || raw == null) return { value: null, invalid: false };
  let s = raw.replace(/\s|\u00a0/g, "").replace(/DA|DZD|€/gi, "");
  // "1.234,50" (fr) → 1234.50 ; "1,234.50" (en) → 1234.50 ; "1234,5" → 1234.5
  if (/,\d{1,2}$/.test(s) && /\./.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{3}(,|$)/.test(s) && /,/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n)) return { value: null, invalid: true };
  return { value: n, invalid: false };
}

export async function validateImport(token: string, sheetName: string, mapping: ColumnMapping): Promise<ImportValidationResult> {
  const wb = await loadWorkbook(token);
  const ws = wb.getWorksheet(sheetName);
  if (!ws) throw new BusinessError("Feuille introuvable dans le classeur.");
  const { headers, rows } = readSheet(ws);

  const fieldToCol = new Map<ImportTargetField, number>();
  for (const [colStr, field] of Object.entries(mapping)) {
    if (field) fieldToCol.set(field, Number(colStr));
  }
  if (!fieldToCol.has("reference")) throw new BusinessError("La colonne « Référence » doit être associée.");
  if (!fieldToCol.has("designation")) throw new BusinessError("La colonne « Désignation » doit être associée.");

  const unmappedColumns = headers.filter((h, i) => h && !mapping[i]);
  const get = (cells: string[], field: ImportTargetField): string => {
    const c = fieldToCol.get(field);
    return c === undefined ? "" : (cells[c] ?? "");
  };

  const sqlite = getSqlite();
  const findExisting = sqlite.prepare(`SELECT id FROM parts WHERE reference_normalized = ?`);
  const findExistingAlt = sqlite.prepare(`SELECT part_id AS id FROM part_references WHERE reference_normalized = ? LIMIT 1`);

  const seen = new Map<string, number>();
  const out: ValidatedRow[] = [];
  let validRows = 0, warningRows = 0, errorRows = 0, duplicateInFile = 0, existingInDb = 0, missingReference = 0, missingDesignation = 0, invalidQuantity = 0, invalidPrice = 0;

  for (const { rowNumber, cells } of rows) {
    const issues: RowIssue[] = [];
    const referenceRaw = get(cells, "reference");
    const designation = get(cells, "designation");
    const refs = splitReferences(referenceRaw);
    const reference = refs[0] ?? "";
    const extraReferences = refs.slice(1);

    if (!reference) {
      issues.push({ level: "error", field: "reference", message: "Référence manquante." });
      missingReference++;
    } else if (normalizeReference(reference).length < 2) {
      issues.push({ level: "error", field: "reference", message: "Référence trop courte." });
    }
    if (!designation) {
      issues.push({ level: "error", field: "designation", message: "Désignation manquante." });
      missingDesignation++;
    }
    if (extraReferences.length) issues.push({ level: "warning", field: "reference", message: `${extraReferences.length} référence(s) supplémentaire(s) détectée(s) : enregistrées comme références alternatives.` });

    const qty = parseNumber(get(cells, "quantity"));
    if (qty.invalid) {
      issues.push({ level: "error", field: "quantity", message: `Quantité invalide « ${get(cells, "quantity")} ».` });
      invalidQuantity++;
    } else if (qty.value !== null && (!Number.isInteger(qty.value) || qty.value < 0)) {
      if (qty.value < 0) {
        issues.push({ level: "error", field: "quantity", message: "Quantité négative." });
        invalidQuantity++;
      } else issues.push({ level: "warning", field: "quantity", message: `Quantité décimale « ${qty.value} » arrondie à ${Math.round(qty.value)}.` });
    }

    const prices: Record<"purchasePrice" | "wholesalePrice" | "retailPrice", number | null> = { purchasePrice: null, wholesalePrice: null, retailPrice: null };
    let priceInvalid = false;
    for (const f of ["purchasePrice", "wholesalePrice", "retailPrice"] as const) {
      const p = parseNumber(get(cells, f));
      if (p.invalid) {
        issues.push({ level: "error", field: f, message: `Prix invalide « ${get(cells, f)} ».` });
        priceInvalid = true;
      } else if (p.value !== null && p.value < 0) {
        issues.push({ level: "error", field: f, message: "Prix négatif." });
        priceInvalid = true;
      } else prices[f] = p.value;
    }
    if (priceInvalid) invalidPrice++;
    if (prices.retailPrice !== null && prices.purchasePrice !== null && prices.retailPrice < prices.purchasePrice) {
      issues.push({ level: "warning", field: "retailPrice", message: "Prix détail inférieur au prix d'achat." });
    }
    const minStock = parseNumber(get(cells, "minStock"));
    if (minStock.invalid || (minStock.value !== null && minStock.value < 0)) issues.push({ level: "warning", field: "minStock", message: "Stock minimum invalide : ignoré." });

    let existingPartId: number | null = null;
    let duplicateOfRow: number | null = null;
    if (reference) {
      const n = normalizeReference(reference);
      const dupRow = seen.get(n);
      if (dupRow !== undefined) {
        duplicateOfRow = dupRow;
        duplicateInFile++;
        issues.push({ level: "error", field: "reference", message: `Référence en double dans le fichier (ligne ${dupRow}).` });
      } else seen.set(n, rowNumber);
      const ex = (findExisting.get(n) as { id: number } | undefined) ?? (findExistingAlt.get(n) as { id: number } | undefined);
      if (ex) {
        existingPartId = ex.id;
        existingInDb++;
        issues.push({ level: "warning", field: "reference", message: "Référence déjà présente dans la base : la fiche sera mise à jour." });
      }
    }

    const hasError = issues.some((i) => i.level === "error");
    const status: ValidatedRow["status"] = hasError ? "error" : issues.length ? "warning" : "valid";
    if (status === "valid") validRows++;
    else if (status === "warning") warningRows++;
    else errorRows++;

    out.push({
      rowNumber,
      raw: cells,
      parsed: hasError
        ? null
        : {
            reference,
            referenceRaw,
            extraReferences,
            designation,
            brand: get(cells, "brand") || null,
            quantity: qty.value === null ? null : Math.round(qty.value),
            purchasePrice: prices.purchasePrice,
            wholesalePrice: prices.wholesalePrice,
            retailPrice: prices.retailPrice,
            unit: get(cells, "unit") || null,
            location: get(cells, "location") || null,
            minStock: minStock.invalid || minStock.value === null || minStock.value < 0 ? null : Math.round(minStock.value),
            category: get(cells, "category") || null,
            supplier: get(cells, "supplier") || null,
            oem: splitReferences(get(cells, "oem")),
            alternative: splitReferences(get(cells, "alternative")),
            barcode: get(cells, "barcode") || null,
            description: get(cells, "description") || null,
            notes: get(cells, "notes") || null,
          },
      issues,
      status,
      existingPartId,
      duplicateOfRow,
    });
  }

  return {
    token,
    sheetName,
    totalRows: rows.length,
    validRows,
    warningRows,
    errorRows,
    duplicateInFile,
    existingInDb,
    missingReference,
    missingDesignation,
    invalidQuantity,
    invalidPrice,
    unmappedColumns,
    rows: out,
  };
}

/* -------------------------------------------------------------------------- */
/*  Commit                                                                    */
/* -------------------------------------------------------------------------- */

export async function commitImport(token: string, sheetName: string, mapping: ColumnMapping, options: ImportOptions, userId: number, fileName: string): Promise<ImportCommitResult> {
  const validation = await validateImport(token, sheetName, mapping);
  const db = getDb();
  const sqlite = getSqlite();
  const errors: { rowNumber: number; message: string }[] = [];
  let created = 0, updated = 0, skipped = 0, movements = 0;

  const unitNormalize = (u: string | null): string => {
    if (!u) return "Pièce";
    const n = normalizeText(u);
    if (["pcs", "pc", "piece", "pieces", "u", "unite", "un", "p"].includes(n)) return "Pièce";
    if (["jeu", "jeux", "set"].includes(n)) return "Jeu";
    if (["kit", "kits"].includes(n)) return "Kit";
    if (["l", "litre", "litres", "lt"].includes(n)) return "Litre";
    if (["m", "metre", "metres", "ml"].includes(n)) return "Mètre";
    if (["paire", "paires", "pr"].includes(n)) return "Paire";
    if (["boite", "boites", "bte", "box"].includes(n)) return "Boîte";
    if (["carton", "cartons", "ctn"].includes(n)) return "Carton";
    return u.trim().slice(0, 20);
  };

  const tx = sqlite.transaction(() => {
    const [batch] = db
      .insert(schema.importBatches)
      .values({ fileName, sheetName, totalRows: validation.totalRows, importedRows: 0, updatedRows: 0, skippedRows: 0, mapping: JSON.stringify(mapping), userId })
      .returning({ id: schema.importBatches.id })
      .all();
    const batchId = batch!.id;
    const now = new Date().toISOString();

    for (const row of validation.rows) {
      if (row.status === "error" || !row.parsed) {
        skipped++;
        continue;
      }
      if (options.strict && row.status === "warning" && !row.existingPartId && row.parsed.extraReferences.length === 0) {
        skipped++;
        continue;
      }
      const p = row.parsed;
      try {
        const brandId = p.brand ? getOrCreateBrand(p.brand) : null;
        const categoryId = p.category ? getOrCreateCategory(p.category) : null;
        const locationId = p.location ? getOrCreateLocation(p.location) : null;
        const supplierId = p.supplier ? getOrCreateSupplier(p.supplier) : null;
        const unit = unitNormalize(p.unit);

        let partId: number;
        let isNew = false;
        if (row.existingPartId) {
          if (options.existingStrategy === "skip") {
            skipped++;
            continue;
          }
          partId = row.existingPartId;
          const patch: Partial<typeof schema.parts.$inferInsert> = {
            designation: p.designation,
            updatedAt: now,
            ...(brandId ? { brandId } : {}),
            ...(categoryId ? { categoryId } : {}),
            ...(locationId ? { locationId } : {}),
            ...(supplierId ? { supplierId } : {}),
            ...(p.unit ? { unit } : {}),
            ...(p.purchasePrice !== null ? { purchasePrice: p.purchasePrice } : {}),
            ...(p.wholesalePrice !== null ? { wholesalePrice: p.wholesalePrice } : {}),
            ...(p.retailPrice !== null ? { retailPrice: p.retailPrice } : {}),
            ...(p.minStock !== null ? { minStock: p.minStock } : {}),
            ...(p.barcode ? { barcode: p.barcode } : {}),
            ...(p.description ? { description: p.description } : {}),
            ...(p.notes ? { notes: p.notes } : {}),
            ...(p.referenceRaw && p.extraReferences.length ? { referenceRaw: p.referenceRaw } : {}),
          };
          db.update(schema.parts).set(patch).where(eq(schema.parts.id, partId)).run();
          updated++;
        } else {
          const [ins] = db
            .insert(schema.parts)
            .values({
              reference: p.reference,
              referenceNormalized: normalizeReference(p.reference),
              referenceRaw: p.extraReferences.length ? p.referenceRaw : null,
              designation: p.designation,
              description: p.description,
              brandId,
              categoryId,
              locationId,
              supplierId,
              unit,
              purchasePrice: p.purchasePrice ?? 0,
              wholesalePrice: p.wholesalePrice ?? 0,
              retailPrice: p.retailPrice ?? 0,
              quantity: 0,
              minStock: p.minStock ?? 0,
              barcode: p.barcode,
              notes: p.notes,
              createdAt: now,
              updatedAt: now,
            })
            .returning({ id: schema.parts.id })
            .all();
          partId = ins!.id;
          isNew = true;
          created++;
        }

        // Alternative / OEM references (merge, never delete existing ones)
        const refsToAdd: { type: "OEM" | "ALTERNATIVE" | "BARCODE"; reference: string }[] = [
          ...p.extraReferences.map((r) => ({ type: "ALTERNATIVE" as const, reference: r })),
          ...p.oem.map((r) => ({ type: "OEM" as const, reference: r })),
          ...p.alternative.map((r) => ({ type: "ALTERNATIVE" as const, reference: r })),
        ];
        for (const r of refsToAdd) {
          const n = normalizeReference(r.reference);
          if (!n || n === normalizeReference(p.reference)) continue;
          const exists = sqlite.prepare(`SELECT 1 FROM part_references WHERE part_id = ? AND reference_normalized = ?`).get(partId, n);
          if (!exists) db.insert(schema.partReferences).values({ partId, type: r.type, reference: r.reference, referenceNormalized: n }).run();
        }

        // Stock quantity → movement
        if (options.applyQuantities && p.quantity !== null && !(row.existingPartId && options.existingStrategy === "update-no-stock")) {
          const current = (db.select({ q: schema.parts.quantity }).from(schema.parts).where(eq(schema.parts.id, partId)).get()?.q) ?? 0;
          const delta = isNew ? p.quantity : p.quantity - current;
          if (delta !== 0) {
            applyStockMovement(db, {
              partId,
              type: isNew ? "IMPORT" : "INVENTAIRE",
              quantity: delta,
              userId,
              reason: isNew ? `Import Excel — ${fileName}` : `Import Excel (régularisation) — ${fileName}`,
              unitCost: p.purchasePrice,
              documentType: "IMPORT",
              documentId: batchId,
              documentNumber: fileName,
              createdAt: now,
            });
            movements++;
          }
        }
      } catch (err) {
        errors.push({ rowNumber: row.rowNumber, message: err instanceof Error ? err.message : "Erreur inconnue" });
        skipped++;
      }
    }

    db.update(schema.importBatches)
      .set({ importedRows: created, updatedRows: updated, skippedRows: skipped })
      .where(eq(schema.importBatches.id, batchId))
      .run();
    return batchId;
  });

  const batchId = tx();
  rebuildSearchIndex(sqlite);
  try {
    fs.unlinkSync(tokenPath(token));
  } catch {
    /* ignore */
  }
  return { batchId, created, updated, skipped, movements, errors };
}

export function listImportBatches(limit = 20) {
  return getSqlite()
    .prepare(
      `SELECT b.id, b.file_name AS fileName, b.sheet_name AS sheetName, b.total_rows AS totalRows, b.imported_rows AS importedRows,
              b.updated_rows AS updatedRows, b.skipped_rows AS skippedRows, u.full_name AS userName, b.created_at AS createdAt
       FROM import_batches b LEFT JOIN users u ON u.id = b.user_id ORDER BY b.created_at DESC LIMIT ?`,
    )
    .all(limit) as { id: number; fileName: string; sheetName: string; totalRows: number; importedRows: number; updatedRows: number; skippedRows: number; userName: string | null; createdAt: string }[];
}
