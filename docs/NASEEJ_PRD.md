# Product Requirements Document (PRD)

## Naseej Lite — Desktop Distributor Management Application

**Version:** 3.0  
**Last Updated:** 2026-06-08  
**Status:** Active Development (Local SQLite Storage)

---

## 1. Executive Summary

Naseej Lite is a production-grade, standalone desktop application for a single product
distributor. Built with Electron + React, it uses a local SQLite database for all storage,
enabling complete offline operation. The application manages the full distributor workflow:
customer orders, auto-generated supplier purchase orders, delivery tracking, credit/debt
management, and PDF invoice export.

This is a **single-tenant** tool. There is no multi-tenancy, no GraphQL, no RBAC, and
no network requirement of any kind.

---

## 2. Target Users & Personas

| Persona | Role | Primary Need |
|---------|------|--------------|
| **Distributor** | Main operator | Enter orders, generate POs, track balances, export invoices |
| **Assistant** | Data entry support | Enter orders and mark deliveries; read-only reports |

---

## 3. System Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│         Naseej Lite — Desktop Application            │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │  Electron Main Process                       │  │
│  │  ├── SQLite Database (naseej.db)             │  │
│  │  │   └── Schema: docs/schema.sql             │  │
│  │  ├── IPC Handlers (one per domain)           │  │
│  │  └── PDF Generation / File I/O              │  │
│  └──────────────────────────────────────────────┘  │
│                         ↕ IPC                       │
│  ┌──────────────────────────────────────────────┐  │
│  │  React Renderer (UI)                         │  │
│  │  ├── Customers / Suppliers                   │  │
│  │  ├── Products / Categories / Flavors         │  │
│  │  ├── Inventory                               │  │
│  │  ├── Orders (Customer Invoices)              │  │
│  │  ├── Purchases (Supplier POs)                │  │
│  │  ├── Debt Management                         │  │
│  │  ├── Reports                                 │  │
│  │  └── Settings                               │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Technology Stack:**

| Layer | Technology |
|-------|-----------|
| Desktop Framework | Electron (Node.js + Chromium) |
| UI Framework | React 18+ with TypeScript |
| Database | SQLite 3 via `better-sqlite3` (local file, no server) |
| Schema | `docs/schema.sql` loaded idempotently at startup |
| Styling | Tailwind CSS |
| State Management | React Context + Hooks |
| Inter-process Communication | Electron IPC bridge (`ipcMain` / `contextBridge`) |
| Build / Bundle | Vite (`electron-vite`) |
| Packaging | `electron-builder` (Windows NSIS + macOS DMG) |
| i18n | `i18next` (Arabic RTL + English) |

---

## 4. Functional Requirements

### 4.1 Customer Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Create, view, edit, and delete customer records (name, phone) | P0 |
| FR-002 | Display running credit balance per customer | P0 |
| FR-003 | Customer debt ledger: timeline of credit orders and collections | P0 |

### 4.2 Supplier Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-010 | Create, view, edit, and delete supplier records (name, phone) | P0 |
| FR-011 | Display running credit balance per supplier (amount distributor owes) | P0 |
| FR-012 | Supplier debt ledger: timeline of purchases received on credit and repayments | P0 |

### 4.3 Product Catalog

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-020 | Create, view, edit, and delete products | P0 |
| FR-021 | Products have: title, category, supplier, price, wholesale_price, tax fields, image | P0 |
| FR-022 | Each product can be associated with zero or more global flavor labels | P0 |
| FR-023 | Hierarchical categories (parent/child) with CRUD | P0 |
| FR-024 | Global flavors list (create/rename); flavors are shared across products | P0 |

### 4.4 Inventory

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-030 | View current stock per `(product, flavor)` combination | P0 |
| FR-031 | Manually adjust stock quantity | P0 |
| FR-032 | Highlight zero or negative stock | P0 |

### 4.5 Orders (Customer Invoices)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-040 | Create an order: select customer, choose payment type (cash / credit) | P0 |
| FR-041 | Add line items: product, flavor (optional), quantity, unit price | P0 |
| FR-042 | Auto-calculate `tax_amount` per line using `products.sell_tax` | P0 |
| FR-043 | Auto-calculate and store order `total` on every item change | P0 |
| FR-044 | Status transitions: draft → confirmed → paid / cancelled | P0 |
| FR-045 | On confirming a credit order: `customers.credit += order.total` | P0 |
| FR-046 | Enter `deducted_qty` per line item when supplier delivers short | P0 |
| FR-047 | Effective quantity = `quantity - deducted_qty`; total recalculates | P0 |
| FR-048 | Export order as a PDF invoice; store path in `orders.invoice_pdf` | P0 |
| FR-049 | Filter order list by status, customer, payment type, date range | P0 |

### 4.6 Purchases (Supplier Purchase Orders)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-050 | Auto-generate daily POs: group confirmed order items by `supplier_id` | P0 |
| FR-051 | Each PO generated in one atomic transaction (all-or-nothing) | P0 |
| FR-052 | View purchase list with status, supplier, total, date | P0 |
| FR-053 | Enter `received_qty` per purchase item on delivery | P0 |
| FR-054 | Purchase status: pending → received / partially_received / cancelled | P0 |
| FR-055 | Export purchase order as PDF | P1 |
| FR-056 | Attach supplier invoice PDF to a purchase record | P1 |

### 4.7 Debt Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-060 | Record cash received from a customer: insert `debt_collections` + decrement `customers.credit` | P0 |
| FR-061 | Record cash paid to a supplier: insert `debt_repayments` + decrement `suppliers.credit` | P0 |
| FR-062 | Both operations must be atomic (transaction) | P0 |

### 4.8 Reports

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-070 | Daily orders summary: count, total value, cash vs. credit | P1 |
| FR-071 | Outstanding customer debts report | P1 |
| FR-072 | Outstanding supplier debts report | P1 |
| FR-073 | Inventory snapshot report with low/zero stock highlighted | P1 |

### 4.9 Data Persistence & Backup

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-080 | All data stored in `naseej.db` (SQLite) in Electron `userData` directory | P0 |
| FR-081 | Foreign keys enforced (`PRAGMA foreign_keys = ON`) | P0 |
| FR-082 | WAL journal mode enabled for crash safety | P0 |
| FR-083 | Backup function exports database to a user-chosen location | P1 |

---

## 5. Non-Functional Requirements

| Category | Requirement | Target |
|----------|-------------|--------|
| **Offline** | Full operation without internet | 100% of the time |
| **Performance** | IPC round-trip for a list query | < 200ms |
| **Reliability** | Zero data loss on unexpected shutdown | 100% (WAL + atomic tx) |
| **Compatibility** | Windows 10+ | ✅ |
| **Compatibility** | macOS 12+ | ✅ |
| **Accessibility** | RTL layout for Arabic | Full RTL via Tailwind + i18next |
| **Security** | Parameterized SQL queries only | No string interpolation in SQL |

---

## 6. Data Model Summary

See [`docs/schema.sql`](schema.sql) for the complete DDL and [`docs/DATA_MODELS_SCHEMAS.md`](DATA_MODELS_SCHEMAS.md) for narrative descriptions.

### Core Tables

| Table | Purpose |
|-------|---------|
| `categories` | Hierarchical product categories |
| `flavors` | Global flavor/scent/type labels |
| `suppliers` | Supplier directory with credit balance |
| `customers` | Customer directory with credit balance |
| `products` | Product catalog (linked to supplier for PO grouping) |
| `product_flavors` | Many-to-many: product ↔ flavor |
| `inventory` | Stock per `(product, flavor)` |
| `orders` | Customer invoices |
| `order_items` | Order lines with `deducted_qty` |
| `purchases` | Supplier purchase orders |
| `purchase_items` | PO lines with `received_qty` |
| `debt_collections` | Customer credit settlements |
| `debt_repayments` | Supplier debt repayments |
| `settings` | App configuration key/value |

---

## 7. Implementation Phases

See [`docs/IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) for the full phased plan.

| Phase | Focus | Duration |
|-------|-------|----------|
| 1 | Foundation & master data (customers, suppliers, products, inventory) | Weeks 1-3 |
| 2 | Orders (customer invoices) | Weeks 4-6 |
| 3 | Purchases (PO generation & delivery) | Weeks 7-9 |
| 4 | Debt management & reports | Weeks 10-12 |
| 5 | Polish, packaging, Arabic RTL | Weeks 13-15 |

---

## 8. Success Criteria

1. ✅ Distributor can create a complete order, confirm it, and export a PDF invoice
2. ✅ End-of-day PO generation produces correct purchase orders grouped by supplier
3. ✅ Customer and supplier credit balances are always accurate after every transaction
4. ✅ Delivery shortfalls flow correctly to customer order deductions
5. ✅ Works fully offline — no network calls required at any point
6. ✅ Data persists correctly across application restarts
7. ✅ Arabic RTL layout is complete and correct
