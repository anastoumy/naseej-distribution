/**
 * DEV-ONLY mock catalog data for local testing.
 *
 * Disabled automatically in packaged (production) builds via `app.isPackaged`.
 * To turn off while developing, set DEV_SEED_ENABLED to false below.
 *
 * To ship to a client: delete this file and remove the `seedDevDataIfEmpty`
 * call from `database.ts` (or leave as-is — packaged builds skip it anyway).
 */
import type Database from "better-sqlite3";
import { app } from "electron";
import { syncInventoryForProduct } from "../services/inventory";

/** Set to false to skip seeding even in development. */
export const DEV_SEED_ENABLED = true;

export function isDevSeedEnabled(): boolean {
  return DEV_SEED_ENABLED && !app.isPackaged;
}

function isTableEmpty(db: Database.Database, table: string): boolean {
  const allowed = new Set([
    "categories",
    "flavors",
    "suppliers",
    "customers",
    "products",
  ]);
  if (!allowed.has(table)) {
    throw new Error(`Dev seed cannot query table: ${table}`);
  }

  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as {
    count: number;
  };
  return row.count === 0;
}

function seedFlavors(db: Database.Database): Map<string, number> {
  const names = [
    "Original",
    "Strawberry",
    "Chocolate",
    "Mint",
    "Lemon",
    "Mango",
    "Cheese",
  ];

  const insert = db.prepare("INSERT INTO flavors (name) VALUES (?)");
  const ids = new Map<string, number>();

  for (const name of names) {
    const { lastInsertRowid } = insert.run(name);
    ids.set(name, Number(lastInsertRowid));
  }

  return ids;
}

function seedCategories(db: Database.Database): Map<string, number> {
  const insert = db.prepare(
    "INSERT INTO categories (title, parent_id) VALUES (?, ?)",
  );
  const ids = new Map<string, number>();

  const roots = ["Beverages", "Snacks", "Dairy", "Household"];
  for (const title of roots) {
    const { lastInsertRowid } = insert.run(title, null);
    ids.set(title, Number(lastInsertRowid));
  }

  const children: { title: string; parent: string }[] = [
    { title: "Soft Drinks", parent: "Beverages" },
    { title: "Juices", parent: "Beverages" },
    { title: "Chips", parent: "Snacks" },
    { title: "Biscuits", parent: "Snacks" },
  ];

  for (const { title, parent } of children) {
    const { lastInsertRowid } = insert.run(title, ids.get(parent) ?? null);
    ids.set(title, Number(lastInsertRowid));
  }

  return ids;
}

function seedSuppliers(db: Database.Database): Map<string, number> {
  const rows = [
    { name: "Al-Amal Trading", phone: "+962 6 555 0101" },
    { name: "Jordan Foods Co.", phone: "+962 6 555 0202" },
    { name: "Gulf Brands Supply", phone: "+962 6 555 0303" },
  ];

  const insert = db.prepare(
    "INSERT INTO suppliers (name, phone) VALUES (?, ?)",
  );
  const ids = new Map<string, number>();

  for (const row of rows) {
    const { lastInsertRowid } = insert.run(row.name, row.phone);
    ids.set(row.name, Number(lastInsertRowid));
  }

  return ids;
}

function seedCustomers(db: Database.Database): void {
  const rows = [
    { name: "Abu Ahmad Grocery", phone: "+962 79 100 0001" },
    { name: "Al-Nour Supermarket", phone: "+962 79 100 0002" },
    { name: "City Mini Mart", phone: "+962 79 100 0003" },
    { name: "Hamza Wholesale", phone: "+962 79 100 0004" },
    { name: "Sara Corner Shop", phone: "+962 79 100 0005" },
  ];

  const insert = db.prepare(
    "INSERT INTO customers (name, phone) VALUES (?, ?)",
  );

  for (const row of rows) {
    insert.run(row.name, row.phone);
  }
}

interface ProductSeed {
  title: string;
  category: string;
  supplier: string;
  price: number;
  wholesale_price: number;
  purchase_price: number;
  taxable?: boolean;
  flavors: { name: string; price?: number }[];
}

function seedProducts(
  db: Database.Database,
  categories: Map<string, number>,
  suppliers: Map<string, number>,
  flavors: Map<string, number>,
): void {
  const products: ProductSeed[] = [
    {
      title: "Cola 330ml",
      category: "Soft Drinks",
      supplier: "Al-Amal Trading",
      price: 0.75,
      wholesale_price: 0.5,
      purchase_price: 0.4,
      flavors: [{ name: "Original" }],
    },
    {
      title: "Orange Juice 1L",
      category: "Juices",
      supplier: "Al-Amal Trading",
      price: 1.8,
      wholesale_price: 1.2,
      purchase_price: 0.95,
      flavors: [{ name: "Original" }, { name: "Mango" }],
    },
    {
      title: "Mineral Water 600ml",
      category: "Beverages",
      supplier: "Jordan Foods Co.",
      price: 0.35,
      wholesale_price: 0.22,
      purchase_price: 0.18,
      flavors: [{ name: "Original" }],
    },
    {
      title: "Energy Drink 250ml",
      category: "Soft Drinks",
      supplier: "Gulf Brands Supply",
      price: 1.25,
      wholesale_price: 0.85,
      purchase_price: 0.7,
      flavors: [{ name: "Original" }],
    },
    {
      title: "Potato Chips 50g",
      category: "Chips",
      supplier: "Jordan Foods Co.",
      price: 0.65,
      wholesale_price: 0.4,
      purchase_price: 0.32,
      flavors: [{ name: "Original" }, { name: "Cheese" }],
    },
    {
      title: "Chocolate Biscuits 12pc",
      category: "Biscuits",
      supplier: "Jordan Foods Co.",
      price: 1.1,
      wholesale_price: 0.7,
      purchase_price: 0.55,
      flavors: [{ name: "Chocolate" }, { name: "Strawberry" }],
    },
    {
      title: "Mixed Nuts 200g",
      category: "Snacks",
      supplier: "Gulf Brands Supply",
      price: 2.5,
      wholesale_price: 1.6,
      purchase_price: 1.25,
      flavors: [{ name: "Original" }],
    },
    {
      title: "Labneh 500g",
      category: "Dairy",
      supplier: "Al-Amal Trading",
      price: 1.4,
      wholesale_price: 0.95,
      purchase_price: 0.75,
      flavors: [{ name: "Original" }, { name: "Mint" }],
    },
    {
      title: "Dish Soap 750ml",
      category: "Household",
      supplier: "Gulf Brands Supply",
      price: 1.6,
      wholesale_price: 1.05,
      purchase_price: 0.85,
      flavors: [{ name: "Lemon" }, { name: "Original" }],
    },
    {
      title: "Strawberry Milk 200ml",
      category: "Dairy",
      supplier: "Jordan Foods Co.",
      price: 0.55,
      wholesale_price: 0.35,
      purchase_price: 0.28,
      flavors: [{ name: "Strawberry" }, { name: "Chocolate" }],
    },
  ];

  const insertProduct = db.prepare(`
    INSERT INTO products (
      title, category_id, supplier_id, price, wholesale_price, purchase_price, taxable
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertProductFlavor = db.prepare(
    "INSERT INTO product_flavors (product_id, flavor_id, price, wholesale_price, purchase_price) VALUES (?, ?, ?, ?, ?)",
  );

  for (const product of products) {
    const categoryId = categories.get(product.category) ?? null;
    const supplierId = suppliers.get(product.supplier) ?? null;

    const { lastInsertRowid } = insertProduct.run(
      product.title,
      categoryId,
      supplierId,
      product.price,
      product.wholesale_price,
      product.purchase_price,
      product.taxable === false ? 0 : 1,
    );

    const productId = Number(lastInsertRowid);
    const flavorIds: number[] = [];

    for (const flavor of product.flavors) {
      const flavorId = flavors.get(flavor.name);
      if (flavorId == null) continue;
      const flavorPrice = flavor.price ?? product.price;
      insertProductFlavor.run(
        productId,
        flavorId,
        flavorPrice,
        product.wholesale_price,
        product.purchase_price,
      );
      flavorIds.push(flavorId);
    }

    syncInventoryForProduct(db, productId, flavorIds);
  }
}

/** Inserts mock catalog data when core tables are empty. No-op in production builds. */
export function seedDevDataIfEmpty(db: Database.Database): void {
  if (!isDevSeedEnabled()) return;

  const needsSeed =
    isTableEmpty(db, "categories") &&
    isTableEmpty(db, "flavors") &&
    isTableEmpty(db, "suppliers") &&
    isTableEmpty(db, "customers") &&
    isTableEmpty(db, "products");

  if (!needsSeed) return;

  db.transaction(() => {
    const flavors = seedFlavors(db);
    const categories = seedCategories(db);
    const suppliers = seedSuppliers(db);
    seedCustomers(db);
    seedProducts(db, categories, suppliers, flavors);
  })();
}
