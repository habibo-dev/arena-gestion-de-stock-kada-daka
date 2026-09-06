import type Database from "better-sqlite3";

/**
 * Full-text search index for parts.
 *
 * We use an FTS5 *external content* table with the trigram tokenizer so that
 * partial matches ("0986", "plaq", "dci") are found efficiently even with
 * tens of thousands of rows. The index is kept in sync by triggers, and the
 * `part_search_documents` view assembles the searchable document for a part:
 * main reference, all alternative/OEM references, designation, brand,
 * category, location, keywords and compatible-vehicle text.
 */
export function ensureSearchIndex(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE VIEW IF NOT EXISTS part_search_documents AS
    SELECT
      p.id AS part_id,
      p.reference || ' ' || p.reference_normalized AS ref_text,
      COALESCE((SELECT group_concat(r.reference || ' ' || r.reference_normalized, ' ')
                FROM part_references r WHERE r.part_id = p.id), '') AS alt_ref_text,
      p.designation || ' ' || COALESCE(p.description, '') || ' ' || COALESCE(p.keywords, '') AS desc_text,
      COALESCE(b.name, '') AS brand_text,
      COALESCE(c.name, '') AS category_text,
      COALESCE(l.code, '') || ' ' || COALESCE(l.label, '') AS location_text,
      COALESCE(p.barcode, '') AS barcode_text,
      COALESCE((SELECT group_concat(v.search_text, ' | ')
                FROM compatibilities cp JOIN vehicles v ON v.id = cp.vehicle_id
                WHERE cp.part_id = p.id), '') AS vehicle_text
    FROM parts p
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN locations l ON l.id = p.location_id;

    CREATE VIRTUAL TABLE IF NOT EXISTS parts_fts USING fts5(
      part_id UNINDEXED,
      ref_text, alt_ref_text, desc_text, brand_text, category_text,
      location_text, barcode_text, vehicle_text,
      tokenize = "trigram case_sensitive 0"
    );
  `);

  const fnExists = (name: string) =>
    (sqlite.prepare(`SELECT 1 FROM sqlite_master WHERE type='trigger' AND name=?`).get(name) as unknown) != null;

  if (!fnExists("parts_fts_ai")) {
    sqlite.exec(`
      CREATE TRIGGER parts_fts_ai AFTER INSERT ON parts BEGIN
        INSERT INTO parts_fts(part_id, ref_text, alt_ref_text, desc_text, brand_text, category_text, location_text, barcode_text, vehicle_text)
        SELECT part_id, ref_text, alt_ref_text, desc_text, brand_text, category_text, location_text, barcode_text, vehicle_text
        FROM part_search_documents WHERE part_id = NEW.id;
      END;
      CREATE TRIGGER parts_fts_ad AFTER DELETE ON parts BEGIN
        DELETE FROM parts_fts WHERE part_id = OLD.id;
      END;
      CREATE TRIGGER parts_fts_au AFTER UPDATE ON parts BEGIN
        DELETE FROM parts_fts WHERE part_id = OLD.id;
        INSERT INTO parts_fts(part_id, ref_text, alt_ref_text, desc_text, brand_text, category_text, location_text, barcode_text, vehicle_text)
        SELECT part_id, ref_text, alt_ref_text, desc_text, brand_text, category_text, location_text, barcode_text, vehicle_text
        FROM part_search_documents WHERE part_id = NEW.id;
      END;

      CREATE TRIGGER part_refs_fts_ai AFTER INSERT ON part_references BEGIN
        DELETE FROM parts_fts WHERE part_id = NEW.part_id;
        INSERT INTO parts_fts(part_id, ref_text, alt_ref_text, desc_text, brand_text, category_text, location_text, barcode_text, vehicle_text)
        SELECT part_id, ref_text, alt_ref_text, desc_text, brand_text, category_text, location_text, barcode_text, vehicle_text
        FROM part_search_documents WHERE part_id = NEW.part_id;
      END;
      CREATE TRIGGER part_refs_fts_ad AFTER DELETE ON part_references BEGIN
        DELETE FROM parts_fts WHERE part_id = OLD.part_id;
        INSERT INTO parts_fts(part_id, ref_text, alt_ref_text, desc_text, brand_text, category_text, location_text, barcode_text, vehicle_text)
        SELECT part_id, ref_text, alt_ref_text, desc_text, brand_text, category_text, location_text, barcode_text, vehicle_text
        FROM part_search_documents WHERE part_id = OLD.part_id;
      END;
      CREATE TRIGGER part_refs_fts_au AFTER UPDATE ON part_references BEGIN
        DELETE FROM parts_fts WHERE part_id = NEW.part_id;
        INSERT INTO parts_fts(part_id, ref_text, alt_ref_text, desc_text, brand_text, category_text, location_text, barcode_text, vehicle_text)
        SELECT part_id, ref_text, alt_ref_text, desc_text, brand_text, category_text, location_text, barcode_text, vehicle_text
        FROM part_search_documents WHERE part_id = NEW.part_id;
      END;

      CREATE TRIGGER compat_fts_ai AFTER INSERT ON compatibilities BEGIN
        DELETE FROM parts_fts WHERE part_id = NEW.part_id;
        INSERT INTO parts_fts(part_id, ref_text, alt_ref_text, desc_text, brand_text, category_text, location_text, barcode_text, vehicle_text)
        SELECT part_id, ref_text, alt_ref_text, desc_text, brand_text, category_text, location_text, barcode_text, vehicle_text
        FROM part_search_documents WHERE part_id = NEW.part_id;
      END;
      CREATE TRIGGER compat_fts_ad AFTER DELETE ON compatibilities BEGIN
        DELETE FROM parts_fts WHERE part_id = OLD.part_id;
        INSERT INTO parts_fts(part_id, ref_text, alt_ref_text, desc_text, brand_text, category_text, location_text, barcode_text, vehicle_text)
        SELECT part_id, ref_text, alt_ref_text, desc_text, brand_text, category_text, location_text, barcode_text, vehicle_text
        FROM part_search_documents WHERE part_id = OLD.part_id;
      END;
    `);
  }
}

/** Rebuild the whole FTS index (used after bulk operations such as seeding or imports). */
export function rebuildSearchIndex(sqlite: Database.Database): void {
  sqlite.exec(`
    DELETE FROM parts_fts;
    INSERT INTO parts_fts(part_id, ref_text, alt_ref_text, desc_text, brand_text, category_text, location_text, barcode_text, vehicle_text)
    SELECT part_id, ref_text, alt_ref_text, desc_text, brand_text, category_text, location_text, barcode_text, vehicle_text
    FROM part_search_documents;
  `);
}

/** Re-index a single part after brand/category/location/vehicle changes that the triggers don't cover. */
export function reindexPart(sqlite: Database.Database, partId: number): void {
  sqlite
    .prepare(
      `DELETE FROM parts_fts WHERE part_id = ?`,
    )
    .run(partId);
  sqlite
    .prepare(
      `INSERT INTO parts_fts(part_id, ref_text, alt_ref_text, desc_text, brand_text, category_text, location_text, barcode_text, vehicle_text)
       SELECT part_id, ref_text, alt_ref_text, desc_text, brand_text, category_text, location_text, barcode_text, vehicle_text
       FROM part_search_documents WHERE part_id = ?`,
    )
    .run(partId);
}
