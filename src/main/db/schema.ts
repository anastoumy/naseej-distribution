import type Database from "better-sqlite3";

/** Creates all distributor tables. Idempotent — safe to call on every launch. */
export function runSchemaTables(db: Database.Database): void {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    -- Categories (hierarchical, self-referencing)
    CREATE TABLE IF NOT EXISTS categories (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT NOT NULL,
      parent_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Flavors — product variants by flavor/scent/type
    CREATE TABLE IF NOT EXISTS flavors (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Suppliers
    CREATE TABLE IF NOT EXISTS suppliers (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      phone      TEXT,
      credit     REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Customers
    CREATE TABLE IF NOT EXISTS customers (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      phone      TEXT,
      credit     REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Products
    CREATE TABLE IF NOT EXISTS products (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      title           TEXT NOT NULL,
      category_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      supplier_id     INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
      price           REAL NOT NULL DEFAULT 0,
      wholesale_price REAL NOT NULL DEFAULT 0,
      purchase_price  REAL NOT NULL DEFAULT 0,
      taxable         INTEGER NOT NULL DEFAULT 1,
      fixed_tax       REAL NOT NULL DEFAULT 0,
      purchase_tax    REAL NOT NULL DEFAULT 0,
      sell_tax        REAL NOT NULL DEFAULT 0,
      image_path      TEXT,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Product Flavors — many-to-many junction
    CREATE TABLE IF NOT EXISTS product_flavors (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      flavor_id        INTEGER NOT NULL REFERENCES flavors(id) ON DELETE CASCADE,
      price            REAL NOT NULL DEFAULT 0,
      wholesale_price  REAL NOT NULL DEFAULT 0,
      purchase_price   REAL NOT NULL DEFAULT 0,
      created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(product_id, flavor_id)
    );

    -- Inventory — one row per (product, flavor)
    CREATE TABLE IF NOT EXISTS inventory (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      flavor_id  INTEGER REFERENCES flavors(id) ON DELETE SET NULL,
      quantity   REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(product_id, flavor_id)
    );

    -- Orders (customer invoices)
    CREATE TABLE IF NOT EXISTS orders (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id  INTEGER NOT NULL REFERENCES customers(id),
      status       TEXT NOT NULL DEFAULT 'draft'
                     CHECK(status IN ('draft','confirmed','partially_paid','paid','cancelled')),
      payment_type TEXT NOT NULL DEFAULT 'cash'
                     CHECK(payment_type IN ('cash','credit')),
      total          REAL NOT NULL DEFAULT 0,
      amount_paid    REAL NOT NULL DEFAULT 0,
      discount_total REAL NOT NULL DEFAULT 0,
      invoice_pdf    TEXT,
      notes              TEXT,
      fulfillment_status TEXT NOT NULL DEFAULT 'pending'
                           CHECK(fulfillment_status IN (
                             'pending',
                             'partially_received',
                             'received',
                             'delivered',
                             'cancelled'
                           )),
      created_at         DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Order Items
    CREATE TABLE IF NOT EXISTS order_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id   INTEGER NOT NULL REFERENCES products(id),
      flavor_id    INTEGER REFERENCES flavors(id) ON DELETE SET NULL,
      quantity     REAL NOT NULL,
      unit_price   REAL NOT NULL,
      tax_amount   REAL NOT NULL DEFAULT 0,
      deducted_qty            REAL NOT NULL DEFAULT 0,
      fulfilled_to_purchase   INTEGER NOT NULL DEFAULT 0,
      inventory_allocated     REAL NOT NULL DEFAULT 0,
      created_at              DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Purchases (supplier purchase orders)
    CREATE TABLE IF NOT EXISTS purchases (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id  INTEGER NOT NULL REFERENCES suppliers(id),
      status       TEXT NOT NULL DEFAULT 'pending'
                     CHECK(status IN ('pending','received','partially_received','cancelled')),
      total        REAL NOT NULL DEFAULT 0,
      invoice_pdf  TEXT,
      notes        TEXT,
      submitted_at DATETIME,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Purchase Items
    CREATE TABLE IF NOT EXISTS purchase_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id  INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      product_id   INTEGER NOT NULL REFERENCES products(id),
      flavor_id    INTEGER REFERENCES flavors(id) ON DELETE SET NULL,
      quantity     REAL NOT NULL,
      unit_cost    REAL NOT NULL,
      received_qty REAL NOT NULL DEFAULT 0,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Debt Collections (cash received from customers)
    CREATE TABLE IF NOT EXISTS debt_collections (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      amount      REAL NOT NULL,
      notes       TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Debt Repayments (cash paid to suppliers)
    CREATE TABLE IF NOT EXISTS debt_repayments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      amount      REAL NOT NULL,
      notes       TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Opening balances / manual debt adjustments (pre-system history)
    CREATE TABLE IF NOT EXISTS customer_debt_adjustments (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id    INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      amount         REAL NOT NULL,
      notes          TEXT,
      effective_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS supplier_debt_adjustments (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id    INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      amount         REAL NOT NULL,
      notes          TEXT,
      effective_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Settings
    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

/** Creates performance indexes. Run after migrations so new columns exist on upgraded DBs. */
export function runSchemaIndexes(db: Database.Database): void {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_categories_parent    ON categories(parent_id);
    CREATE INDEX IF NOT EXISTS idx_products_supplier    ON products(supplier_id);
    CREATE INDEX IF NOT EXISTS idx_products_category    ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_title       ON products(title);
    CREATE INDEX IF NOT EXISTS idx_product_flavors_prod ON product_flavors(product_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_product    ON inventory(product_id);
    CREATE INDEX IF NOT EXISTS idx_orders_customer      ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status              ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status  ON orders(fulfillment_status);
    CREATE INDEX IF NOT EXISTS idx_orders_date                ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_order_items_order    ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_purchases_supplier   ON purchases(supplier_id);
    CREATE INDEX IF NOT EXISTS idx_purchases_supplier_open ON purchases(supplier_id, status);
    CREATE INDEX IF NOT EXISTS idx_purchase_items_po    ON purchase_items(purchase_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_items_product_flavor ON purchase_items(product_id, flavor_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_fulfilled ON order_items(order_id, fulfilled_to_purchase);
    CREATE INDEX IF NOT EXISTS idx_debt_col_customer    ON debt_collections(customer_id);
    CREATE INDEX IF NOT EXISTS idx_debt_rep_supplier    ON debt_repayments(supplier_id);
    CREATE INDEX IF NOT EXISTS idx_customer_debt_adj    ON customer_debt_adjustments(customer_id);
    CREATE INDEX IF NOT EXISTS idx_supplier_debt_adj    ON supplier_debt_adjustments(supplier_id);
  `);
}

/** Creates tables and indexes. Prefer runSchemaTables → runMigrations → runSchemaIndexes for production. */
export function runSchema(db: Database.Database): void {
  runSchemaTables(db);
  runSchemaIndexes(db);
}
