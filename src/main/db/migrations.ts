import type Database from "better-sqlite3";
import { backfillInventoryRows } from "../services/inventory";
import { seedDefaultSettings } from "../services/settings";

interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

const migrations: Migration[] = [
  // Future migrations go here:
  // { version: 2, name: "add_barcode_to_products", up: (db) => db.exec("ALTER TABLE products ADD COLUMN barcode TEXT") },
  {
    version: 1,
    name: "add_price_to_product_flavors",
    up: (db) => {
      const columns = db.prepare("PRAGMA table_info(product_flavors)").all() as { name: string }[];
      if (!columns.some((column) => column.name === "price")) {
        db.exec("ALTER TABLE product_flavors ADD COLUMN price REAL NOT NULL DEFAULT 0");
      }

      db.exec(`
        UPDATE product_flavors
        SET price = COALESCE((SELECT price FROM products WHERE products.id = product_flavors.product_id), 0)
      `);
    },
  },
  {
    version: 2,
    name: "add_amount_paid_to_orders",
    up: (db) => {
      const columns = db.prepare("PRAGMA table_info(orders)").all() as { name: string }[];
      if (!columns.some((column) => column.name === "amount_paid")) {
        db.exec("ALTER TABLE orders ADD COLUMN amount_paid REAL NOT NULL DEFAULT 0");
      }
    },
  },
  {
    version: 3,
    name: "purchase_sync_pipeline",
    up: (db) => {
      const purchaseColumns = db.prepare("PRAGMA table_info(purchases)").all() as {
        name: string;
      }[];
      if (!purchaseColumns.some((column) => column.name === "submitted_at")) {
        db.exec("ALTER TABLE purchases ADD COLUMN submitted_at DATETIME");
      }

      const orderItemColumns = db.prepare("PRAGMA table_info(order_items)").all() as {
        name: string;
      }[];
      if (!orderItemColumns.some((column) => column.name === "fulfilled_to_purchase")) {
        db.exec(
          "ALTER TABLE order_items ADD COLUMN fulfilled_to_purchase INTEGER NOT NULL DEFAULT 0",
        );
      }

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_purchases_supplier_open
          ON purchases(supplier_id, status)
          WHERE submitted_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_purchase_items_product_flavor
          ON purchase_items(product_id, flavor_id);
        CREATE INDEX IF NOT EXISTS idx_order_items_fulfilled
          ON order_items(order_id, fulfilled_to_purchase);
      `);
    },
  },
  {
    version: 4,
    name: "add_discount_total_to_orders",
    up: (db) => {
      const columns = db.prepare("PRAGMA table_info(orders)").all() as { name: string }[];
      if (!columns.some((column) => column.name === "discount_total")) {
        db.exec("ALTER TABLE orders ADD COLUMN discount_total REAL NOT NULL DEFAULT 0");
      }
    },
  },
  {
    version: 5,
    name: "backfill_inventory_rows",
    up: (db) => {
      backfillInventoryRows(db);
    },
  },
  {
    version: 6,
    name: "seed_default_settings",
    up: (db) => {
      seedDefaultSettings(db);
    },
  },
  {
    version: 7,
    name: "debt_payment_hardening",
    up: (db) => {
      const orderColumns = db.prepare("PRAGMA table_info(orders)").all() as {
        name: string;
      }[];
      if (!orderColumns.some((column) => column.name === "credit_applied")) {
        db.exec(
          "ALTER TABLE orders ADD COLUMN credit_applied REAL NOT NULL DEFAULT 0",
        );
      }

      const collectionColumns = db
        .prepare("PRAGMA table_info(debt_collections)")
        .all() as { name: string }[];
      if (!collectionColumns.some((column) => column.name === "order_id")) {
        db.exec(
          "ALTER TABLE debt_collections ADD COLUMN order_id INTEGER REFERENCES orders(id)",
        );
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_debt_col_order
            ON debt_collections(order_id)
            WHERE order_id IS NOT NULL
        `);
      }
    },
  },
  {
    version: 8,
    name: "add_order_fulfillment_status",
    up: (db) => {
      const columns = db.prepare("PRAGMA table_info(orders)").all() as {
        name: string;
      }[];
      if (!columns.some((column) => column.name === "fulfillment_status")) {
        db.exec(`
          ALTER TABLE orders ADD COLUMN fulfillment_status TEXT NOT NULL DEFAULT 'pending'
            CHECK(fulfillment_status IN (
              'pending',
              'ordered',
              'partially_in_inventory',
              'in_inventory',
              'delivered',
              'cancelled'
            ))
        `);
      }

      db.exec(`
        UPDATE orders
        SET fulfillment_status = 'cancelled'
        WHERE status = 'cancelled'
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status
          ON orders(fulfillment_status)
      `);
    },
  },
  {
    version: 9,
    name: "align_order_fulfillment_with_purchases",
    up: (db) => {
      const columns = db.prepare("PRAGMA table_info(orders)").all() as {
        name: string;
      }[];
      if (!columns.some((column) => column.name === "fulfillment_status")) {
        return;
      }

      const hasCreditApplied = columns.some((column) => column.name === "credit_applied");

      db.exec("PRAGMA foreign_keys=OFF");

      db.exec(`
        CREATE TABLE orders_fulfillment_migration (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_id  INTEGER NOT NULL REFERENCES customers(id),
          status       TEXT NOT NULL DEFAULT 'draft'
                         CHECK(status IN ('draft','confirmed','partially_paid','paid','cancelled')),
          payment_type TEXT NOT NULL DEFAULT 'cash'
                         CHECK(payment_type IN ('cash','credit')),
          total          REAL NOT NULL DEFAULT 0,
          amount_paid    REAL NOT NULL DEFAULT 0,
          discount_total REAL NOT NULL DEFAULT 0,
          credit_applied REAL NOT NULL DEFAULT 0,
          invoice_pdf    TEXT,
          notes          TEXT,
          fulfillment_status TEXT NOT NULL DEFAULT 'pending'
                             CHECK(fulfillment_status IN (
                               'pending',
                               'partially_received',
                               'received',
                               'delivered',
                               'cancelled'
                             )),
          created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      if (hasCreditApplied) {
        db.exec(`
          INSERT INTO orders_fulfillment_migration (
            id, customer_id, status, payment_type, total, amount_paid, discount_total,
            credit_applied, invoice_pdf, notes, fulfillment_status, created_at
          )
          SELECT
            id, customer_id, status, payment_type, total, amount_paid, discount_total,
            credit_applied, invoice_pdf, notes,
            CASE fulfillment_status
              WHEN 'ordered' THEN 'pending'
              WHEN 'partially_in_inventory' THEN 'partially_received'
              WHEN 'in_inventory' THEN 'received'
              WHEN 'delivered' THEN 'delivered'
              WHEN 'cancelled' THEN 'cancelled'
              WHEN 'partially_received' THEN 'partially_received'
              WHEN 'received' THEN 'received'
              ELSE 'pending'
            END,
            created_at
          FROM orders
        `);
      } else {
        db.exec(`
          INSERT INTO orders_fulfillment_migration (
            id, customer_id, status, payment_type, total, amount_paid, discount_total,
            invoice_pdf, notes, fulfillment_status, created_at
          )
          SELECT
            id, customer_id, status, payment_type, total, amount_paid, discount_total,
            invoice_pdf, notes,
            CASE fulfillment_status
              WHEN 'ordered' THEN 'pending'
              WHEN 'partially_in_inventory' THEN 'partially_received'
              WHEN 'in_inventory' THEN 'received'
              WHEN 'delivered' THEN 'delivered'
              WHEN 'cancelled' THEN 'cancelled'
              WHEN 'partially_received' THEN 'partially_received'
              WHEN 'received' THEN 'received'
              ELSE 'pending'
            END,
            created_at
          FROM orders
        `);
      }

      db.exec("DROP TABLE orders");
      db.exec("ALTER TABLE orders_fulfillment_migration RENAME TO orders");

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_orders_customer           ON orders(customer_id);
        CREATE INDEX IF NOT EXISTS idx_orders_status             ON orders(status);
        CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON orders(fulfillment_status);
        CREATE INDEX IF NOT EXISTS idx_orders_date               ON orders(created_at);
      `);

      db.exec("PRAGMA foreign_keys=ON");
    },
  },
  {
    version: 10,
    name: "add_inventory_allocated_to_order_items",
    up: (db) => {
      const columns = db.prepare("PRAGMA table_info(order_items)").all() as {
        name: string;
      }[];
      if (!columns.some((column) => column.name === "inventory_allocated")) {
        db.exec(
          "ALTER TABLE order_items ADD COLUMN inventory_allocated REAL NOT NULL DEFAULT 0",
        );
      }
    },
  },
  {
    version: 11,
    name: "default_tax_five_percent",
    up: (db) => {
      const row = db
        .prepare("SELECT value FROM settings WHERE key = 'default_tax'")
        .get() as { value: string } | undefined;

      if (!row) {
        db.prepare(
          "INSERT INTO settings (key, value) VALUES ('default_tax', '0.05')",
        ).run();
      } else if (row.value === "0") {
        db.prepare(
          "UPDATE settings SET value = '0.05', updated_at = CURRENT_TIMESTAMP WHERE key = 'default_tax'",
        ).run();
      }
    },
  },
  {
    version: 12,
    name: "product_purchase_price_and_taxable",
    up: (db) => {
      const columns = db.prepare("PRAGMA table_info(products)").all() as {
        name: string;
      }[];

      if (!columns.some((column) => column.name === "purchase_price")) {
        db.exec(
          "ALTER TABLE products ADD COLUMN purchase_price REAL NOT NULL DEFAULT 0",
        );
      }
      if (!columns.some((column) => column.name === "taxable")) {
        db.exec(
          "ALTER TABLE products ADD COLUMN taxable INTEGER NOT NULL DEFAULT 1",
        );
      }

      db.exec(`
        UPDATE products
        SET purchase_price = wholesale_price
        WHERE purchase_price = 0
      `);
    },
  },
  {
    version: 13,
    name: "product_flavor_wholesale_and_purchase_prices",
    up: (db) => {
      const columns = db.prepare("PRAGMA table_info(product_flavors)").all() as {
        name: string;
      }[];

      if (!columns.some((column) => column.name === "wholesale_price")) {
        db.exec(
          "ALTER TABLE product_flavors ADD COLUMN wholesale_price REAL NOT NULL DEFAULT 0",
        );
      }
      if (!columns.some((column) => column.name === "purchase_price")) {
        db.exec(
          "ALTER TABLE product_flavors ADD COLUMN purchase_price REAL NOT NULL DEFAULT 0",
        );
      }

      db.exec(`
        UPDATE product_flavors
        SET wholesale_price = COALESCE(
          (SELECT wholesale_price FROM products WHERE products.id = product_flavors.product_id),
          0
        )
        WHERE wholesale_price = 0
      `);
      db.exec(`
        UPDATE product_flavors
        SET purchase_price = COALESCE(
          (SELECT purchase_price FROM products WHERE products.id = product_flavors.product_id),
          0
        )
        WHERE purchase_price = 0
      `);
    },
  },
  {
    version: 14,
    name: "debt_opening_balance_adjustments",
    up: (db) => {
      db.exec(`
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

        CREATE INDEX IF NOT EXISTS idx_customer_debt_adj
          ON customer_debt_adjustments(customer_id);
        CREATE INDEX IF NOT EXISTS idx_supplier_debt_adj
          ON supplier_debt_adjustments(supplier_id);
      `);
    },
  },
  {
    version: 15,
    name: "default_currency_omr",
    up: (db) => {
      db.prepare(
        `
          UPDATE settings
          SET value = 'OMR', updated_at = CURRENT_TIMESTAMP
          WHERE key = 'currency_symbol' AND value IN ('JD', 'JOD')
        `,
      ).run();

      const row = db
        .prepare("SELECT value FROM settings WHERE key = 'currency_symbol'")
        .get() as { value: string } | undefined;

      if (!row) {
        db.prepare(
          "INSERT INTO settings (key, value) VALUES ('currency_symbol', 'OMR')",
        ).run();
      }
    },
  },
];

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const { v: current } = db.prepare(
    "SELECT COALESCE(MAX(version), 0) as v FROM schema_version"
  ).get() as { v: number };

  for (const m of migrations) {
    if (m.version > current) {
      db.transaction(() => {
        m.up(db);
        db.prepare("INSERT INTO schema_version (version, name) VALUES (?, ?)").run(
          m.version,
          m.name
        );
      })();
    }
  }
}
