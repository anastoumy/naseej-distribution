# Electron Main Process Architecture

## Naseej Lite — Local Data Layer

**Stack:** Node.js (Electron) · SQLite (`better-sqlite3`) · IPC Bridge  
**Database:** SQLite (local file: `naseej.db`)  
**Architecture:** Renderer ↔ IPC ↔ Main Process ↔ SQLite  
**Offline:** 100% local — no external dependencies, no network calls

---

## Directory Layout

```
src/main/
├── index.ts                  # Entry point: window creation, app lifecycle
│
├── db/
│   ├── database.ts           # SQLite singleton connection (getDb / closeDb)
│   ├── schema.ts             # Loads docs/schema.sql and executes it
│   └── migrations.ts         # user_version-based schema migrations
│
└── ipc/                      # One file per domain — each exports registerXxxHandlers()
    ├── categories.ts         # categories:getAll / create / update / delete
    ├── customers.ts          # customers:getAll / getById / create / update / delete
    ├── suppliers.ts          # suppliers:getAll / getById / create / update / delete
    ├── products.ts           # products:getAll / getById / create / update / delete
    ├── flavors.ts            # flavors:getAll / create / update / delete
    ├── inventory.ts          # inventory:getAll / getByProduct / adjust
    ├── orders.ts             # orders:getAll / getById / create / updateStatus / addItem / deduct
    ├── purchases.ts          # purchases:getAll / getById / generate / updateStatus / receive
    └── debts.ts              # debtCollections:create  debtRepayments:create
```

---

## Core Responsibilities

### 1. SQLite Database Layer

**Purpose:** Persistent local storage of all distributor data.

**Initialization:**
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
    _db.pragma('journal_mode = WAL');  // write-ahead logging for crash safety
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

**Features:**
- Single database file in Electron `userData` directory
- Atomic transactions prevent data corruption
- Foreign key constraints enforce referential integrity
- WAL mode prevents journal corruption on unexpected shutdown
- Daily backup exported to a timestamped `.db` file

---

### 2. IPC Bridge

**Purpose:** Safe, typed communication between the React renderer and the Node.js main process. The renderer has no direct access to Node.js or SQLite APIs.

**Architecture:**

```
┌──────────────────────────────────────────────────────┐
│  Renderer (React Component)                          │
│  └─ window.api.orders.create(data)                   │
└──────────────────────────────────────────────────────┘
                      ↓
              IPC Channel (secure)
                      ↓
┌──────────────────────────────────────────────────────┐
│  Main Process (Node.js)                              │
│  ├─ ipcMain.handle('orders:create', handler)         │
│  └─ getDb() → INSERT INTO orders ...                 │
└──────────────────────────────────────────────────────┘
```

**IPC handler pattern:**
```typescript
// src/main/ipc/orders.ts
import { ipcMain } from 'electron';
import { getDb } from '../db/database';

export function registerOrderHandlers(): void {
  ipcMain.handle('orders:create', (_event, data: CreateOrderInput) => {
    const db = getDb();
    try {
      const result = db.transaction(() => {
        const { lastInsertRowid } = db.prepare(`
          INSERT INTO orders (customer_id, payment_type, notes)
          VALUES (?, ?, ?)
        `).run(data.customerId, data.paymentType, data.notes ?? null);
        return { id: Number(lastInsertRowid) };
      })();
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
```

**Preload bridge:**
```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  customers: {
    getAll:  ()       => ipcRenderer.invoke('customers:getAll'),
    getById: (id)     => ipcRenderer.invoke('customers:getById', id),
    create:  (data)   => ipcRenderer.invoke('customers:create', data),
    update:  (id, d)  => ipcRenderer.invoke('customers:update', id, d),
    delete:  (id)     => ipcRenderer.invoke('customers:delete', id),
  },
  suppliers: {
    getAll:  ()       => ipcRenderer.invoke('suppliers:getAll'),
    create:  (data)   => ipcRenderer.invoke('suppliers:create', data),
    update:  (id, d)  => ipcRenderer.invoke('suppliers:update', id, d),
    delete:  (id)     => ipcRenderer.invoke('suppliers:delete', id),
  },
  products: {
    getAll:  ()       => ipcRenderer.invoke('products:getAll'),
    getById: (id)     => ipcRenderer.invoke('products:getById', id),
    create:  (data)   => ipcRenderer.invoke('products:create', data),
    update:  (id, d)  => ipcRenderer.invoke('products:update', id, d),
    delete:  (id)     => ipcRenderer.invoke('products:delete', id),
  },
  flavors: {
    getAll:  ()       => ipcRenderer.invoke('flavors:getAll'),
    create:  (data)   => ipcRenderer.invoke('flavors:create', data),
  },
  inventory: {
    getAll:       ()          => ipcRenderer.invoke('inventory:getAll'),
    getByProduct: (productId) => ipcRenderer.invoke('inventory:getByProduct', productId),
    adjust:       (data)      => ipcRenderer.invoke('inventory:adjust', data),
  },
  orders: {
    getAll:       ()            => ipcRenderer.invoke('orders:getAll'),
    getById:      (id)          => ipcRenderer.invoke('orders:getById', id),
    create:       (data)        => ipcRenderer.invoke('orders:create', data),
    updateStatus: (id, status)  => ipcRenderer.invoke('orders:updateStatus', id, status),
    addItem:      (data)        => ipcRenderer.invoke('orders:addItem', data),
    deductItem:   (id, qty)     => ipcRenderer.invoke('orders:deductItem', id, qty),
  },
  purchases: {
    getAll:       ()           => ipcRenderer.invoke('purchases:getAll'),
    getById:      (id)         => ipcRenderer.invoke('purchases:getById', id),
    generate:     ()           => ipcRenderer.invoke('purchases:generate'),
    updateStatus: (id, status) => ipcRenderer.invoke('purchases:updateStatus', id, status),
    receiveItem:  (id, qty)    => ipcRenderer.invoke('purchases:receiveItem', id, qty),
  },
  debts: {
    collectFromCustomer: (data) => ipcRenderer.invoke('debts:collectFromCustomer', data),
    repayToSupplier:     (data) => ipcRenderer.invoke('debts:repayToSupplier', data),
  },
});
```

---

### 3. Key Multi-Step Transactions

All operations that touch more than one table are wrapped in a `db.transaction()` call.

#### Confirm an Order (cash payment)

```typescript
// Confirming a cash order does NOT affect customers.credit
ipcMain.handle('orders:updateStatus', (_event, orderId: number, newStatus: string) => {
  const db = getDb();
  db.transaction(() => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Order;

    if (newStatus === 'confirmed' && order.payment_type === 'credit') {
      // Add order total to customer's outstanding credit
      db.prepare('UPDATE customers SET credit = credit + ? WHERE id = ?')
        .run(order.total, order.customer_id);
    }

    if (newStatus === 'cancelled' && order.status === 'confirmed' && order.payment_type === 'credit') {
      // Reverse the credit when cancelling a confirmed credit order
      db.prepare('UPDATE customers SET credit = credit - ? WHERE id = ?')
        .run(order.total, order.customer_id);
    }

    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(newStatus, orderId);
  })();
});
```

#### Auto-Generate Daily Purchase Orders

```typescript
ipcMain.handle('purchases:generate', (_event) => {
  const db = getDb();
  db.transaction(() => {
    const groups = db.prepare(`
      SELECT p.supplier_id,
             oi.product_id,
             oi.flavor_id,
             SUM(oi.quantity - oi.deducted_qty) AS qty,
             p.wholesale_price                  AS unit_cost
      FROM order_items oi
      JOIN orders   o ON oi.order_id   = o.id
      JOIN products p ON oi.product_id = p.id
      WHERE o.status = 'confirmed'
        AND p.supplier_id IS NOT NULL
      GROUP BY p.supplier_id, oi.product_id, oi.flavor_id
    `).all() as PurchaseGroup[];

    const bySupplier = groupBy(groups, g => String(g.supplier_id));
    for (const [supplierId, lines] of Object.entries(bySupplier)) {
      const total = lines.reduce((s, l) => s + l.qty * l.unit_cost, 0);
      const { lastInsertRowid: purchaseId } = db.prepare(
        'INSERT INTO purchases (supplier_id, total) VALUES (?, ?)'
      ).run(Number(supplierId), total);

      const itemStmt = db.prepare(`
        INSERT INTO purchase_items (purchase_id, product_id, flavor_id, quantity, unit_cost)
        VALUES (?, ?, ?, ?, ?)
      `);
      lines.forEach(l =>
        itemStmt.run(purchaseId, l.product_id, l.flavor_id ?? null, l.qty, l.unit_cost)
      );
    }
  })();
});
```

#### Record Debt Collection

```typescript
ipcMain.handle('debts:collectFromCustomer', (_event, data) => {
  const db = getDb();
  db.transaction(() => {
    db.prepare('INSERT INTO debt_collections (customer_id, amount, notes) VALUES (?, ?, ?)')
      .run(data.customerId, data.amount, data.notes ?? null);
    db.prepare('UPDATE customers SET credit = credit - ? WHERE id = ?')
      .run(data.amount, data.customerId);
  })();
});
```

---

### 4. Database Safety

**Power-loss safety:**
- `journal_mode = WAL` ensures no partial writes survive a crash.
- All multi-step operations are in a single `db.transaction()` — fully atomic.

**Backup strategy:**
```typescript
export function backupDatabase(outputDir: string): void {
  const db = getDb();
  const timestamp = new Date().toISOString().split('T')[0];
  const backupPath = path.join(outputDir, `naseej_backup_${timestamp}.db`);
  db.backup(backupPath);
}
```

---

### 5. PDF Export / Import

- **Customer invoice export:** Main process renders the order data into a PDF using a
  lightweight PDF library, saves it to `app.getPath('documents')`, and stores the relative
  path in `orders.invoice_pdf`.
- **Purchase order export:** Same approach for `purchases.invoice_pdf`.
- **Supplier invoice import:** The user selects a PDF file via Electron's file dialog; the
  path is stored in `purchases.invoice_pdf` for reference.

No HTML server or browser printing is used — PDF generation happens entirely in the main
process via Node.js.
