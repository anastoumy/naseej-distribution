import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runMigrations } from "../src/main/db/migrations";
import { runSchema } from "../src/main/db/schema";
import { seedDevDataIfEmpty } from "../src/main/db/devSeed";

vi.mock("electron", () => ({
  app: { isPackaged: false },
}));

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runSchema(db);
  runMigrations(db);
  return db;
}

describe("devSeed", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db?.close();
  });

  it("seeds catalog data when all core tables are empty", () => {
    seedDevDataIfEmpty(db);

    expect(
      (db.prepare("SELECT COUNT(*) AS count FROM categories").get() as { count: number })
        .count,
    ).toBeGreaterThan(0);
    expect(
      (db.prepare("SELECT COUNT(*) AS count FROM flavors").get() as { count: number }).count,
    ).toBe(7);
    expect(
      (db.prepare("SELECT COUNT(*) AS count FROM suppliers").get() as { count: number })
        .count,
    ).toBe(3);
    expect(
      (db.prepare("SELECT COUNT(*) AS count FROM customers").get() as { count: number })
        .count,
    ).toBe(5);
    expect(
      (db.prepare("SELECT COUNT(*) AS count FROM products").get() as { count: number }).count,
    ).toBe(10);
  });

  it("does not seed when any catalog data already exists", () => {
    db.prepare("INSERT INTO flavors (name) VALUES ('Existing')").run();

    seedDevDataIfEmpty(db);

    expect(
      (db.prepare("SELECT COUNT(*) AS count FROM flavors").get() as { count: number }).count,
    ).toBe(1);
    expect(
      (db.prepare("SELECT COUNT(*) AS count FROM products").get() as { count: number }).count,
    ).toBe(0);
  });
});
