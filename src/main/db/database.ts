import BetterSqlite3 from "better-sqlite3";
import { join } from "path";
import { app } from "electron";
import { runSchemaTables, runSchemaIndexes } from "./schema";
import { runMigrations } from "./migrations";
import { seedDevDataIfEmpty } from "./devSeed";

let _db: BetterSqlite3.Database | null = null;

function configureConnection(db: BetterSqlite3.Database): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");
}

/** Creates an in-memory database for tests or IPC integration harnesses. */
export function initTestDatabase(): BetterSqlite3.Database {
  if (_db) {
    _db.close();
    _db = null;
  }

  const db = new BetterSqlite3(":memory:");
  db.pragma("foreign_keys = ON");
  runSchemaTables(db);
  runMigrations(db);
  runSchemaIndexes(db);
  _db = db;
  return db;
}

export function setDb(db: BetterSqlite3.Database | null): void {
  _db = db;
}

export function resetDatabase(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

/** Returns the singleton database connection, creating it on first call. */
export function getDb(): BetterSqlite3.Database {
  if (_db) return _db;

  const dbPath = join(app.getPath("userData"), "naseej.db");
  _db = new BetterSqlite3(dbPath);
  configureConnection(_db);
  runSchemaTables(_db);
  runMigrations(_db);
  runSchemaIndexes(_db);
  seedDevDataIfEmpty(_db);

  return _db;
}

/** Closes the database connection cleanly on app quit. */
export function closeDb(): void {
  resetDatabase();
}
