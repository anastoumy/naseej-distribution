# Naseej Lite — Implementation Strategy & Phased Plan

## Overview

This document outlines the phased implementation strategy for Naseej Lite, a standalone
desktop distributor management application using local SQLite storage.

**Technology Stack:** Electron · React · TypeScript · SQLite (`better-sqlite3`) · Tailwind CSS  
**Target:** Desktop application for a single product distributor (Windows + macOS)  
**Architecture:** Offline-first — 100% local SQLite, no server, no GraphQL, no RBAC

---

## Phase 1: Foundation & Core Data Entry (Weeks 1-3)

**Goal:** Set up the project skeleton and enable basic master-data management.

### Deliverables

| # | Task | Details |
|---|------|---------|
| 1.1 | Project scaffolding | Electron + Vite + React + TypeScript + Tailwind CSS |
| 1.2 | SQLite initialization | Load `docs/schema.sql` via `better-sqlite3`; WAL mode; FK enforcement |
| 1.3 | Migration system | `user_version` PRAGMA gating in `src/main/db/migrations.ts` |
| 1.4 | IPC framework | `contextBridge` preload; typed `window.api` surface; error envelope pattern |
| 1.5 | Suppliers module | List, create, edit, delete; display running credit balance |
| 1.6 | Customers module | List, create, edit, delete; display running credit balance |
| 1.7 | Flavors module | Global flavor CRUD (name must be unique) |
| 1.8 | Categories module | Hierarchical tree with parent selection |
| 1.9 | Products module | Full product form: title, category, supplier, prices, taxes, flavor selection |
| 1.10 | Inventory module | View stock per (product, flavor); manual quantity adjustment |

### Exit Criteria
- All master data can be created, edited, and deleted
- Products correctly associate with suppliers and flavors
- Inventory shows correct quantities per flavor variant
- Database persists across app restarts

---

## Phase 2: Orders (Customer Invoices) (Weeks 4-6)

**Goal:** Full order lifecycle from draft to paid/cancelled, including shortfall deductions.

### Deliverables

| # | Task | Details |
|---|------|---------|
| 2.1 | Order creation | Select customer, choose cash or credit, add line items with flavor |
| 2.2 | Order item management | Add / remove / edit quantity and unit price per line |
| 2.3 | Tax calculation | Auto-calculate `tax_amount` per line using `products.sell_tax` |
| 2.4 | Order total snapshot | Recalculate `orders.total` on every item change |
| 2.5 | Status transitions | `draft → confirmed → paid / cancelled` with guard rules |
| 2.6 | Credit logic | On confirming a `credit` order: `customers.credit += total` |
| 2.7 | Deduction entry | Enter `deducted_qty` per order item; recalculate total |
| 2.8 | Order list & filters | Filter by status, customer, date range |
| 2.9 | Invoice PDF export | Generate PDF from order data; store path in `orders.invoice_pdf` |

### Exit Criteria
- Cashier can create a complete order with multiple line items and flavors
- Credit orders correctly update the customer credit balance
- Deducting items recalculates the invoice total correctly
- PDF invoice can be exported and opened

---

## Phase 3: Purchase Orders (Weeks 7-9)

**Goal:** Auto-generate daily purchase orders from confirmed customer orders; track delivery.

### Deliverables

| # | Task | Details |
|---|------|---------|
| 3.1 | End-of-day PO generation | Group confirmed order items by `supplier_id`; atomic insert |
| 3.2 | Purchase list & filters | Filter by supplier, status, date range |
| 3.3 | Purchase detail view | Show supplier, items, quantities, status |
| 3.4 | Receive delivery | Enter `received_qty` per line; status → `received` / `partially_received` |
| 3.5 | Shortfall propagation | When `received_qty < quantity`, prompt deduction in linked order items |
| 3.6 | Purchase order PDF | Generate PDF; store path in `purchases.invoice_pdf` |
| 3.7 | Supplier invoice import | File-picker dialog to attach supplier's PDF to the purchase record |
| 3.8 | Cancel PO | Status → `cancelled`; no inventory or credit side-effects |

### Exit Criteria
- Single button generates one PO per supplier for the day's confirmed orders
- Receiving a partial delivery flows through to customer order deductions
- PDFs export correctly; supplier PDF attachments are stored and openable

---

## Phase 4: Debt Management & Reporting (Weeks 10-12)

**Goal:** Track customer credit collections, supplier repayments, and provide summary reports.

### Deliverables

| # | Task | Details |
|---|------|---------|
| 4.1 | Debt collection entry | Record cash received from customer; decrement `customers.credit` |
| 4.2 | Debt repayment entry | Record cash paid to supplier; decrement `suppliers.credit` |
| 4.3 | Customer debt ledger | Timeline of orders (credit) + collections for a customer |
| 4.4 | Supplier debt ledger | Timeline of purchases (credit) + repayments for a supplier |
| 4.5 | Daily summary | Orders confirmed, total value, cash vs. credit breakdown |
| 4.6 | Inventory report | Current stock levels; highlight zero or negative quantities |
| 4.7 | Outstanding debts report | All customers/suppliers with non-zero credit balances |
| 4.8 | Database backup | Export `naseej.db` to a user-chosen location |

### Exit Criteria
- Customer and supplier balances update correctly after every transaction
- Reports are accurate and printable / exportable as PDF
- Backup creates a valid `.db` file that can be restored

---

## Phase 5: Polish & Deployment (Weeks 13-15)

**Goal:** Production-ready packaging, error handling, and user experience refinement.

### Deliverables

| # | Task | Details |
|---|------|---------|
| 5.1 | Input validation | All forms validate before IPC call; server-side re-validation in handler |
| 5.2 | Error handling | All IPC handlers return `{ success, data?, error? }` envelope |
| 5.3 | Arabic / RTL support | i18next translations; Tailwind `dir="rtl"` layout |
| 5.4 | Settings screen | Company name, currency, default tax, invoice header/footer |
| 5.5 | Auto-update | `electron-updater` for seamless patch delivery |
| 5.6 | Windows installer | NSIS installer via `electron-builder` |
| 5.7 | macOS DMG | Code-signed DMG via `electron-builder` |
| 5.8 | QA & testing | IPC integration tests; E2E order → purchase cycle |

### Exit Criteria
- Zero crashes in a full-day simulation
- Both Windows and macOS installers install and run correctly
- Arabic UI is fully right-to-left
- Auto-update delivers patches without data loss

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| SQLite corruption | WAL mode + atomic transactions + daily backup |
| Incorrect credit balance | All balance mutations inside `db.transaction()` |
| Partial PO generation failure | Entire generation is one transaction; all-or-nothing |
| PDF library compatibility | Evaluate `pdf-lib` or `pdfkit` early in Phase 2 |
| Large order volumes | Indexes on `created_at`, `status`, `customer_id`, `supplier_id` |

---

## Development Environment

**Prerequisites:**
- Node.js 18+ LTS
- npm 9+
- SQLite 3 (bundled via `better-sqlite3`)

**Local Setup:**
```bash
git clone <repo>
cd naseej-accounting
npm install
npm run dev         # Start with hot reload
npm run build       # Build for production
npm run make        # Package installers
```
