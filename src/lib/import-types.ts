/**
 * Types shared between the import wizard UI and the server import service.
 */

export const IMPORT_TARGET_FIELDS = [
  { key: "reference", label: "Référence", required: true, description: "Référence principale. Plusieurs références séparées par « / » sont acceptées." },
  { key: "designation", label: "Désignation", required: true, description: "Nom / libellé de l'article." },
  { key: "brand", label: "Marque", required: false, description: "Créée automatiquement si inconnue." },
  { key: "quantity", label: "Quantité", required: false, description: "Stock initial. Un mouvement « Import » est créé." },
  { key: "purchasePrice", label: "Prix d'Achat", required: false },
  { key: "wholesalePrice", label: "Prix Gros", required: false },
  { key: "retailPrice", label: "Prix Détail", required: false },
  { key: "unit", label: "UM (unité)", required: false, description: "Pièce, Jeu, Kit, Litre…" },
  { key: "location", label: "Rayon / Emplacement", required: false, description: "Créé automatiquement si inconnu." },
  { key: "minStock", label: "Stock Minimum", required: false },
  { key: "category", label: "Catégorie", required: false },
  { key: "supplier", label: "Fournisseur", required: false },
  { key: "oem", label: "Référence(s) OEM", required: false, description: "Plusieurs valeurs séparées par « / »." },
  { key: "alternative", label: "Référence(s) alternative(s)", required: false },
  { key: "barcode", label: "Code-barres", required: false },
  { key: "description", label: "Description", required: false },
  { key: "notes", label: "Notes", required: false },
] as const;

export type ImportTargetField = (typeof IMPORT_TARGET_FIELDS)[number]["key"];

/** columnIndex (0-based) → target field. Unmapped columns are simply ignored (but reported). */
export type ColumnMapping = Record<number, ImportTargetField | "">;

export type ImportSheetInfo = {
  name: string;
  rowCount: number;
  headers: string[];
  /** First rows for preview (raw cell strings). */
  sample: string[][];
  suggestedMapping: ColumnMapping;
};

export type ImportWorkbookInfo = {
  token: string;
  fileName: string;
  sheets: ImportSheetInfo[];
};

export type RowIssue = { level: "error" | "warning"; field?: string; message: string };

export type ValidatedRow = {
  rowNumber: number;
  raw: string[];
  parsed: {
    reference: string;
    referenceRaw: string;
    extraReferences: string[];
    designation: string;
    brand: string | null;
    quantity: number | null;
    purchasePrice: number | null;
    wholesalePrice: number | null;
    retailPrice: number | null;
    unit: string | null;
    location: string | null;
    minStock: number | null;
    category: string | null;
    supplier: string | null;
    oem: string[];
    alternative: string[];
    barcode: string | null;
    description: string | null;
    notes: string | null;
  } | null;
  issues: RowIssue[];
  status: "valid" | "warning" | "error";
  /** Reference already exists in the database → will be updated (not duplicated). */
  existingPartId: number | null;
  /** Duplicate of another row in the same file. */
  duplicateOfRow: number | null;
};

export type ImportValidationResult = {
  token: string;
  sheetName: string;
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  duplicateInFile: number;
  existingInDb: number;
  missingReference: number;
  missingDesignation: number;
  invalidQuantity: number;
  invalidPrice: number;
  unmappedColumns: string[];
  rows: ValidatedRow[];
};

export type ImportOptions = {
  /** What to do with references that already exist. */
  existingStrategy: "update" | "skip" | "update-no-stock";
  /** Whether quantities from the file should create initial stock movements. */
  applyQuantities: boolean;
  /** Skip rows with warnings too (only strictly valid rows). */
  strict: boolean;
};

export type ImportCommitResult = {
  batchId: number;
  created: number;
  updated: number;
  skipped: number;
  movements: number;
  errors: { rowNumber: number; message: string }[];
};
