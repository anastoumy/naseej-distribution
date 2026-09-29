-- ============================================================
-- Naseej Lite — SQLite Schema
-- Single-tenant distributor desktop app (Electron + better-sqlite3)
-- Database file: naseej.db (stored in app data directory)
-- ============================================================

PRAGMA foreign_keys = ON;

-- ============================================================
-- Categories (hierarchical, self-referencing)
-- parent_id = NULL → top-level category
-- parent_id set → subcategory under parent
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  parent_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

-- ============================================================
-- Flavors — product variants by flavor/scent/type
-- Lightweight variant model: no size/color complexity needed.
-- A single product can have multiple flavors (see product_flavors).
-- Inventory is tracked at the (product, flavor) level.
-- ============================================================
CREATE TABLE IF NOT EXISTS flavors (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Suppliers
-- credit = outstanding balance the distributor owes this supplier
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  phone      TEXT,
  credit     REAL NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Customers
-- credit = outstanding balance this customer owes the distributor
-- payment_type is stored per-order, not per-customer, but the
-- customer record helps group debt and collection history.
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  phone      TEXT,
  credit     REAL NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- ============================================================
-- Products
-- supplier_id is stored here so that the daily purchase-order
-- generation can group all ordered items by their supplier
-- without needing to join through order_items.
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT NOT NULL,
  category_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  supplier_id     INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  price           REAL NOT NULL,
  wholesale_price REAL NOT NULL,
  fixed_tax       REAL NOT NULL DEFAULT 0,
  purchase_tax    REAL NOT NULL DEFAULT 0,
  sell_tax        REAL NOT NULL DEFAULT 0,
  image_path      TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_title    ON products(title);

-- ============================================================
-- Product Flavors — links a product to one or more flavors
-- Many-to-many junction table.  The UNIQUE constraint prevents
-- duplicate (product, flavor) pairs.
-- ============================================================
CREATE TABLE IF NOT EXISTS product_flavors (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  flavor_id  INTEGER NOT NULL REFERENCES flavors(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, flavor_id)
);

CREATE INDEX IF NOT EXISTS idx_product_flavors_product ON product_flavors(product_id);
CREATE INDEX IF NOT EXISTS idx_product_flavors_flavor  ON product_flavors(flavor_id);

-- ============================================================
-- Inventory — one row per (product, flavor) combination
-- flavor_id = NULL means the base product with no flavor variant.
-- The UNIQUE constraint ensures only one stock record per combo.
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  flavor_id  INTEGER REFERENCES flavors(id) ON DELETE SET NULL,
  quantity   REAL NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, flavor_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_flavor  ON inventory(flavor_id);

-- ============================================================
-- Orders (customer invoices)
-- status flow: draft → confirmed → partially_paid → paid
--              draft → cancelled
-- payment_type: cash = settled immediately on delivery
--               credit = added to customer.credit balance
-- total is stored as a snapshot; recalculate when items change
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id  INTEGER NOT NULL REFERENCES customers(id),
  status       TEXT NOT NULL DEFAULT 'draft'
                 CHECK(status IN ('draft','confirmed','partially_paid','paid','cancelled')),
  payment_type TEXT NOT NULL DEFAULT 'cash'
                 CHECK(payment_type IN ('cash','credit')),
  total        REAL NOT NULL DEFAULT 0,
  invoice_pdf  TEXT,
  notes        TEXT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_customer   ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- ============================================================
-- Order Items
-- deducted_qty: when items are missing on supplier delivery,
--   the distributor manually deducts them here; this quantity
--   is subtracted from the final customer invoice total.
-- tax_amount: pre-calculated line tax (sell_tax applied at entry)
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   INTEGER NOT NULL REFERENCES products(id),
  flavor_id    INTEGER REFERENCES flavors(id) ON DELETE SET NULL,
  quantity     REAL NOT NULL,
  unit_price   REAL NOT NULL,
  tax_amount   REAL NOT NULL DEFAULT 0,
  deducted_qty REAL NOT NULL DEFAULT 0,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_items_order   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- ============================================================
-- Purchases (supplier purchase orders — auto-generated daily)
-- Generated at end of day by grouping all confirmed order items
-- by their product.supplier_id.
-- status flow: pending → received
--              pending → partially_received → received
--              pending → cancelled
-- ============================================================
CREATE TABLE IF NOT EXISTS purchases (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK(status IN ('pending','received','partially_received','cancelled')),
  total       REAL NOT NULL DEFAULT 0,
  invoice_pdf TEXT,
  notes       TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchases_supplier   ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status     ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at);

-- ============================================================
-- Purchase Items
-- received_qty: actual quantity that arrived from the supplier.
--   If received_qty < quantity, the shortage should trigger
--   deductions on the corresponding customer order_items.
-- ============================================================
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

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product  ON purchase_items(product_id);

-- ============================================================
-- Debt Collections (cash received from customers against credit)
-- When a customer pays off part or all of their outstanding
-- balance, insert a row here and decrement customers.credit.
-- ============================================================
CREATE TABLE IF NOT EXISTS debt_collections (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  amount      REAL NOT NULL,
  notes       TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_debt_collections_customer ON debt_collections(customer_id);
CREATE INDEX IF NOT EXISTS idx_debt_collections_date     ON debt_collections(created_at);

-- ============================================================
-- Debt Repayments (cash paid to suppliers against distributor credit)
-- When the distributor pays a supplier, insert a row here and
-- decrement suppliers.credit.
-- ============================================================
CREATE TABLE IF NOT EXISTS debt_repayments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  amount      REAL NOT NULL,
  notes       TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_debt_repayments_supplier ON debt_repayments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_debt_repayments_date     ON debt_repayments(created_at);

-- ============================================================
-- Settings — key/value store for app configuration
-- Examples:
--   ('currency',       'SAR')
--   ('tax_default',    '0.15')
--   ('company_name',   'Naseej Distribution')
--   ('invoice_header', '...')
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
