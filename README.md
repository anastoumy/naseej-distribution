# Naseej Lite

A local, offline-first distributor management desktop application built with Electron and SQLite. Designed for a single distributor who takes customer orders, auto-generates supplier purchase orders at end of day, manages credit/debt, and produces PDF invoices — all without any internet or server dependency.

---

## What is Naseej Lite?

Naseej Lite is a single-tenant desktop tool for product distributors. It replaces manual invoice books and spreadsheets with a structured workflow:

1. **Enter customer invoices** — record orders line-by-line per customer, choosing cash or credit payment
2. **Auto-generate daily purchase orders** — at end of day, the app groups all confirmed order items by supplier and creates a purchase order per supplier
3. **Manage delivery & deductions** — when supplier delivery is short, manually deduct missing items from the customer invoice
4. **Track credit and debt** — customers who pay on credit accumulate a balance; record collections when they pay; same pattern for supplier repayments
5. **Print or export PDFs** — generate invoice PDFs for customers and purchase order PDFs for suppliers
6. **Import supplier invoices** — accept PDF files from suppliers and attach them to purchase records

All data is stored in a local SQLite file (`naseej.db`) on the user's machine. No network connection is ever required.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop Framework | Electron (Node.js + Chromium) |
| UI Framework | React 18 + TypeScript |
| Database | SQLite 3 via `better-sqlite3` (local file, no server) |
| Schema location | `docs/schema.sql` — loaded at startup via `db.exec()` |
| Styling | Tailwind CSS |
| State Management | React Context + Hooks |
| Inter-process Communication | Electron IPC (`ipcMain` / `ipcRenderer`) |
| Build / Bundler | Vite (`electron-vite`) |
| Packaging | `electron-builder` (Windows NSIS + macOS DMG) |
| i18n | `i18next` (Arabic + English, RTL support) |

---

## Data Model

The schema lives in [`docs/schema.sql`](docs/schema.sql) and is applied idempotently at startup. All tables use `INTEGER PRIMARY KEY AUTOINCREMENT` and `DATETIME DEFAULT CURRENT_TIMESTAMP`.

### Core Tables

| Table | Purpose |
|---|---|
| `categories` | Hierarchical product categories (self-referencing `parent_id`) |
| `flavors` | Product variant dimension (flavor/scent/type — see below) |
| `suppliers` | Supplier directory with running credit balance |
| `customers` | Customer directory with running credit balance |
| `products` | Product catalog; each product belongs to a supplier for PO grouping |
| `product_flavors` | Many-to-many junction: which flavors a product offers |
| `inventory` | Stock quantity per `(product, flavor)` combination |
| `orders` | Customer invoices (status: `draft → confirmed → paid / cancelled`) |
| `order_items` | Line items on a customer order, includes `deducted_qty` for shortages |
| `purchases` | Supplier purchase orders (status: `pending → received / cancelled`) |
| `purchase_items` | Line items on a purchase order, includes `received_qty` |
| `debt_collections` | Cash collected from customers against their credit balance |
| `debt_repayments` | Cash paid to suppliers against the distributor's credit balance |
| `settings` | Key/value store for app-level configuration |

### The Flavor Model

Products in this domain often come in multiple flavors, scents, or types (e.g., a cleaning product in "Lemon", "Pine", "Original"). The flavor model provides lightweight variant support without the complexity of full size × color matrices.

**How it works:**

```
products ──< product_flavors >── flavors
                                    │
                                    ▼
                              inventory (product_id, flavor_id)
                              order_items (product_id, flavor_id)
                              purchase_items (product_id, flavor_id)
```

- A `flavor` row is a shared label (e.g., "Lemon") reusable across products.
- `product_flavors` declares which flavors a specific product is available in.
- `inventory`, `order_items`, and `purchase_items` each carry a nullable `flavor_id`. When `flavor_id IS NULL`, the row refers to the base product with no flavor distinction.
- The `UNIQUE(product_id, flavor_id)` constraint in `inventory` ensures exactly one stock record per combination.

---

## Local Setup

```bash
# Install dependencies
npm install

# Start in development mode (hot reload)
npm run dev

# Build for production
npm run build

# Package as installer (macOS DMG / Windows NSIS)
npm run make
```

---

## Project Structure

```
src/
├── main/                   # Electron main process (Node.js)
│   ├── index.ts            # Window creation, app lifecycle
│   ├── db/
│   │   ├── database.ts     # SQLite singleton (getDb / closeDb)
│   │   ├── schema.ts       # Loads and executes docs/schema.sql
│   │   └── migrations.ts   # Schema version tracking
│   └── ipc/                # IPC handlers — one file per domain
│       ├── categories.ts
│       ├── customers.ts
│       ├── suppliers.ts
│       ├── products.ts
│       ├── flavors.ts
│       ├── inventory.ts
│       ├── orders.ts
│       ├── purchases.ts
│       └── debts.ts
│
├── preload/
│   └── index.ts            # contextBridge: exposes window.api to renderer
│
└── renderer/
    └── src/
        ├── App.tsx
        ├── features/
        │   ├── customers/
        │   ├── suppliers/
        │   ├── products/
        │   ├── orders/
        │   ├── purchases/
        │   ├── inventory/
        │   └── debts/
        └── components/

docs/
├── schema.sql              # Canonical SQLite schema (source of truth)
├── DATA_MODELS_SCHEMAS.md  # Schema narrative and query patterns
├── BACKEND_STRUCTURE.md    # Main process architecture
├── FRONTEND_PAGES_FEATURES.md
├── IMPLEMENTATION_PLAN.md
└── ...
```

---

## Key Workflows

### Daily Order Cycle

```
Morning:
  Enter customer orders (status = draft)
  Confirm orders (status = confirmed)

End of Day:
  App reads all confirmed order_items
  Groups by products.supplier_id
  Creates one purchase per supplier
  Sets purchase status = pending

On Delivery:
  Update purchase status → received / partially_received
  Enter received_qty per purchase_item
  Deduct missing items from order_items.deducted_qty
  Recalculate order totals
  Print / export customer invoices as PDF
```

### Credit Flow

```
Customer pays on credit:
  order.payment_type = 'credit'
  customers.credit += order.total

Customer settles:
  INSERT INTO debt_collections (customer_id, amount)
  customers.credit -= amount

Distributor pays supplier:
  INSERT INTO debt_repayments (supplier_id, amount)
  suppliers.credit -= amount
```
