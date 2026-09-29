# Naseej Lite — Desktop Application Structure

## Electron Desktop App for Distributor Management

**Stack:** Electron · Vite (`electron-vite`) · React · TypeScript · Tailwind CSS  
**Target:** Desktop tool for a single product distributor (Windows + macOS)  
**Architecture:** Offline-first, local SQLite — no server, no GraphQL, no RBAC

---

## Directory Layout

```
src/
├── main/                                 # Electron Main Process (Node.js)
│   ├── index.ts                          # Window creation, app lifecycle, registers all IPC handlers
│   ├── updater.ts                        # Auto-update via electron-updater
│   │
│   ├── db/
│   │   ├── database.ts                   # SQLite singleton: getDb() / closeDb()
│   │   ├── schema.ts                     # Reads docs/schema.sql and calls db.exec()
│   │   └── migrations.ts                 # user_version-based schema upgrades
│   │
│   └── ipc/                              # One file per domain
│       ├── categories.ts                 # categories:getAll / create / update / delete
│       ├── customers.ts                  # customers:getAll / getById / create / update / delete
│       ├── suppliers.ts                  # suppliers:getAll / getById / create / update / delete
│       ├── products.ts                   # products:getAll / getById / create / update / delete
│       ├── flavors.ts                    # flavors:getAll / create / update / delete
│       ├── inventory.ts                  # inventory:getAll / getByProduct / adjust
│       ├── orders.ts                     # orders:getAll / getById / create / updateStatus / addItem / deductItem
│       ├── purchases.ts                  # purchases:getAll / getById / generate / updateStatus / receiveItem
│       └── debts.ts                      # debts:collectFromCustomer / repayToSupplier
│
├── preload/
│   └── index.ts                          # contextBridge: exposes typed window.api to renderer
│
└── renderer/
    ├── index.html                        # Vite HTML entry
    │
    └── src/
        ├── App.tsx                       # Root component: sidebar layout + router
        ├── main.tsx                      # ReactDOM.createRoot entry
        ├── index.css                     # Tailwind directives + design tokens
        │
        ├── assets/
        │   └── fonts/                    # Arabic + Latin font files
        │
        ├── components/
        │   ├── layout/
        │   │   ├── Sidebar.tsx           # Left navigation rail
        │   │   └── StatusBar.tsx         # Top bar: app name, current date, language switcher
        │   └── ui/
        │       ├── ChipMultiSelect.tsx   # Multi-select chip input (flavor picker)
        │       ├── LanguageSwitcher.tsx  # AR / EN toggle
        │       ├── ToggleSwitch.tsx      # Boolean toggle
        │       └── custom/
        │           ├── dialog/Dialog.tsx
        │           ├── modal/Modal.tsx
        │           └── toast/            # Toast notification system
        │
        ├── constants/
        │   └── NavLinks.ts              # Sidebar navigation items
        │
        ├── features/                    # Feature modules (one per domain)
        │   ├── customers/
        │   │   ├── CustomerList.tsx
        │   │   ├── CustomerForm.tsx
        │   │   └── CustomerDebtLedger.tsx
        │   │
        │   ├── suppliers/
        │   │   ├── SupplierList.tsx
        │   │   ├── SupplierForm.tsx
        │   │   └── SupplierDebtLedger.tsx
        │   │
        │   ├── products/
        │   │   ├── ProductList.tsx
        │   │   ├── ProductForm.tsx       # Includes flavor multi-select
        │   │   ├── CategoryTree.tsx
        │   │   └── FlavorList.tsx
        │   │
        │   ├── inventory/
        │   │   ├── InventoryTable.tsx    # Stock per (product, flavor)
        │   │   └── AdjustStockModal.tsx
        │   │
        │   ├── orders/
        │   │   ├── OrderList.tsx
        │   │   ├── OrderDetail.tsx       # Line items + deduction entry + status transitions
        │   │   ├── OrderForm.tsx         # Create new order
        │   │   └── OrderItemRow.tsx      # Inline flavor picker + deducted_qty input
        │   │
        │   ├── purchases/
        │   │   ├── PurchaseList.tsx
        │   │   ├── PurchaseDetail.tsx    # Receive delivery + received_qty entry
        │   │   └── GeneratePOModal.tsx   # End-of-day PO generation confirmation
        │   │
        │   ├── debts/
        │   │   ├── DebtCollectionForm.tsx
        │   │   └── DebtRepaymentForm.tsx
        │   │
        │   ├── reports/
        │   │   ├── DailySummary.tsx
        │   │   ├── OutstandingDebts.tsx
        │   │   └── InventoryReport.tsx
        │   │
        │   └── settings/
        │       └── SettingsPage.tsx
        │
        ├── lib/
        │   ├── i18n.ts                  # i18next setup (AR + EN)
        │   └── utils.ts                 # Formatting helpers (currency, dates)
        │
        └── types/
            ├── electron.d.ts            # window.api type augmentation
            └── Global.d.ts              # App-wide shared types
```

---

## IPC Channel Naming Convention

Channels follow the pattern `domain:action`:

| Channel | Direction | Description |
|---------|-----------|-------------|
| `customers:getAll` | Renderer → Main | Fetch all customers |
| `customers:create` | Renderer → Main | Insert new customer |
| `orders:create` | Renderer → Main | Insert new order (draft) |
| `orders:updateStatus` | Renderer → Main | Transition order status; handle credit side-effects |
| `orders:deductItem` | Renderer → Main | Update `deducted_qty` on an order item |
| `purchases:generate` | Renderer → Main | Auto-generate today's purchase orders |
| `purchases:receiveItem` | Renderer → Main | Set `received_qty`; update purchase status |
| `debts:collectFromCustomer` | Renderer → Main | Insert collection + decrement customer credit |
| `debts:repayToSupplier` | Renderer → Main | Insert repayment + decrement supplier credit |

All handlers return `{ success: boolean; data?: unknown; error?: string }`.

---

## Architectural Patterns

### IPC Bridge (Main ↔ Renderer)

The renderer never accesses Node.js or SQLite directly. All data flows through the
`contextBridge`-exposed `window.api` object.

```typescript
// src/preload/index.ts
contextBridge.exposeInMainWorld('api', {
  orders: {
    create:       (data) => ipcRenderer.invoke('orders:create', data),
    updateStatus: (id, status) => ipcRenderer.invoke('orders:updateStatus', id, status),
    deductItem:   (itemId, qty) => ipcRenderer.invoke('orders:deductItem', itemId, qty),
  },
  purchases: {
    generate: () => ipcRenderer.invoke('purchases:generate'),
  },
  // ... rest of domains
});
```

### Feature Module Pattern

Each feature module exposes its own pages, types, and hooks:

```
features/orders/
├── OrderList.tsx       # Route-level list page
├── OrderDetail.tsx     # Route-level detail page
├── OrderForm.tsx       # Create/edit form
├── OrderItemRow.tsx    # Reusable line-item component
├── hooks/
│   └── useOrders.ts   # IPC calls + local state
└── types.ts           # Order, OrderItem TypeScript interfaces
```

### Credit/Debt Invariant

Credit balances are never computed on the fly. They are maintained as running totals in
`customers.credit` and `suppliers.credit`, updated atomically inside `db.transaction()`
calls in the main process. The renderer only reads these values.
