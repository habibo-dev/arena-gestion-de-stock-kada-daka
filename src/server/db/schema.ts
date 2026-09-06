import { sql, relations } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/* -------------------------------------------------------------------------- */
/*  Shared column helpers                                                     */
/* -------------------------------------------------------------------------- */

const timestamps = {
  createdAt: text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
};

/* -------------------------------------------------------------------------- */
/*  Users & roles                                                             */
/* -------------------------------------------------------------------------- */

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull(),
    fullName: text("full_name").notNull(),
    email: text("email"),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["ADMIN", "MANAGER", "EMPLOYEE"] }).notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    lastLoginAt: text("last_login_at"),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_username_idx").on(t.username)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/* -------------------------------------------------------------------------- */
/*  Reference data                                                            */
/* -------------------------------------------------------------------------- */

export const categories = sqliteTable(
  "categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    parentId: integer("parent_id"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("categories_slug_idx").on(t.slug), index("categories_parent_idx").on(t.parentId)],
);

export const brands = sqliteTable(
  "brands",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    country: text("country"),
    isOem: integer("is_oem", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex("brands_normalized_idx").on(t.normalizedName)],
);

export const locations = sqliteTable(
  "locations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull(),
    label: text("label"),
    ...timestamps,
  },
  (t) => [uniqueIndex("locations_code_idx").on(t.code)],
);

export const suppliers = sqliteTable(
  "suppliers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    contactName: text("contact_name"),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    city: text("city"),
    notes: text("notes"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (t) => [index("suppliers_name_idx").on(t.name)],
);

export const customers = sqliteTable(
  "customers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    customerType: text("customer_type", { enum: ["PARTICULIER", "PROFESSIONNEL"] })
      .notNull()
      .default("PARTICULIER"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("customers_name_idx").on(t.name)],
);

/* -------------------------------------------------------------------------- */
/*  Parts                                                                     */
/* -------------------------------------------------------------------------- */

export const parts = sqliteTable(
  "parts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Main reference as used by the business (Référence). */
    reference: text("reference").notNull(),
    /** Normalised reference (uppercase, no separators) used for matching. */
    referenceNormalized: text("reference_normalized").notNull(),
    /** Raw reference cell as imported from Excel (may contain several refs). */
    referenceRaw: text("reference_raw"),
    designation: text("designation").notNull(),
    description: text("description"),
    brandId: integer("brand_id").references(() => brands.id, { onDelete: "set null" }),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    locationId: integer("location_id").references(() => locations.id, { onDelete: "set null" }),
    supplierId: integer("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    unit: text("unit").notNull().default("Pièce"),
    /** Prix d'achat (DA) */
    purchasePrice: real("purchase_price").notNull().default(0),
    /** Prix gros (DA) */
    wholesalePrice: real("wholesale_price").notNull().default(0),
    /** Prix détail (DA) */
    retailPrice: real("retail_price").notNull().default(0),
    /** Current quantity – always mutated through stock movements. */
    quantity: integer("quantity").notNull().default(0),
    minStock: integer("min_stock").notNull().default(0),
    barcode: text("barcode"),
    imagePath: text("image_path"),
    notes: text("notes"),
    keywords: text("keywords"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("parts_reference_idx").on(t.reference),
    index("parts_reference_norm_idx").on(t.referenceNormalized),
    index("parts_designation_idx").on(t.designation),
    index("parts_brand_idx").on(t.brandId),
    index("parts_category_idx").on(t.categoryId),
    index("parts_location_idx").on(t.locationId),
    index("parts_supplier_idx").on(t.supplierId),
    index("parts_barcode_idx").on(t.barcode),
    index("parts_quantity_idx").on(t.quantity),
    index("parts_active_idx").on(t.isActive),
  ],
);

export const partReferences = sqliteTable(
  "part_references",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    partId: integer("part_id")
      .notNull()
      .references(() => parts.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["OEM", "ALTERNATIVE", "SUPPLIER", "BARCODE"] }).notNull(),
    reference: text("reference").notNull(),
    referenceNormalized: text("reference_normalized").notNull(),
    brandId: integer("brand_id").references(() => brands.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  (t) => [
    index("part_refs_part_idx").on(t.partId),
    index("part_refs_norm_idx").on(t.referenceNormalized),
    index("part_refs_ref_idx").on(t.reference),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Vehicles & compatibility                                                  */
/* -------------------------------------------------------------------------- */

export const vehicleMakes = sqliteTable(
  "vehicle_makes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    country: text("country"),
    ...timestamps,
  },
  (t) => [uniqueIndex("vehicle_makes_norm_idx").on(t.normalizedName)],
);

export const vehicleModels = sqliteTable(
  "vehicle_models",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    makeId: integer("make_id")
      .notNull()
      .references(() => vehicleMakes.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    generation: text("generation"),
    yearFrom: integer("year_from"),
    yearTo: integer("year_to"),
    bodyType: text("body_type"),
    ...timestamps,
  },
  (t) => [index("vehicle_models_make_idx").on(t.makeId), index("vehicle_models_name_idx").on(t.name)],
);

/** A specific engine variant of a model, e.g. Clio IV 1.5 dCi 90 (K9K 608). */
export const vehicles = sqliteTable(
  "vehicles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    modelId: integer("model_id")
      .notNull()
      .references(() => vehicleModels.id, { onDelete: "cascade" }),
    engineLabel: text("engine_label").notNull(),
    displacement: text("displacement"),
    fuel: text("fuel", { enum: ["Diesel", "Essence", "GPL", "Hybride", "Électrique"] }),
    powerHp: integer("power_hp"),
    powerKw: integer("power_kw"),
    engineCode: text("engine_code"),
    yearFrom: integer("year_from"),
    yearTo: integer("year_to"),
    /** Denormalised search text: "Renault Clio IV 1.5 dCi 90 K9K 2012 2019 Diesel" */
    searchText: text("search_text").notNull().default(""),
    ...timestamps,
  },
  (t) => [
    index("vehicles_model_idx").on(t.modelId),
    index("vehicles_engine_code_idx").on(t.engineCode),
    index("vehicles_search_idx").on(t.searchText),
  ],
);

export const compatibilities = sqliteTable(
  "compatibilities",
  {
    partId: integer("part_id")
      .notNull()
      .references(() => parts.id, { onDelete: "cascade" }),
    vehicleId: integer("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    /** VERIFIED = confirmed by the business, UNVERIFIED = suggested / imported. */
    status: text("status", { enum: ["VERIFIED", "UNVERIFIED"] }).notNull().default("UNVERIFIED"),
    source: text("source"),
    note: text("note"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  (t) => [
    primaryKey({ columns: [t.partId, t.vehicleId] }),
    index("compat_vehicle_idx").on(t.vehicleId),
    index("compat_part_idx").on(t.partId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Stock movements                                                           */
/* -------------------------------------------------------------------------- */

export const MOVEMENT_TYPES = [
  "ENTREE_ACHAT",
  "SORTIE_VENTE",
  "AJUSTEMENT_POSITIF",
  "AJUSTEMENT_NEGATIF",
  "RETOUR_CLIENT",
  "RETOUR_FOURNISSEUR",
  "TRANSFERT",
  "INVENTAIRE",
  "IMPORT",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const stockMovements = sqliteTable(
  "stock_movements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    partId: integer("part_id")
      .notNull()
      .references(() => parts.id, { onDelete: "cascade" }),
    type: text("type", { enum: MOVEMENT_TYPES }).notNull(),
    /** Signed quantity: positive = stock in, negative = stock out. */
    quantity: integer("quantity").notNull(),
    previousQuantity: integer("previous_quantity").notNull(),
    newQuantity: integer("new_quantity").notNull(),
    unitCost: real("unit_cost"),
    reason: text("reason"),
    documentType: text("document_type", { enum: ["SALE", "PURCHASE", "ADJUSTMENT", "IMPORT", "TRANSFER", "RETURN"] }),
    documentId: integer("document_id"),
    documentNumber: text("document_number"),
    fromLocationId: integer("from_location_id").references(() => locations.id, { onDelete: "set null" }),
    toLocationId: integer("to_location_id").references(() => locations.id, { onDelete: "set null" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  (t) => [
    index("movements_part_idx").on(t.partId),
    index("movements_created_idx").on(t.createdAt),
    index("movements_type_idx").on(t.type),
    index("movements_document_idx").on(t.documentType, t.documentId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Sales                                                                     */
/* -------------------------------------------------------------------------- */

export const sales = sqliteTable(
  "sales",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    number: text("number").notNull(),
    status: text("status", { enum: ["BROUILLON", "CONFIRMEE", "ANNULEE"] }).notNull().default("BROUILLON"),
    customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),
    priceTier: text("price_tier", { enum: ["DETAIL", "GROS"] }).notNull().default("DETAIL"),
    paymentMethod: text("payment_method", { enum: ["ESPECES", "CARTE", "VIREMENT", "CHEQUE", "CREDIT"] })
      .notNull()
      .default("ESPECES"),
    subtotal: real("subtotal").notNull().default(0),
    discountType: text("discount_type", { enum: ["NONE", "PERCENT", "AMOUNT"] }).notNull().default("NONE"),
    discountValue: real("discount_value").notNull().default(0),
    discountAmount: real("discount_amount").notNull().default(0),
    total: real("total").notNull().default(0),
    notes: text("notes"),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    confirmedAt: text("confirmed_at"),
    cancelledAt: text("cancelled_at"),
    saleDate: text("sale_date")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("sales_number_idx").on(t.number),
    index("sales_status_idx").on(t.status),
    index("sales_date_idx").on(t.saleDate),
    index("sales_customer_idx").on(t.customerId),
  ],
);

export const saleItems = sqliteTable(
  "sale_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    saleId: integer("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    partId: integer("part_id")
      .notNull()
      .references(() => parts.id, { onDelete: "restrict" }),
    /** Snapshot of the reference/designation at the time of sale. */
    reference: text("reference").notNull(),
    designation: text("designation").notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: real("unit_price").notNull(),
    /** Purchase cost snapshot for margin reporting. */
    unitCost: real("unit_cost").notNull().default(0),
    lineTotal: real("line_total").notNull(),
  },
  (t) => [index("sale_items_sale_idx").on(t.saleId), index("sale_items_part_idx").on(t.partId)],
);

/* -------------------------------------------------------------------------- */
/*  Purchases                                                                 */
/* -------------------------------------------------------------------------- */

export const purchases = sqliteTable(
  "purchases",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    number: text("number").notNull(),
    status: text("status", { enum: ["BROUILLON", "COMMANDEE", "RECUE", "ANNULEE"] })
      .notNull()
      .default("BROUILLON"),
    supplierId: integer("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    supplierInvoiceNumber: text("supplier_invoice_number"),
    subtotal: real("subtotal").notNull().default(0),
    total: real("total").notNull().default(0),
    notes: text("notes"),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    orderedAt: text("ordered_at"),
    receivedAt: text("received_at"),
    cancelledAt: text("cancelled_at"),
    expectedAt: text("expected_at"),
    purchaseDate: text("purchase_date")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("purchases_number_idx").on(t.number),
    index("purchases_status_idx").on(t.status),
    index("purchases_date_idx").on(t.purchaseDate),
    index("purchases_supplier_idx").on(t.supplierId),
  ],
);

export const purchaseItems = sqliteTable(
  "purchase_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    purchaseId: integer("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "cascade" }),
    partId: integer("part_id")
      .notNull()
      .references(() => parts.id, { onDelete: "restrict" }),
    reference: text("reference").notNull(),
    designation: text("designation").notNull(),
    quantity: integer("quantity").notNull(),
    unitCost: real("unit_cost").notNull(),
    lineTotal: real("line_total").notNull(),
  },
  (t) => [index("purchase_items_purchase_idx").on(t.purchaseId), index("purchase_items_part_idx").on(t.partId)],
);

/* -------------------------------------------------------------------------- */
/*  Import batches (audit trail for Excel imports)                            */
/* -------------------------------------------------------------------------- */

export const importBatches = sqliteTable("import_batches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fileName: text("file_name").notNull(),
  sheetName: text("sheet_name").notNull(),
  totalRows: integer("total_rows").notNull(),
  importedRows: integer("imported_rows").notNull(),
  updatedRows: integer("updated_rows").notNull().default(0),
  skippedRows: integer("skipped_rows").notNull(),
  mapping: text("mapping").notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});

/* -------------------------------------------------------------------------- */
/*  Settings (key/value, typed at application level)                          */
/* -------------------------------------------------------------------------- */

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});

/* -------------------------------------------------------------------------- */
/*  Relations                                                                 */
/* -------------------------------------------------------------------------- */

export const partsRelations = relations(parts, ({ one, many }) => ({
  brand: one(brands, { fields: [parts.brandId], references: [brands.id] }),
  category: one(categories, { fields: [parts.categoryId], references: [categories.id] }),
  location: one(locations, { fields: [parts.locationId], references: [locations.id] }),
  supplier: one(suppliers, { fields: [parts.supplierId], references: [suppliers.id] }),
  references: many(partReferences),
  compatibilities: many(compatibilities),
  movements: many(stockMovements),
}));

export const partReferencesRelations = relations(partReferences, ({ one }) => ({
  part: one(parts, { fields: [partReferences.partId], references: [parts.id] }),
  brand: one(brands, { fields: [partReferences.brandId], references: [brands.id] }),
}));

export const vehicleMakesRelations = relations(vehicleMakes, ({ many }) => ({
  models: many(vehicleModels),
}));

export const vehicleModelsRelations = relations(vehicleModels, ({ one, many }) => ({
  make: one(vehicleMakes, { fields: [vehicleModels.makeId], references: [vehicleMakes.id] }),
  vehicles: many(vehicles),
}));

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  model: one(vehicleModels, { fields: [vehicles.modelId], references: [vehicleModels.id] }),
  compatibilities: many(compatibilities),
}));

export const compatibilitiesRelations = relations(compatibilities, ({ one }) => ({
  part: one(parts, { fields: [compatibilities.partId], references: [parts.id] }),
  vehicle: one(vehicles, { fields: [compatibilities.vehicleId], references: [vehicles.id] }),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  part: one(parts, { fields: [stockMovements.partId], references: [parts.id] }),
  user: one(users, { fields: [stockMovements.userId], references: [users.id] }),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  customer: one(customers, { fields: [sales.customerId], references: [customers.id] }),
  user: one(users, { fields: [sales.userId], references: [users.id] }),
  items: many(saleItems),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, { fields: [saleItems.saleId], references: [sales.id] }),
  part: one(parts, { fields: [saleItems.partId], references: [parts.id] }),
}));

export const purchasesRelations = relations(purchases, ({ one, many }) => ({
  supplier: one(suppliers, { fields: [purchases.supplierId], references: [suppliers.id] }),
  user: one(users, { fields: [purchases.userId], references: [users.id] }),
  items: many(purchaseItems),
}));

export const purchaseItemsRelations = relations(purchaseItems, ({ one }) => ({
  purchase: one(purchases, { fields: [purchaseItems.purchaseId], references: [purchases.id] }),
  part: one(parts, { fields: [purchaseItems.partId], references: [parts.id] }),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  parts: many(parts),
  purchases: many(purchases),
}));

/* -------------------------------------------------------------------------- */
/*  Inferred types                                                            */
/* -------------------------------------------------------------------------- */

export type User = typeof users.$inferSelect;
export type Part = typeof parts.$inferSelect;
export type NewPart = typeof parts.$inferInsert;
export type PartReference = typeof partReferences.$inferSelect;
export type Brand = typeof brands.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type VehicleMake = typeof vehicleMakes.$inferSelect;
export type VehicleModel = typeof vehicleModels.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type Compatibility = typeof compatibilities.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
export type Purchase = typeof purchases.$inferSelect;
export type PurchaseItem = typeof purchaseItems.$inferSelect;
export type ImportBatch = typeof importBatches.$inferSelect;
