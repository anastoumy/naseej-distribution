import { join } from "path";
import { app } from "electron";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  copyFileSync,
  statSync,
} from "fs";
import { closeDb, getDb } from "./database";

const MAX_BACKUPS = 7; // Keep last 7 daily backups

/**
 * Returns the path to the backup directory.
 * Creates the directory if it doesn't exist.
 */
function getBackupDir(): string {
  const backupDir = join(app.getPath("userData"), "backups");
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }
  return backupDir;
}

/**
 * Creates a timestamped backup of the database file.
 * Uses SQLite's backup API via file copy (safe when WAL mode is enabled and no writes are in progress).
 * For better-sqlite3, we use the .backup() method if available, otherwise fall back to file copy.
 */
export function createBackup(db: import("better-sqlite3").Database): { success: boolean; path?: string; error?: string } {
  try {
    const backupDir = getBackupDir();
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, ""); // HHMMSS
    const backupFileName = `naseej-pos-backup-${dateStr}_${timeStr}.db`;
    const backupPath = join(backupDir, backupFileName);

    // Use better-sqlite3's backup API for a consistent snapshot
    db.backup(backupPath);

    // Prune old backups (keep only MAX_BACKUPS most recent)
    pruneOldBackups(backupDir);

    return { success: true, path: backupPath };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Backup failed";
    console.error("[Backup Error]", message);
    return { success: false, error: message };
  }
}

/**
 * Fallback file copy backup for environments where .backup() is unavailable.
 */
export function createBackupCopy(dbPath: string): { success: boolean; path?: string; error?: string } {
  try {
    const backupDir = getBackupDir();
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "");
    const backupFileName = `naseej-pos-backup-${dateStr}_${timeStr}.db`;
    const backupPath = join(backupDir, backupFileName);

    copyFileSync(dbPath, backupPath);
    pruneOldBackups(backupDir);

    return { success: true, path: backupPath };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Backup failed";
    console.error("[Backup Error]", message);
    return { success: false, error: message };
  }
}

/**
 * Removes oldest backup files when count exceeds MAX_BACKUPS.
 */
function pruneOldBackups(backupDir: string): void {
  const files = readdirSync(backupDir)
    .filter((f) => f.startsWith("naseej-pos-backup-") && f.endsWith(".db"))
    .sort(); // Sorted chronologically due to ISO date format

  while (files.length > MAX_BACKUPS) {
    const oldest = files.shift()!;
    try {
      unlinkSync(join(backupDir, oldest));
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Lists all existing backup files.
 */
export function listBackups(): {
  name: string;
  path: string;
  date: string;
  size_bytes: number;
}[] {
  const backupDir = getBackupDir();
  if (!existsSync(backupDir)) return [];

  return readdirSync(backupDir)
    .filter((f) => f.startsWith("naseej-pos-backup-") && f.endsWith(".db"))
    .sort()
    .reverse()
    .map((name) => {
      const path = join(backupDir, name);
      return {
        name,
        path,
        date: name.replace("naseej-pos-backup-", "").replace(".db", "").split("_")[0],
        size_bytes: statSync(path).size,
      };
    });
}

/**
 * Restores the database from a backup file.
 * Closes the active connection, replaces the DB file, and reopens.
 */
export function restoreBackup(
  backupPath: string,
): { success: boolean; error?: string } {
  try {
    if (!existsSync(backupPath)) {
      return { success: false, error: "Backup file not found" };
    }

    if (!backupPath.endsWith(".db")) {
      return { success: false, error: "Invalid backup file" };
    }

    const dbPath = join(app.getPath("userData"), "naseej.db");
    closeDb();

    for (const suffix of ["", "-wal", "-shm"]) {
      const filePath = `${dbPath}${suffix}`;
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    }

    copyFileSync(backupPath, dbPath);
    getDb();

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Restore failed";
    console.error("[Restore Error]", message);
    try {
      getDb();
    } catch {
      // Connection may remain closed until app restart.
    }
    return { success: false, error: message };
  }
}
