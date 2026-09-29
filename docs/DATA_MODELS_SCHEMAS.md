# Data Models & Schemas

## Naseej Lite — SQLite Database Schema

**Database:** SQLite 3 via `better-sqlite3`  
**ORM:** None — direct SQL with parameterized queries  
**Location:** `naseej.db` (stored in Electron app-data directory)  
**Schema source:** [`docs/schema.sql`](schema.sql) — loaded idempotently at startup  
**Backup:** Automatic backup on daily close

---

## 1. Database Initialization

```typescript
// src/main/db/database.ts
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const dbPath = path.join(app.getPath('userData'), 'naseej.db');
    _db = new Database(dbPath);
    _db.pragma('foreign_keys = ON');
    _db.pragma('journal_mode = WAL');   // write-ahead logging for safety
    const schema = fs.readFileSync(
      path.join(__dirname, '../../docs/schema.sql'),
      'utf-8'
    );
    _db.exec(schema);
  }
  return _db;
}

export function closeDb(): void {
  _db?.close();
  _db = null;
}
```

---

## 2. Table Definitions

The canonical DDL lives in [`docs/schema.sql`](schema.sql). The sections below provide
narrative descriptions, relationship diagrams, and query examples for each table.

---

### 2.1 Categories

Hierarchical product categories. `parent_id = NULL` means a top-level category.

```sql
CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  parent_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Notes:**
- Self-referencing FK allows unlimited nesting depth.
- On delete, the child category becomes a root category (parent becomes NULL) rather than being cascade-deleted.

---

### 2.2 Flavors

Lightweight product variant dimension for flavor/scent/type distinctions.

```sql
CREATE TABLE IF NOT EXISTS flavors (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Notes:**
- Flavors are global labels shared across products (e.g., "Lemon" can apply to any product).
- Products declare which flavors they carry via `product_flavors` (many-to-many).
- Inventory and order lines each carry a nullable `flavor_id`; `NULL` means the base product with no flavor distinction.

---

### 2.3 Suppliers

```sql
CREATE TABLE IF NOT EXISTS suppliers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  phone      TEXT,
  credit     REAL NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**`credit` column:** Running balance that the distributor owes to this supplier.
- Increases when a purchase is received (distributor receives goods on credit).
- Decreases when a `debt_repayments` row is inserted.

---

### 2.4 Customers

```sql
CREATE TABLE IF NOT EXISTS customers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  phone      TEXT,
  credit     REAL NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**`credit` column:** Running balance that this customer owes the distributor.
- Increases when an order with `payment_type = 'credit'` is confirmed.
- Decreases when a `debt_collections` row is inserted.

---

### 2.5 Products

```sql
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
```

**`supplier_id`:** Stored here so the daily PO generation can `GROUP BY supplier_id`
across all `order_items → products` without extra joins.

**Tax fields:**
- `fixed_tax` — flat per-unit tax (e.g., excise tax)
- `purchase_tax` — tax applied when purchasing from supplier
- `sell_tax` — tax applied when selling to customer

---

### 2.6 Product Flavors

Many-to-many junction between products and flavors.

```sql
CREATE TABLE IF NOT EXISTS product_flavors (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  flavor_id  INTEGER NOT NULL REFERENCES flavors(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, flavor_id)
);
```

---

### 2.7 Inventory

One stock record per `(product, flavor)` combination.

```sql
CREATE TABLE IF NOT EXISTS inventory (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  flavor_id  INTEGER REFERENCES flavors(id) ON DELETE SET NULL,
  quantity   REAL NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, flavor_id)
);
```

**Notes:**
- `flavor_id = NULL` → stock for the base product with no flavor.
- `UNIQUE(product_id, flavor_id)` uses SQLite NULL handling: two rows with the same
  `product_id` and `flavor_id = NULL` would conflict only if both are NULL — acceptable
  because we expect at most one "no flavor" row per product.
- `quantity` is `REAL` to support fractional units (e.g., kg, L).

---

### 2.8 Orders (Customer Invoices)

```sql
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
```

**Status flow:**

```
draft ──► confirmed ──► partially_paid ──► paid
   │                                        ▲
   └──────────────────────────────────────►cancelled
```

**`payment_type`:**
- `cash` — customer pays on delivery; no credit effect
- `credit` — order total added to `customers.credit` on confirmation

**`invoice_pdf`:** File path (relative to app data dir) to the generated PDF invoice.

---

### 2.9 Order Items

```sql
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
```

**`deducted_qty`:** When the supplier delivers fewer units than ordered, the distributor
enters the shortage here. The effective quantity on the customer invoice is
`quantity - deducted_qty`, and the order `total` is recalculated accordingly.

**`tax_amount`:** Pre-calculated line tax (`unit_price × quantity × sell_tax`), stored as
a snapshot so future product tax changes don't affect historical invoices.

---

### 2.10 Purchases (Supplier Purchase Orders)

```sql
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
```

**Auto-generation:** At end of day the app reads all `order_items` whose `orders.status =
'confirmed'`, groups by `products.supplier_id`, and inserts one purchase + purchase_items
set per supplier. This is done inside a single atomic transaction.

**Status flow:**

```
pending ──► received
   │
   └──► partially_received ──► received
   │
   └──► cancelled
```

---

### 2.11 Purchase Items

```sql
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
```

**`received_qty`:** Entered when the supplier delivers. If `received_qty < quantity`,
the purchase becomes `partially_received` and the distributor must record the shortfall
in the corresponding `order_items.deducted_qty`.

---

### 2.12 Debt Collections

Cash received from customers to reduce their outstanding credit balance.

```sql
CREATE TABLE IF NOT EXISTS debt_collections (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  amount      REAL NOT NULL,
  notes       TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Effect on insert:** `UPDATE customers SET credit = credit - amount WHERE id = customer_id`
(executed inside an IPC handler transaction).

---

### 2.13 Debt Repayments

Cash paid to suppliers to reduce the distributor's outstanding balance.

```sql
CREATE TABLE IF NOT EXISTS debt_repayments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  amount      REAL NOT NULL,
  notes       TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Effect on insert:** `UPDATE suppliers SET credit = credit - amount WHERE id = supplier_id`.

---

### 2.14 Settings

```sql
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Example rows:

| key | value |
|-----|-------|
| `currency` | `SAR` |
| `tax_default` | `0.15` |
| `company_name` | `Naseej Distribution` |
| `invoice_header` | `...` |

---

## 3. Entity-Relationship Overview

```
categories ──< products >── suppliers
                 │
                 ├──< product_flavors >── flavors
                 │                           │
                 └──< inventory (product_id, flavor_id)

customers ──< orders ──< order_items (product_id, flavor_id)
customers ──< debt_collections

suppliers ──< purchases ──< purchase_items (product_id, flavor_id)
suppliers ──< debt_repayments
```

---

## 4. Key Query Patterns

### 4.1 Parameterized Queries (Always)

```typescript
// SAFE — parameterized
const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);

// UNSAFE — never do this
const customer = db.prepare(`SELECT * FROM customers WHERE id = ${id}`).get(); // ❌
```

### 4.2 Get All Products with Category and Supplier

```typescript
export function getAllProducts(db: Database.Database) {
  return db.prepare(`
    SELECT p.*,
           c.title AS category_title,
           s.name  AS supplier_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers  s ON p.supplier_id  = s.id
    ORDER BY p.title
  `).all();
}
```

### 4.3 Get Order with Items

```typescript
export function getOrderWithItems(db: Database.Database, orderId: number) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  const items = db.prepare(`
    SELECT oi.*,
           p.title AS product_title,
           f.name  AS flavor_name
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    LEFT JOIN flavors f ON oi.flavor_id = f.id
    WHERE oi.order_id = ?
  `).all(orderId);
  return { ...order, items };
}
```

### 4.4 Daily Purchase Order Generation

```typescript
export function generateDailyPurchaseOrders(db: Database.Database): void {
  db.transaction(() => {
    // Aggregate confirmed order items grouped by supplier
    const groups = db.prepare(`
      SELECT p.supplier_id,
             oi.product_id,
             oi.flavor_id,
             SUM(oi.quantity - oi.deducted_qty) AS total_qty,
             p.wholesale_price                  AS unit_cost
      FROM order_items oi
      JOIN orders  o ON oi.order_id  = o.id
      JOIN products p ON oi.product_id = p.id
      WHERE o.status = 'confirmed'
        AND p.supplier_id IS NOT NULL
      GROUP BY p.supplier_id, oi.product_id, oi.flavor_id
    `).all() as PurchaseGroup[];

    // Group by supplier and insert purchases
    const bySupplier = groupBy(groups, g => g.supplier_id);

    for (const [supplierId, lines] of Object.entries(bySupplier)) {
      const total = lines.reduce((s, l) => s + l.total_qty * l.unit_cost, 0);
      const { lastInsertRowid: purchaseId } = db.prepare(`
        INSERT INTO purchases (supplier_id, total) VALUES (?, ?)
      `).run(Number(supplierId), total);

      const itemStmt = db.prepare(`
        INSERT INTO purchase_items
          (purchase_id, product_id, flavor_id, quantity, unit_cost)
        VALUES (?, ?, ?, ?, ?)
      `);
      lines.forEach(l =>
        itemStmt.run(purchaseId, l.product_id, l.flavor_id ?? null, l.total_qty, l.unit_cost)
      );
    }
  })();
}
```

### 4.5 Record Debt Collection (Atomic)

```typescript
export function recordDebtCollection(
  db: Database.Database,
  customerId: number,
  amount: number,
  notes?: string
): void {
  db.transaction(() => {
    db.prepare(`
      INSERT INTO debt_collections (customer_id, amount, notes) VALUES (?, ?, ?)
    `).run(customerId, amount, notes ?? null);

    db.prepare(`
      UPDATE customers SET credit = credit - ? WHERE id = ?
    `).run(amount, customerId);
  })();
}
```

---

## 5. Migration Strategy

Schema changes are tracked in `src/main/db/migrations.ts`. Each migration is a SQL
statement gated by a user-version PRAGMA:

```typescript
const MIGRATIONS: Array<{ version: number; sql: string }> = [
  // Add new columns, indexes, or tables here
  // { version: 2, sql: 'ALTER TABLE products ADD COLUMN barcode TEXT' },
];

export function runMigrations(db: Database.Database): void {
  const current = (db.pragma('user_version', { simple: true }) as number) ?? 0;
  for (const m of MIGRATIONS) {
    if (m.version > current) {
      db.exec(m.sql);
      db.pragma(`user_version = ${m.version}`);
    }
  }
}
```
