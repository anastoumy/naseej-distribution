# Business Requirements Document (BRD)

## Naseej Lite — Desktop Distributor Management Tool

**Version:** 3.0  
**Last Updated:** 2026-06-08  
**Status:** Local-First Architecture (SQLite)

---

## 1. Executive Vision

Naseej Lite is a fast, reliable, offline-first desktop application for a single product
distributor. It replaces paper invoice books and spreadsheets with a structured, digital
workflow: enter customer orders, auto-generate supplier purchase orders at end of day,
track credit and debt, and export PDF invoices — all from a local Electron application
with no internet dependency.

**Mission:** Give a distributor a simple, modern desktop tool that eliminates manual
bookkeeping errors, tracks all customer and supplier balances accurately, and produces
professional PDF invoices.

---

## 2. Problem Statement

| Challenge | Impact | Naseej Lite Solution |
|-----------|--------|----------------------|
| Manual paper invoices | Errors, loss, no history | Digital order entry with PDF export |
| No purchase order system | Missed orders, supplier disputes | Auto-generate daily POs from confirmed orders |
| Informal credit tracking | Unknown balances, disputes | Running credit balance per customer and supplier |
| Supplier delivery shortfalls | Customer overbilling | `deducted_qty` per order line adjusts totals automatically |
| Disconnected from the internet | No cloud POS works | 100% offline; SQLite is the only data store |

---

## 3. Core Value Propositions

### 3.1 Works Offline, Always

All data lives in a local SQLite file. No cloud subscription, no server, no login.

### 3.2 Auto-Generated Purchase Orders

End-of-day PO generation groups all confirmed order items by supplier and creates a
purchase order per supplier — eliminating the manual aggregation step.

### 3.3 Accurate Credit Tracking

Customer and supplier credit balances are maintained as running totals, updated atomically
on every transaction. Debt ledgers provide a full timeline for dispute resolution.

### 3.4 PDF Invoice Workflow

Customer invoices and supplier purchase orders can be exported as PDF. Supplier invoice
PDFs can be imported and attached to purchase records.

---

## 4. Target User

A single product distributor (and their staff) who:
- Takes customer orders by phone or in person
- Sources products from a fixed set of suppliers
- Extends credit to customers and receives credit from suppliers
- Needs to track which customers owe money and which suppliers are owed
- Wants to produce professional PDF invoices and purchase orders

This is a **single-tenant** application — one distributor, one machine, one SQLite file.
There is no multi-tenancy, no RBAC, no merchant concept, no storefront.

---

## 5. Key Features

| Feature | Priority | Description |
|---------|----------|-------------|
| Customer management | P0 | CRUD with running credit balance |
| Supplier management | P0 | CRUD with running credit balance |
| Product catalog | P0 | Products with categories, supplier link, tax fields, and flavor variants |
| Flavor variants | P0 | Lightweight variant model (flavor/scent/type) linked to products and inventory |
| Inventory tracking | P0 | Stock per (product, flavor); manual adjustment |
| Order entry | P0 | Create customer invoices with line items; cash or credit payment type |
| Order status management | P0 | draft → confirmed → paid / cancelled |
| Deduction entry | P0 | Enter `deducted_qty` per line when supplier delivers short |
| Daily PO generation | P0 | Auto-group confirmed order items by supplier into purchase orders |
| Purchase delivery tracking | P0 | Enter `received_qty`; status → received / partially_received |
| PDF invoice export | P0 | Generate and save customer invoice PDFs |
| PDF PO export | P1 | Generate and save purchase order PDFs |
| Supplier invoice import | P1 | Attach supplier PDF to a purchase record |
| Debt collections | P0 | Record customer payments; decrement customer credit |
| Debt repayments | P0 | Record supplier payments; decrement supplier credit (distributor owes) |
| Reports | P1 | Daily summary, outstanding debts, inventory snapshot |
| Arabic / RTL support | P1 | Full right-to-left layout with i18next |
| Database backup | P1 | Export SQLite file to a user-chosen location |
| Settings | P1 | Company name, currency, invoice header/footer |

---

## 6. Out of Scope

The following are explicitly **not** in Naseej Lite:

- Multi-tenancy or `merchant_id` concept
- GraphQL or any HTTP API
- RBAC or role-based permissions
- Barcode scanner or ESC/POS printer integration
- Storefront or customer-facing portal
- Loyalty points or rewards system
- POS (point-of-sale) checkout flow
- Cloud sync or remote database

---

## 7. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| SQLite corruption | Low | High | WAL mode + atomic transactions + daily backup |
| Incorrect credit balance | Medium | High | All balance mutations in `db.transaction()`; integration tests |
| Partial PO generation | Low | High | Entire generation in one transaction — all-or-nothing |
| PDF library compatibility | Medium | Medium | Evaluate early in Phase 2; fallback to CSV export |
| User data privacy | Low | High | Local-only; no network calls; no telemetry |

---

## 8. Success Criteria (MVP)

1. Distributor can create a complete order, confirm it, and export a PDF invoice
2. End-of-day PO generation produces the correct purchase orders, grouped by supplier
3. Customer and supplier credit balances are always accurate
4. Delivery shortfalls flow correctly from `purchase_items.received_qty` to `order_items.deducted_qty`
5. Works fully offline — zero network calls required
6. Data persists correctly across application restarts
