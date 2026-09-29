# Developer Guide & Code Standards

## Naseej Lite — Setup, Conventions, and Development Workflow

**Applies to:** All contributors to the Electron distributor application

---

## 1. Engineering Principles

### 1.1 Architecture Rules

| Principle | Description |
|-----------|------------|
| **Offline-First** | Application works without internet. SQLite is the only data store. |
| **IPC Boundary** | Renderer never directly accesses Node.js APIs or SQLite. All data flows through the IPC bridge (`window.api`). |
| **Type Safety** | TypeScript strict mode enabled. No `any` types in committed code. |
| **Atomic Transactions** | Any operation that modifies more than one table (e.g., confirming a credit order, recording a debt collection) must use `db.transaction()`. |
| **Parameterized Queries** | All SQL queries use `?` placeholders — never string interpolation. |

### 1.2 Code Conventions

| Area | Convention |
|------|-----------|
| TypeScript | Strict mode. No `any`. Interfaces for all data models in `types.ts`. |
| File naming | `PascalCase` for React components; `camelCase` for utilities and hooks |
| Directories | Organize by feature (`features/orders/`) not by type |
| React components | Functional components only. Hooks for state and side effects. |
| CSS | Tailwind utility classes. No custom CSS except CSS variable declarations in `index.css`. |
| Commit messages | Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:` |
| IPC Channels | Use constants from `src/shared/channels.ts`, never hardcoded strings |
| IPC responses | All handlers return `{ success: boolean; data?: T; error?: string }` |

---

## 2. Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ LTS | JavaScript runtime |
| npm | 9+ | Package manager |
| SQLite | 3.40+ | Database (bundled via `better-sqlite3`) |
| Electron | 28+ | Desktop framework |
| TypeScript | 5.0+ | Type safety |

---

## 3. Initial Setup

### 3.1 Clone & Install

```bash
git clone <repository>
cd naseej-accounting
npm install
```

### 3.2 Start Development

```bash
# Run with hot reload (electron-vite)
npm run dev

# Build for production
npm run build

# Package installers (macOS DMG + Windows NSIS)
npm run make
```

### 3.3 Project Structure

```
src/
├── main/          # Electron main process (Node.js)
│   ├── index.ts   # Entry point
│   ├── db/        # SQLite connection, schema loader, migrations
│   └── ipc/       # IPC handlers (one file per domain)
│
├── preload/
│   └── index.ts   # contextBridge: window.api surface
│
└── renderer/      # React application
    └── src/
        ├── App.tsx
        ├── features/  # Feature modules
        └── components/ # Shared UI
```

---

## 4. Database Development (SQLite)

### 4.1 Schema Source of Truth

The canonical schema lives in `docs/schema.sql`. Never write DDL directly in
TypeScript files. The schema loader reads and executes this file at startup:

```typescript
// src/main/db/schema.ts
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export function initSchema(db: Database.Database): void {
  const sql = fs.readFileSync(
    path.join(__dirname, '../../docs/schema.sql'),
    'utf-8'
  );
  db.exec(sql);
}
```

### 4.2 Query Pattern

```typescript
// Always use parameterized queries
const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);

// Atomic multi-table operation
db.transaction(() => {
  db.prepare('INSERT INTO debt_collections (customer_id, amount) VALUES (?, ?)')
    .run(customerId, amount);
  db.prepare('UPDATE customers SET credit = credit - ? WHERE id = ?')
    .run(amount, customerId);
})();
```

### 4.3 Adding a Migration

```typescript
// src/main/db/migrations.ts
const MIGRATIONS = [
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

---

## 5. IPC Bridge Development

### 5.1 Define Channel Names

```typescript
// src/shared/channels.ts
export const CHANNELS = {
  CUSTOMERS_GET_ALL: 'customers:getAll',
  CUSTOMERS_CREATE:  'customers:create',
  ORDERS_CREATE:     'orders:create',
  ORDERS_UPDATE_STATUS: 'orders:updateStatus',
  PURCHASES_GENERATE:   'purchases:generate',
  DEBTS_COLLECT:     'debts:collectFromCustomer',
  DEBTS_REPAY:       'debts:repayToSupplier',
} as const;
```

### 5.2 Implement Handler (Main Process)

```typescript
// src/main/ipc/customers.ts
import { ipcMain } from 'electron';
import { getDb } from '../db/database';
import { CHANNELS } from '../../shared/channels';

export function registerCustomerHandlers(): void {
  ipcMain.handle(CHANNELS.CUSTOMERS_GET_ALL, () => {
    try {
      const rows = getDb().prepare('SELECT * FROM customers ORDER BY name').all();
      return { success: true, data: rows };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(CHANNELS.CUSTOMERS_CREATE, (_event, data) => {
    try {
      const { lastInsertRowid } = getDb()
        .prepare('INSERT INTO customers (name, phone) VALUES (?, ?)')
        .run(data.name, data.phone ?? null);
      return { success: true, data: { id: Number(lastInsertRowid) } };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
```

### 5.3 Call from Renderer

```typescript
// src/renderer/src/features/customers/hooks/useCustomers.ts
export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    window.api.customers.getAll().then(res => {
      if (res.success) setCustomers(res.data);
    });
  }, []);

  const createCustomer = async (data: CreateCustomerInput) => {
    const res = await window.api.customers.create(data);
    if (res.success) setCustomers(prev => [...prev, { id: res.data.id, ...data }]);
    return res;
  };

  return { customers, createCustomer };
}
```

---

## 6. Flavor Model Development

When adding flavor-aware features, follow these patterns:

### 6.1 Insert inventory row

```typescript
// Upsert inventory for a (product, flavor) pair
db.prepare(`
  INSERT INTO inventory (product_id, flavor_id, quantity)
  VALUES (?, ?, ?)
  ON CONFLICT(product_id, flavor_id) DO UPDATE SET quantity = quantity + excluded.quantity
`).run(productId, flavorId ?? null, delta);
```

### 6.2 Add an order item with flavor

```typescript
db.prepare(`
  INSERT INTO order_items (order_id, product_id, flavor_id, quantity, unit_price, tax_amount)
  VALUES (?, ?, ?, ?, ?, ?)
`).run(orderId, productId, flavorId ?? null, qty, unitPrice, taxAmount);
```

### 6.3 Get all flavors for a product

```typescript
db.prepare(`
  SELECT f.*
  FROM flavors f
  JOIN product_flavors pf ON f.id = pf.flavor_id
  WHERE pf.product_id = ?
`).all(productId);
```

---

## 7. Testing

### 7.1 IPC Handler Tests

```typescript
// Use better-sqlite3 with an in-memory database for fast unit tests
import Database from 'better-sqlite3';
import { initSchema } from '../db/schema';

let db: Database.Database;

beforeEach(() => {
  db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initSchema(db);
});

afterEach(() => db.close());

test('createCustomer inserts a row', () => {
  db.prepare('INSERT INTO customers (name) VALUES (?)').run('Test Customer');
  const row = db.prepare('SELECT * FROM customers WHERE name = ?').get('Test Customer');
  expect(row).toBeDefined();
});
```

### 7.2 Credit Balance Invariant

```typescript
test('confirming a credit order increases customer balance', () => {
  // seed customer and order...
  const before = db.prepare('SELECT credit FROM customers WHERE id = ?').get(customerId);
  confirmOrder(db, orderId);  // your function under test
  const after = db.prepare('SELECT credit FROM customers WHERE id = ?').get(customerId);
  expect(after.credit).toBe(before.credit + orderTotal);
});
```
