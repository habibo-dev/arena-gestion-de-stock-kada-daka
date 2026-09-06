import "server-only";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { ensureSearchIndex } from "./search-index";
import { seedIfEmpty } from "./seed-runner";

export type DB = BetterSQLite3Database<typeof schema>;

type GlobalWithDb = typeof globalThis & {
  __autostock_db?: { sqlite: Database.Database; db: DB };
};

function resolveDatabasePath(): string {
  const configured = process.env.DATABASE_PATH ?? "./data/autostock.db";
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

function open(): { sqlite: Database.Database; db: DB } {
  const dbPath = resolveDatabasePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("synchronous = NORMAL");

  const db = drizzle(sqlite, { schema });

  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  ensureSearchIndex(sqlite);
  seedIfEmpty(db, sqlite);

  return { sqlite, db };
}

/**
 * Lazily-initialised singleton. Cached on globalThis so that Next.js dev
 * hot-reloads do not open a new connection on every module evaluation.
 */
export function getDb(): DB {
  const g = globalThis as GlobalWithDb;
  if (!g.__autostock_db) g.__autostock_db = open();
  return g.__autostock_db.db;
}

export function getSqlite(): Database.Database {
  const g = globalThis as GlobalWithDb;
  if (!g.__autostock_db) g.__autostock_db = open();
  return g.__autostock_db.sqlite;
}

export { schema };
