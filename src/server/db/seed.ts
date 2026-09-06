/**
 * CLI entry point: `npm run db:seed` / `npm run db:reset`
 *
 * Re-creates the SQLite database file with demo data. Kept separate from the
 * Next.js runtime (which auto-seeds only when the database is empty).
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { ensureSearchIndex } from "./search-index";
import { runSeed } from "./seed-runner";

const reset = process.argv.includes("--reset");
const configured = process.env.DATABASE_PATH ?? "./data/autostock.db";
const dbPath = path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);

if (reset) {
  for (const suffix of ["", "-wal", "-shm"]) {
    if (fs.existsSync(dbPath + suffix)) fs.unlinkSync(dbPath + suffix);
  }
  console.log(`Base supprimée : ${dbPath}`);
}

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });
migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
ensureSearchIndex(sqlite);

const users = sqlite.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number };
if (users.c > 0 && !reset) {
  console.log("La base contient déjà des données. Utilisez `npm run db:reset` pour repartir de zéro.");
  process.exit(0);
}

const t0 = Date.now();
runSeed(db, sqlite);
const stats = {
  pieces: (sqlite.prepare("SELECT COUNT(*) AS c FROM parts").get() as { c: number }).c,
  references: (sqlite.prepare("SELECT COUNT(*) AS c FROM part_references").get() as { c: number }).c,
  vehicules: (sqlite.prepare("SELECT COUNT(*) AS c FROM vehicles").get() as { c: number }).c,
  compatibilites: (sqlite.prepare("SELECT COUNT(*) AS c FROM compatibilities").get() as { c: number }).c,
  mouvements: (sqlite.prepare("SELECT COUNT(*) AS c FROM stock_movements").get() as { c: number }).c,
  ventes: (sqlite.prepare("SELECT COUNT(*) AS c FROM sales").get() as { c: number }).c,
  achats: (sqlite.prepare("SELECT COUNT(*) AS c FROM purchases").get() as { c: number }).c,
};
console.log(`Données de démonstration créées en ${Date.now() - t0} ms :`, stats);
sqlite.close();
