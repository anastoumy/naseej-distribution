# Naseej Lite — File Structure

> Last Updated: 2026-06-08  
> Stack: Electron + Vite + React + TypeScript + SQLite (better-sqlite3) + Tailwind CSS

---

## Root

```
naseej-accounting/
├── electron.vite.config.ts     # Vite build config for Electron (main + preload + renderer)
├── electron-builder.yml        # Electron Builder packaging config
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json               # Root TypeScript config (references node + web)
├── tsconfig.node.json          # TypeScript config for main process & preload
├── tsconfig.web.json           # TypeScript config for renderer (React)
├── README.md                   # Project overview, setup, and workflow documentation
├── docs/                       # Project documentation
│   ├── schema.sql              # Canonical SQLite schema (source of truth)
│   ├── DATA_MODELS_SCHEMAS.md
│   ├── BACKEND_STRUCTURE.md
│   ├── FRONTEND_PAGES_FEATURES.md
│   ├── IMPLEMENTATION_PLAN.md
│   ├── FILE_STRUCTURE.md
│   ├── POS_APP_STRUCTURE.md
│   ├── POS_APP_MAP.md
│   ├── CODE_INSTRUCTIONS.md
│   ├── NASEEJ_BRD.md
│   └── NASEEJ_PRD.md
└── src/                        # All application source code
```

---

## `src/main/` — Electron Main Process

The main process owns the SQLite database, all IPC handlers, and native OS integration.

```
src/main/
├── index.ts                    # Entry point: creates BrowserWindow, registers IPC, handles lifecycle
├── updater.ts                  # electron-updater integration
│
├── db/
│   ├── database.ts             # Singleton SQLite connection (getDb / closeDb)
│   ├── schema.ts               # Reads docs/schema.sql and runs db.exec() at startup
│   ├── migrations.ts           # user_version-based schema migration runner
│   └── backup.ts               # Daily backup export utility
│
└── ipc/                        # One file per domain — each exports registerXxxHandlers()
    ├── categories.ts           # categories:getAll / create / update / delete
    ├── customers.ts            # customers:getAll / getById / create / update / delete
    ├── suppliers.ts            # suppliers:getAll / getById / create / update / delete
    ├── products.ts             # products:getAll / getById / create / update / delete
    ├── flavors.ts              # flavors:getAll / create / update / delete
    ├── inventory.ts            # inventory:getAll / getByProduct / adjust
    ├── orders.ts               # orders:getAll / getById / create / updateStatus / addItem / deductItem
    ├── purchases.ts            # purchases:getAll / getById / generate / updateStatus / receiveItem
    └── debts.ts                # debts:collectFromCustomer / repayToSupplier
```

### Database Schema (SQLite tables)

| Table | Purpose |
|---|---|
| `categories` | Hierarchical product categories (self-referencing `parent_id`) |
| `flavors` | Global flavor/scent/type labels (shared across products) |
| `suppliers` | Supplier directory with running credit balance |
| `customers` | Customer directory with running credit balance |
| `products` | Product catalog; each product links to a supplier for PO grouping |
| `product_flavors` | Many-to-many: which flavors a product offers |
| `inventory` | Stock quantity per `(product, flavor)` combination |
| `orders` | Customer invoices with status and payment type |
| `order_items` | Line items per order; includes `deducted_qty` for delivery shortfalls |
| `purchases` | Supplier purchase orders (auto-generated daily) |
| `purchase_items` | Line items per purchase; includes `received_qty` |
| `debt_collections` | Cash received from customers to reduce their credit balance |
| `debt_repayments` | Cash paid to suppliers to reduce distributor credit |
| `settings` | Key/value store for app configuration |

---

## `src/preload/` — Preload Script

```
src/preload/
└── index.ts                    # Exposes window.api to renderer via contextBridge
                                # All IPC invoke calls are wrapped here as typed functions
```

The `window.api` object groups all IPC calls by domain:
`customers`, `suppliers`, `products`, `flavors`, `categories`,
`inventory`, `orders`, `purchases`, `debts`

---

## `src/renderer/` — React Renderer

```
src/renderer/
├── index.html                  # Vite HTML entry point
│
├── content/
│   ├── ar.json                 # Arabic i18n translations
│   └── en.json                 # English i18n translations
│
└── src/
    ├── App.tsx                 # Root component: sidebar layout + router
    ├── main.tsx                # ReactDOM.createRoot entry
    └── index.css               # Tailwind base + custom CSS variables (design tokens)
```

### `src/renderer/src/components/` — Shared UI Components

```
components/
├── layout/
│   ├── Sidebar.tsx             # Left navigation rail
│   └── StatusBar.tsx           # Top bar: app name, date, language switcher
│
└── ui/
    ├── ChipMultiSelect.tsx     # Multi-select chip input (used for flavor selection)
    ├── LanguageSwitcher.tsx    # AR / EN toggle
    ├── ToggleSwitch.tsx        # Boolean toggle
    └── custom/
        ├── dialog/Dialog.tsx   # Accessible dialog wrapper
        ├── modal/Modal.tsx     # General-purpose modal with header/footer slots
        └── toast/              # Toast notification system
            ├── ToastProvider.tsx
            ├── useToast.ts
            ├── toast.types.ts
            └── index.ts
```

### `src/renderer/src/features/` — Feature Modules

Each feature module follows the same structure:
```
feature/
├── index.ts        # Public exports (screens, types)
├── types.ts        # Domain type definitions
├── components/     # Reusable UI pieces scoped to this feature
├── hooks/          # Custom React hooks scoped to this feature
├── modals/         # Modal dialogs scoped to this feature
└── screens/        # Full page views (routed from App.tsx)
```

#### Feature list

| Feature | Key Screens |
|---------|-------------|
| `customers/` | CustomerList, CustomerForm, CustomerDebtLedger |
| `suppliers/` | SupplierList, SupplierForm, SupplierDebtLedger |
| `products/` | ProductList, ProductForm, CategoryTree, FlavorList |
| `inventory/` | InventoryTable, AdjustStockModal |
| `orders/` | OrderList, OrderDetail, OrderForm, OrderItemRow |
| `purchases/` | PurchaseList, PurchaseDetail, GeneratePOModal |
| `debts/` | DebtCollectionForm, DebtRepaymentForm |
| `reports/` | DailySummary, OutstandingDebts, InventoryReport |
| `settings/` | SettingsPage |

---

## `src/shared/` — Shared Between Main & Renderer

```
src/shared/
├── channels.ts     # IPC channel name constants
└── index.ts        # Shared type exports
```

---

## `docs/` — Documentation

```
docs/
├── schema.sql                  # Canonical SQLite DDL (source of truth for the database)
├── DATA_MODELS_SCHEMAS.md      # Schema narrative, ER overview, query patterns
├── BACKEND_STRUCTURE.md        # Main process architecture, IPC patterns
├── FRONTEND_PAGES_FEATURES.md  # Screen descriptions and feature specs
├── IMPLEMENTATION_PLAN.md      # Phased build plan
├── FILE_STRUCTURE.md           # This file
├── POS_APP_STRUCTURE.md        # Full directory layout with annotations
├── POS_APP_MAP.md              # Screen map and workflow diagrams
├── CODE_INSTRUCTIONS.md        # Developer setup and coding standards
├── NASEEJ_BRD.md               # Business Requirements Document
└── NASEEJ_PRD.md               # Product Requirements Document
```
