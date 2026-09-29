# Naseej Distribution — Project Completion Plan

**Document version:** 1.0  
**Date:** June 27, 2026  
**Status:** Master roadmap for completing the application  
**Scope:** Analysis-only deliverable — no source code was modified to produce this document.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Summary](#2-architecture-summary)
3. [Current Status](#3-current-status)
4. [Existing Features](#4-existing-features)
5. [Missing Features & Gaps vs. Business Requirements](#5-missing-features--gaps-vs-business-requirements)
6. [Code Quality Review](#6-code-quality-review)
7. [Database Review](#7-database-review)
8. [UI / UX Review](#8-ui--ux-review)
9. [Open Questions](#9-open-questions)
10. [Recommended Development Phases](#10-recommended-development-phases)
11. [Technical Improvements](#11-technical-improvements)
12. [Final Production Checklist](#12-final-production-checklist)

---

## 1. Project Overview

**Naseej Distribution** (also referred to in the codebase as *Naseej POS* / *Naseej Lite*) is an offline-first **Electron desktop application** for an internal distribution business. Employees receive customer orders via WhatsApp, enter them into the app, and the system manages:

- Customer orders (customer invoices)
- Supplier purchase invoices (grouped by supplier)
- Credit balances for customers and suppliers
- Flexible payments (partial, full, or overpayment)
- Product catalog, inventory, and operational reporting

The stack is **Electron + React 18 + TypeScript + SQLite (`better-sqlite3`) + Tailwind CSS + i18next (Arabic/English)**. All data lives locally in `naseej.db` under the Electron user-data directory. There is no server, authentication layer, or network dependency for core operations.

**Primary design principle:** Speed and operational efficiency over visual complexity. The register/POS screen is the most critical daily workflow.

---

## 2. Architecture Summary

### 2.1 Overall Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                     │
│  src/main/index.ts                                           │
│  ├── Window lifecycle, asset:// protocol, auto-backup         │
│  ├── SQLite singleton (getDb / closeDb)                      │
│  └── IPC handlers (src/main/ipc/*.ts) — one file per domain  │
└──────────────────────────┬──────────────────────────────────┘
                           │ ipcMain.handle / ipcRenderer.invoke
┌──────────────────────────▼──────────────────────────────────┐
│                    Preload (contextBridge)                   │
│  src/preload/index.ts → window.api                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              Renderer (React + Vite)                         │
│  src/renderer/src/                                           │
│  ├── App.tsx — view routing via activeView state             │
│  ├── features/* — domain modules (screens, hooks, forms)     │
│  ├── hooks/* — shared hooks (useOrder, useProduct, etc.)     │
│  ├── lib/controllers.ts — typed IPC wrappers                 │
│  └── components/ — layout, POS, UI primitives                │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Electron Structure

| Component | Location | Notes |
|-----------|----------|-------|
| Main entry | `src/main/index.ts` | Frameless window, daily backup on launch, domain handler registration |
| Preload | `src/preload/index.ts` | Exposes `window.api` with typed domain namespaces |
| Renderer entry | `src/renderer/src/main.tsx` | React root, i18n init |
| Packaging | `electron-builder.yml` | macOS DMG + Windows NSIS + auto-update URL |
| Updater | `src/main/updater.ts` | Production-only `electron-updater` |

### 2.3 Frontend Organization

The renderer follows a **feature-module pattern**:

```
features/
  categories/   customers/   suppliers/   products/
  flavors/      inventory/   orders/      debts/
screens/
  RegisterScreen.tsx          ← POS (full-bleed, no padding)
components/
  layout/   pos/   ui/
lib/
  controllers.ts   utils.ts   i18n.ts
constants/
  NavLinks.ts                 ← 3 layouts: sales, catalog, operations
```

Navigation uses **local React state** (`activeView`, `activeLayout`) — no React Router. Three layout groups:

- **Sales:** Register (POS), Orders
- **Catalog:** Products, Categories, Flavors, Inventory
- **Operations:** Customers, Suppliers, Purchases, Debts

### 2.4 Backend / Main Process Organization

Each domain has a dedicated IPC file returning `{ success, data?, error? }`:

| IPC Module | Channels |
|------------|----------|
| `categories.ts` | CRUD |
| `flavors.ts` | CRUD |
| `suppliers.ts` | CRUD + credit field |
| `customers.ts` | CRUD + credit field |
| `products.ts` | CRUD + image handling + flavor junction |
| `inventory.ts` | getAll, adjust, setQty |
| `order.ts` | CRUD, checkout, status, addItem, deductItem |
| `purchases.ts` | getAll, generate, updateStatus, receiveItem |
| `debts.ts` | collections, repayments, ledgers, outstanding |

Database layer:

- `src/main/db/database.ts` — singleton, WAL mode, FK enforcement
- `src/main/db/schema.ts` — idempotent `CREATE TABLE IF NOT EXISTS`
- `src/main/db/migrations.ts` — versioned migrations (currently v1–v2)
- `src/main/db/backup.ts` — daily backup + 7-day retention
- `src/main/db/imageHandler.ts` — product images via Sharp

### 2.5 Database Architecture

SQLite file: `{userData}/naseej.db`

Core entity graph:

```
categories ──< products >── suppliers
                  │
                  ├──< product_flavors >── flavors
                  ├──< inventory (product_id, flavor_id)
                  │
orders (customer invoices) ──< order_items
                  │
                  └── triggers purchase grouping by products.supplier_id

purchases (supplier POs) ──< purchase_items

customers.credit  ←── orders (debt) + debt_collections
suppliers.credit  ←── purchase receive + debt_repayments
```

### 2.6 Data Flow (Typical Order Checkout)

```
RegisterScreen
  → useOrder.checkoutOrder()
    → orderController.checkout() [renderer]
      → window.api.orders.checkout [preload]
        → orders:checkout [main/ipc/order.ts]
          → INSERT orders + order_items
          → resolveCheckoutState() → status + payment_type
          → UPDATE customers.credit if debt > 0
```

**Not wired today:** automatic purchase invoice creation, inventory decrement, PDF generation, wholesale price logic.

---

## 3. Current Status

### 3.1 Overall Completion Estimate

| Area | Estimate | Notes |
|------|----------|-------|
| Core infrastructure (Electron, DB, IPC, i18n) | **90%** | Solid foundation |
| Master data (catalog) | **90%** | CRUD complete for all entities |
| POS / Register | **55%** | Functional checkout; missing key business rules |
| Customer orders (management) | **75%** | List, detail, deductions, status — no PDF |
| Purchase invoices | **35%** | Backend partial; **no UI**; logic differs from BRD |
| Credit / payments / debts | **70%** | Checkout + debt screens; edge cases open |
| Reports | **5%** | Dashboard component exists but unwired |
| Settings | **5%** | Table only |
| PDF / printing | **0%** | Schema columns exist, no implementation |
| Testing & polish | **15%** | Vitest configured, zero project tests |
| **Overall** | **~58%** | Usable for catalog + basic sales; not production-ready |

### 3.2 Implemented Features (Summary)

See [Section 4](#4-existing-features) for the full list.

### 3.3 Missing Features (Summary)

See [Section 5](#5-missing-features--gaps-vs-business-requirements) for the full list.

---

## 4. Existing Features

### 4.1 Application Shell

- [x] Frameless Electron window with custom title bar controls
- [x] Three-layout sidebar navigation (Sales / Catalog / Operations)
- [x] Status bar component
- [x] Toast notification system
- [x] Error boundary component
- [x] Arabic + English i18n with RTL-capable structure
- [x] Language switcher
- [x] Dark theme via Tailwind CSS variables

### 4.2 Database & Infrastructure

- [x] SQLite schema with foreign keys, WAL mode, indexes
- [x] Migration system with `schema_version` tracking
- [x] Daily automatic database backup (7-day retention)
- [x] Manual backup IPC (`backup:create`, `backup:list`)
- [x] Product image storage and `asset://` protocol serving
- [x] Auto-updater scaffold (production builds)

### 4.3 Catalog / Master Data

- [x] **Categories** — hierarchical CRUD with parent_id
- [x] **Flavors** — global flavor CRUD (unique names)
- [x] **Suppliers** — CRUD with running credit balance display
- [x] **Customers** — CRUD with running credit balance display
- [x] **Products** — full form: title, category, supplier, retail/wholesale prices, taxes, flavors, image upload
- [x] **Inventory** — view stock per (product, flavor); manual adjust/set quantity

### 4.4 Sales / POS (Register)

- [x] Product grid with images
- [x] Instant text search (title, category, supplier, price)
- [x] Cart: add, quantity +/- , remove, clear
- [x] Customer attach via search modal
- [x] Flat discount input (UI-level)
- [x] Tax display (computed from `sell_tax` in UI)
- [x] Payment modal with flexible amount (full / partial / zero)
- [x] Checkout creates order + items in one transaction
- [x] Credit debt auto-added to `customers.credit` on checkout
- [x] Receipt modal (on-screen, not PDF)
- [x] Keyboard shortcut F12 to open payment; Escape to close modals

### 4.5 Orders (Customer Invoices)

- [x] Order list with filters (status, payment type, customer, search)
- [x] Order detail panel with line items
- [x] Create / edit draft orders via modals
- [x] Status transitions (draft → confirmed → paid / partially_paid / cancelled)
- [x] Deduction entry (`deducted_qty`) with total recalculation
- [x] Delete draft orders only
- [x] Order total recalculation on backend

### 4.6 Purchases (Backend Only)

- [x] `purchases:getAll`, `getById`
- [x] `purchases:generate` — batch groups confirmed order items by supplier
- [x] `purchases:updateStatus`, `receiveItem`, `delete`
- [x] Supplier credit updated on item receive
- [x] Purchase status auto-recalculated (pending / partially_received / received)

### 4.7 Debts & Payments

- [x] Outstanding customer and supplier debt lists
- [x] Customer ledger (orders + collections)
- [x] Supplier ledger (received purchases + repayments)
- [x] Collect payment from customer (decrements credit)
- [x] Repay supplier (decrements credit)
- [x] Recent transactions sidebar

### 4.8 Built but Not Integrated

- [x] `DashboardScreen` — stats for customers, suppliers, products, debts, inventory preview (**not linked in `App.tsx` navigation**)

---

## 5. Missing Features & Gaps vs. Business Requirements

### 5.1 Critical — Core Business Workflow

| # | Requirement | Current State | Gap Severity |
|---|-------------|---------------|--------------|
| 1 | **Auto-add to open supplier purchase invoice on each customer order** | Batch end-of-day `purchases:generate()` creates new POs from all `confirmed` orders; no merge into existing open invoices; **not triggered on checkout** | 🔴 Critical |
| 2 | **Create new purchase invoice when supplier's current invoice is submitted** | No `submitted` status on purchases; only pending/received/partially_received/cancelled | 🔴 Critical |
| 3 | **Wholesale price when ≥ 6 units of same product** | POS always uses `product.price` (retail) | 🔴 Critical |
| 4 | **Manual unit price override at POS** | Not available in cart | 🔴 Critical |
| 5 | **POS filters: supplier, category, flavor** | Search only | 🟠 High |
| 6 | **Quick customer creation without leaving register** | Search/attach only; must go to Customers screen | 🟠 High |
| 7 | **Flavor selection when adding product to cart** | Ignores `product_flavors`; adds base product only | 🟠 High |

### 5.2 Purchase Invoices UI & Lifecycle

| # | Requirement | Current State |
|---|-------------|---------------|
| 8 | Purchases screen | `ComingSoon` placeholder in `App.tsx` |
| 9 | View / manage open purchase invoices per supplier | No UI |
| 10 | Mark purchase invoice as "submitted/ordered" to supplier | No status or workflow |
| 11 | Link order items → purchase items (prevent double-generation) | No junction/flag table |
| 12 | Shortfall propagation UI (receive → deduct on customer order) | Backend supports `deducted_qty`; no purchase-driven workflow |

### 5.3 Payments & Credit

| # | Requirement | Current State |
|---|-------------|---------------|
| 13 | Payment greater than invoice → remainder updates balance (prepayment) | Treated as **change due**, not customer credit reduction/increase |
| 14 | Payments not tied to specific invoice | Standalone debt collections (acceptable pattern, but no invoice allocation) |
| 15 | Debt collection capped at outstanding balance | Enforced — may conflict if prepayments are desired |

### 5.4 Orders & Checkout Integration Bugs

| # | Issue | Detail |
|---|-------|--------|
| 16 | POS checkout statuses vs. PO generation | Checkout sets `paid` / `partially_paid` / `confirmed`; `purchases:generate` only reads `status = 'confirmed'` — **POS-completed orders are excluded from PO generation** |
| 17 | Discount not persisted correctly | Discount applied in UI total but order line items don't reflect it; `total_price` passed from frontend may disagree with sum of line items |
| 18 | Tax not persisted | UI calculates tax; checkout sends `tax_amount: 0` for all items |
| 19 | Inventory not decremented on sale | No stock check or deduction on checkout |

### 5.5 Reports & Documents

| # | Requirement | Current State |
|---|-------------|---------------|
| 20 | Customer invoice PDF | `orders.invoice_pdf` column unused |
| 21 | Supplier purchase PDF | `purchases.invoice_pdf` column unused |
| 22 | Reports: outstanding balances, history, orders by customer/supplier | No reports module |
| 23 | Dashboard in navigation | Component exists, not routed |

### 5.6 Settings & Admin

| # | Requirement | Current State |
|---|-------------|---------------|
| 24 | Settings screen (company info, currency, tax defaults) | `settings` table exists; no IPC or UI |
| 25 | User / staff management | Not in scope of schema; logout throws `Error("Function not implemented.")` |
| 26 | Backup restore UI | Backup create/list IPC only |

### 5.7 POS Polish (from BRD)

| # | Requirement | Current State |
|---|-------------|---------------|
| 27 | Keyboard-first workflow (F1 search focus, barcode) | F12 pay only; F1 mentioned in empty cart but not implemented; barcode types declared in `electron.d.ts` but not wired |
| 28 | Edit price per cart line | Not implemented |
| 29 | Per-line discounts | `discountAmount` on cart item exists in types but always 0 |

---

## 6. Code Quality Review

### 6.1 Good Implementations

- **Consistent IPC envelope** — `{ success, data?, error? }` used throughout main handlers
- **Transactional mutations** — order checkout, debt collection, purchase receive wrap in `db.transaction()`
- **Feature module structure** — clear separation of screens, hooks, forms, controllers per domain
- **Typed preload bridge** — `Global.d.ts` + `electron.d.ts` provide renderer type safety
- **Idempotent schema** — safe re-runs on every launch
- **Image handling** — graceful fallback if image save fails during product create
- **i18n integration** — most screens use `useTranslation()`
- **Order calculations** — shared utilities in `orderCalculations.ts` for line/total math

### 6.2 Potential Improvements

| Area | Issue | Recommendation |
|------|-------|----------------|
| State management | Each hook fetches independently; no shared cache | Consider React Context or lightweight store for catalog data used across POS + orders |
| Hook duplication | `hooks/useProduct.ts` vs `features/products/hooks/useProducts.ts`; similar for customers | Consolidate into feature hooks; keep thin re-exports if needed |
| Controller layer | `lib/controllers.ts` is 330+ lines monolith | Split per domain matching feature folders |
| Validation | Minimal server-side validation; Zod in dependencies but unused | Add Zod schemas shared between IPC handlers |
| Error handling | IPC catches return strings; no structured error codes | Add error codes for UI branching |
| Naming | Package `naseej-pos`, folder `naseej-accounting`, docs `Naseej Lite` | Align product name across repo |

### 6.3 Duplicate Logic

- Customer fetching: `hooks/useCustomer.ts` (fetch-on-demand) vs `features/customers/hooks/useCustomers.ts` (CRUD hook) — overlapping concerns
- Product list loading duplicated between Register (`hooks/useProduct`) and Products screen (`features/products/hooks/useProducts`)
- Credit balance display logic repeated across Customers, Suppliers, Debts, Dashboard screens

### 6.4 Dead / Stub Code

- `App.tsx` — `onLogout` throws unimplemented error
- `electron.d.ts` — `discounts.validate`, `onBarcodeScanned` declared but not in preload
- `bcryptjs` in `package.json` — no usage found in `src/`
- `DashboardScreen` — complete but unreachable
- `discountCode` state in RegisterScreen — collected but only stored in notes string

### 6.5 Possible Bugs

| Bug | Location | Impact |
|-----|----------|--------|
| PO generation excludes POS orders | `purchases.ts` filters `status = 'confirmed'` only | Purchase invoices never auto-populated from register sales |
| `orders:updateStatus` credit on confirm | Only adds credit when `payment_type === 'credit'` | Checkout already adds credit; confirming again could double-count in legacy flow |
| Inventory `flavor_id IS ?` null comparison | `inventory.ts` | SQLite NULL comparison works with `IS` but easy to get wrong with `=` |
| Order delete on customer with orders | `customers:delete` has no FK guard message | May fail with opaque SQLite FK error |
| Total mismatch on checkout | Frontend passes `total_price` including discount/tax; backend recalculates from items | Stored total may differ from line sum |
| Stock limit in POS | `stockQty: Number.MAX_SAFE_INTEGER` hardcoded | Increase button never disabled realistically |

### 6.6 Performance Considerations

- Product grid loads all products on register mount — acceptable for hundreds of SKUs; consider virtualized grid at 1000+
- `products:getAll` uses `GROUP_CONCAT` for flavors — fine at current scale
- Indexes already exist on common filter columns — good
- No FTS index for product search — text `LIKE`/`includes` only

### 6.7 Maintainability Concerns

- Business logic split between POS frontend and IPC without shared pricing module
- Purchase generation logic will need significant rewrite to match BRD — risk of regression without tests
- Documentation (`docs/`) references `docs/schema.sql` as source of truth but schema lives in `src/main/db/schema.ts` — docs drift

---

## 7. Database Review

### 7.1 Tables

| Table | Purpose | Status |
|-------|---------|--------|
| `categories` | Hierarchical categories | ✅ Complete |
| `flavors` | Product flavor dimension | ✅ Complete |
| `suppliers` | Supplier directory + credit | ✅ Complete |
| `customers` | Customer directory + credit | ✅ Complete |
| `products` | Catalog with supplier link | ✅ Complete |
| `product_flavors` | M2M with per-flavor price | ✅ Complete |
| `inventory` | Stock per (product, flavor) | ✅ Complete (manual only) |
| `orders` | Customer invoices | ✅ Complete |
| `order_items` | Line items + deductions | ✅ Complete |
| `purchases` | Supplier POs | ⚠️ Missing submitted status |
| `purchase_items` | PO line items | ✅ Complete |
| `debt_collections` | Customer payments | ✅ Complete |
| `debt_repayments` | Supplier payments | ✅ Complete |
| `settings` | Key-value config | ⚠️ Unused |
| `schema_version` | Migrations | ✅ Complete |

### 7.2 Relationships

- Products → Suppliers: nullable FK (`supplier_id`) — **should be NOT NULL** per business rule ("every product belongs to exactly one supplier")
- Products → Categories: optional — acceptable
- Orders → Customers: required — correct
- No direct link between `order_items` and `purchase_items` — **needed for incremental PO workflow**

### 7.3 Indexes

Existing indexes cover: categories.parent, products.supplier/category/title, orders.customer/status/date, purchases.supplier, debt tables. Adequate for current scale.

**Suggested additions:**

- `purchase_items(product_id, flavor_id)` — for aggregation queries
- `purchases(supplier_id, status)` — composite for "open invoice per supplier" lookup
- `order_items(order_id, product_id)` — line item lookups

### 7.4 Normalization

Generally well-normalized. Denormalized `credit` fields on customers/suppliers are intentional running balances (must stay in sync via transactions).

### 7.5 Missing Entities / Columns

| Proposed Addition | Reason |
|-------------------|--------|
| `purchases.status` value `'submitted'` or separate `submitted_at` column | Distinguish open vs. sent-to-supplier invoices per BRD |
| `order_items.purchase_item_id` or `order_item_allocations` junction | Track which items have been added to a PO; prevent re-generation |
| `orders.discount_total` | Persist cart-level discount |
| `products.barcode` | Referenced in electron.d.ts comments for Phase 4 |
| `payment_allocations` (optional) | Link payments to specific invoices if required |
| Inventory auto-seed on product/flavor create | Currently manual only |

### 7.6 Potential Improvements

- Add CHECK constraint: `products.supplier_id IS NOT NULL` (after data migration)
- Add trigger or application rule to recalculate `customers.credit` from ledger (reconciliation job)
- Consider `order_items.unit_price` CHECK against wholesale/retail audit log for price overrides

---

## 8. UI / UX Review

### 8.1 Navigation

**Strengths:** Compact icon sidebar; layout grouping matches mental model (sell → catalog → operations).

**Gaps:**

- No Dashboard entry despite component existing
- No Reports or Settings in nav
- Purchases shows "Coming Soon" — blocks critical workflow
- Logout button visible but broken

### 8.2 Consistency

**Strengths:** Shared modal/dialog/toast patterns; consistent table layouts across CRUD screens; unified `formatJOD` currency formatting.

**Gaps:**

- Register screen uses English-heavy labels ("Cart", "Attach Customer") mixed with i18n keys
- Operations screens fully translated; POS partially hardcoded
- Products screen uses table; Register uses grid — intentional but flavor info not shown on grid cards

### 8.3 Workflow Efficiency

| Workflow | Rating | Notes |
|----------|--------|-------|
| Product CRUD | ⭐⭐⭐⭐ | Fast modals, good forms |
| Customer order via Register | ⭐⭐⭐ | Works but missing filters, flavor, pricing rules |
| Customer attach | ⭐⭐ | Extra modal step; no inline create |
| Purchase invoice management | ⭐ | Not available |
| Debt collection | ⭐⭐⭐⭐ | Good tabbed UI with ledger drill-down |
| Order management | ⭐⭐⭐⭐ | Solid list + detail + deductions |

### 8.4 Recommended UX Improvements

1. **Register:** Sticky filter chips (supplier / category / flavor) above product grid
2. **Register:** Inline "+ New Customer" in customer search modal (name + phone, 2 fields)
3. **Register:** Click cart line → edit qty + price inline
4. **Register:** Show wholesale badge when qty ≥ 6
5. **Purchases:** Default landing = open invoices per supplier with item counts
6. **Global:** Wire Dashboard as first item in Operations layout
7. **Keyboard:** F1 → focus product search; F2 → focus customer; Enter on cart → pay

---

## 9. Open Questions

These requirements are ambiguous between the BRD (`docs/Prompt.md`) and the existing codebase/docs. Resolve before implementing affected phases.

| # | Question | Options |
|---|----------|---------|
| OQ-1 | **Purchase invoice trigger:** On every order checkout, or also batch end-of-day? | He Ordered All the Purchase Products on the end of the day but the moment he add an order the Order Should be added to the Invoice |
| OQ-2 | **What defines "submitted" purchase invoice?** | New status value vs. timestamp vs. manual lock button |
| OQ-3 | **Overpayment handling:** Customer pays 100 JOD on 80 JOD order — is 20 JOD change returned, or 20 JOD credit balance reduction (prepayment)? | BRD says "remaining amount updates balance" — implies prepayment/credit, not physical change |
| OQ-4 | **Inventory tracking:** Is stock enforced at POS, or is inventory informational only? | Currently not enforced |
| OQ-5 | **Tax model:** Per-unit `sell_tax`, percentage, or fixed? Should tax be stored per line item? | Schema has multiple tax fields; POS computes per-unit flat tax |
| OQ-6 | **Discount scope:** Order-level only, or per-line + order-level? | UI has order-level only |
| OQ-7 | **User/staff accounts:** Required for production? | Logout stub exists; bcrypt in deps suggests planned auth |
| OQ-8 | **Product `price` vs `product_flavors.price`:** Which is retail when flavors differ? | POS uses product.price only |
| OQ-9 | **Purchase unit cost:** Use `wholesale_price` (current) or supplier invoice cost on receive? | Currently wholesale at generation time |
| OQ-10 | **Naming:** Official product name — Naseej Distribution, Naseej POS, or Naseej Lite? | Affects packaging and i18n keys |

---

## 10. Recommended Development Phases

Phases are ordered by business impact and dependency chain. Each phase includes objective, tasks, dependencies, files likely affected, complexity, risks, and acceptance criteria.

---

### Phase 1 — Fix Core Order → Purchase Pipeline

**Objective:** Align the most critical business workflow — customer order automatically updates the correct open supplier purchase invoice.

**Priority:** 🔴 Must complete before production

#### Tasks

1. Add `submitted` status (or `submitted_at` column) to `purchases` table via migration
2. Create `syncOrderToPurchases(orderId)` service in main process:
   - For each order item, resolve `products.supplier_id`
   - Find existing `pending` + not-submitted purchase for that supplier
   - If found: upsert line items (merge quantities for same product+flavor)
   - If not found: create new purchase + items
3. Call sync from `orders:checkout` and optionally `orders:updateStatus` when confirming
4. Add `order_items.fulfilled_to_purchase` flag or allocation table to prevent double-counting in batch `generate`
5. Fix status filter: include `paid`, `partially_paid`, and `confirmed` orders in purchase sync (exclude `draft`, `cancelled`)
6. Deprecate or refactor `purchases:generate` as "reconciliation/repair" tool rather than primary path

#### Dependencies

- None (foundational)

#### Files Likely Affected

- `src/main/db/migrations.ts`
- `src/main/db/schema.ts`
- `src/main/ipc/order.ts`
- `src/main/ipc/purchases.ts`
- New: `src/main/services/purchaseSync.ts`

#### Estimated Complexity

**High** (3–5 days)

#### Potential Risks

- Race conditions if two orders checkout simultaneously for same supplier — mitigate with transaction-level locking
- Existing deployments may have orphaned confirmed orders — need one-time backfill migration

#### Acceptance Criteria

- [ ] Customer 1 order for Supplier A products → creates Purchase Invoice A
- [ ] Customer 2 order for Supplier A while invoice open → items merged into same invoice
- [ ] After marking invoice submitted → next order creates new invoice number
- [ ] Cancelled orders do not add to purchases
- [ ] Idempotent: re-processing same order does not duplicate purchase lines

---

### Phase 2 — POS Completion (Pricing, Filters, Customer UX)

**Objective:** Make the register screen match BRD operational requirements for high-volume daily entry.

**Priority:** 🔴 Must complete before production

#### Tasks

1. **Wholesale pricing rule:** When cart quantity for same product ≥ 6, auto-switch `unitPrice` to `wholesale_price` (with visual indicator)
2. **Manual price override:** Tap cart line → edit unit price (with optional manager note)
3. **Flavor picker:** If product has flavors, show quick picker before adding to cart; use `product_flavors.price` when set
4. **Filter bar:** Supplier dropdown, category dropdown, flavor dropdown — combinable with search
5. **Quick customer create:** "+ New" in customer modal → name + phone → auto-attach
6. **Persist tax and discount:** Send correct `tax_amount` per line; add `orders.discount_total` column; backend recalculates authoritative total
7. **Keyboard shortcuts:** F1 product search, F2 customer, F12 pay (existing)
8. **Overpayment → credit:** When `amountPaid > total`, reduce customer credit by overpayment amount (per OQ-3 resolution)

#### Dependencies

- Phase 1 (purchase sync should use final line prices)

#### Files Likely Affected

- `src/renderer/src/screens/RegisterScreen.tsx`
- `src/renderer/src/hooks/useOrder.ts`
- `src/main/ipc/order.ts`
- `src/main/db/migrations.ts`
- `src/renderer/content/en.json`, `ar.json`

#### Estimated Complexity

**High** (4–6 days)

#### Potential Risks

- Price override audit trail may be needed for disputes
- Wholesale threshold logic with flavors (6 of same product vs. same flavor) — clarify in OQ

#### Acceptance Criteria

- [ ] 5 units → retail price; 6th unit triggers wholesale for that product line
- [ ] Employee can override price manually
- [ ] Products with flavors prompt selection
- [ ] Filters reduce grid instantly
- [ ] New customer creatable in ≤ 2 fields without leaving register
- [ ] Order stored total matches line items + tax − discount

---

### Phase 3 — Purchase Invoices UI

**Objective:** Full supplier purchase invoice management screen.

**Priority:** 🔴 Must complete before production

#### Tasks

1. Create `features/purchases/` module (mirror orders structure)
2. **PurchasesScreen:** list with filters (supplier, status, date)
3. **PurchaseDetailPanel:** line items, quantities, received qty, status actions
4. **Submit to supplier** action → sets submitted status (locks from auto-merge)
5. **Receive delivery** UI → calls `purchases:receiveItem`
6. **Cancel** pending purchase
7. Wire into `App.tsx` replacing `ComingSoon`
8. Optional: prompt to deduct customer order when received qty < ordered qty

#### Dependencies

- Phase 1 (submitted status + sync)

#### Files Likely Affected

- New: `src/renderer/src/features/purchases/**`
- `src/renderer/src/App.tsx`
- `src/preload/index.ts` (if new IPC channels needed)
- `src/main/ipc/purchases.ts`

#### Estimated Complexity

**Medium–High** (4–5 days)

#### Potential Risks

- UX complexity for partial receives across multiple customer orders

#### Acceptance Criteria

- [ ] Employee can view all open purchase invoices grouped by supplier
- [ ] Can submit, receive, and cancel from UI
- [ ] Received quantities update supplier credit correctly
- [ ] Status badges match backend state

---

### Phase 4 — PDF Invoices & Printing

**Objective:** Generate printable customer invoices and supplier purchase orders.

**Priority:** 🟠 High

#### Tasks

1. Evaluate and add PDF library (`pdf-lib` or `pdfkit`)
2. Create `src/main/services/pdf/` for templates
3. IPC: `orders:exportPdf`, `purchases:exportPdf`
4. Store path in `invoice_pdf` columns
5. Print dialog integration via Electron
6. Receipt modal → "Print / Save PDF" button
7. Settings-driven header/footer (company name, phone) — depends on Phase 7

#### Dependencies

- Phase 2 (stable order totals)
- Phase 3 (purchase detail view for export trigger)

#### Files Likely Affected

- New: `src/main/services/pdf/**`
- `src/main/ipc/order.ts`, `purchases.ts`
- `src/preload/index.ts`
- `src/renderer/src/components/pos/ReceiptModal.tsx`
- `package.json`

#### Estimated Complexity

**Medium** (3–4 days)

#### Potential Risks

- Arabic RTL in PDF requires font embedding
- macOS vs Windows print dialog differences

#### Acceptance Criteria

- [ ] Customer invoice PDF opens with correct line items, totals, customer info
- [ ] Purchase order PDF groups by supplier with quantities
- [ ] PDF path persisted and re-openable from order/purchase detail

---

### Phase 5 — Reports & Dashboard

**Objective:** Answer operational questions without manual SQL.

**Priority:** 🟠 High

#### Tasks

1. Wire `DashboardScreen` into navigation (Operations layout default or new "Insights" layout)
2. Create `features/reports/` with:
   - Outstanding customer balances (exists in debts — link/reuse)
   - Outstanding supplier balances
   - Orders by customer (date range filter)
   - Orders by supplier (via product supplier_id)
   - Purchase invoice history
   - Payment history
3. Backend: add report IPC queries or single `reports:*` module
4. Export to CSV/PDF for each report

#### Dependencies

- Phases 1–3 (accurate data)

#### Files Likely Affected

- New: `src/main/ipc/reports.ts`
- New: `src/renderer/src/features/reports/**`
- `src/renderer/src/App.tsx`
- `src/renderer/src/constants/NavLinks.ts`

#### Estimated Complexity

**Medium** (4–5 days)

#### Potential Risks

- Report definitions may need stakeholder sign-off

#### Acceptance Criteria

- [ ] Dashboard shows today's order count and value
- [ ] Each report listed in BRD is accessible in ≤ 3 clicks
- [ ] Reports respect date filters and export correctly

---

### Phase 6 — Inventory Integration

**Objective:** Connect stock levels to sales and receiving.

**Priority:** 🟡 Medium (depends on OQ-4)

#### Tasks

1. Auto-create inventory rows when product/flavor assigned
2. Decrement inventory on order checkout (optional: soft warning vs hard block)
3. Increment inventory on purchase receive
4. Low-stock alerts on Dashboard
5. POS stock badge on product cards

#### Dependencies

- Phase 2 (checkout flow)
- Phase 3 (receive flow)
- OQ-4 resolution

#### Files Likely Affected

- `src/main/ipc/order.ts`
- `src/main/ipc/purchases.ts`
- `src/main/ipc/products.ts`
- `src/renderer/src/screens/RegisterScreen.tsx`

#### Estimated Complexity

**Medium** (2–3 days)

#### Acceptance Criteria

- [ ] Stock decreases on sale (if enforced)
- [ ] Stock increases on purchase receive
- [ ] Out-of-stock products visually flagged on register

---

### Phase 7 — Settings & Backup UI

**Objective:** App configuration and data safety for non-technical staff.

**Priority:** 🟡 Medium

#### Tasks

1. Settings IPC: get/set key-value pairs
2. Settings screen: company name, phone, address, currency symbol, default tax, invoice footer
3. Backup UI: create backup, list backups, restore from backup (with confirmation)
4. Optional: export data to CSV

#### Dependencies

- Phase 4 (PDF templates use settings)

#### Files Likely Affected

- New: `src/main/ipc/settings.ts`
- New: `src/renderer/src/features/settings/**`
- `src/main/db/backup.ts` (add restore function)

#### Estimated Complexity

**Low–Medium** (2–3 days)

#### Acceptance Criteria

- [ ] Settings persist across restarts
- [ ] PDFs use company info from settings
- [ ] User can restore database from backup file

---

### Phase 8 — Debt & Payment Hardening

**Objective:** Complete flexible payment model and edge cases.

**Priority:** 🟡 Medium

#### Tasks

1. Implement prepayment / overpayment credit logic (per OQ-3)
2. Optional: invoice-specific payment allocation
3. Allow collecting payment when customer has credit from overpayment (negative balance display?)
4. Reconciliation view: computed balance vs stored `credit` field
5. Prevent order cancellation from leaving orphan purchase lines

#### Dependencies

- Phase 1, Phase 2

#### Files Likely Affected

- `src/main/ipc/order.ts`
- `src/main/ipc/debts.ts`
- `src/renderer/src/features/debts/**`
- `src/renderer/src/components/pos/PaymentModal.tsx`

#### Estimated Complexity

**Medium** (2–3 days)

#### Acceptance Criteria

- [ ] Partial payments update balance correctly
- [ ] Overpayments handled per business decision
- [ ] Ledger always matches `customers.credit` / `suppliers.credit`

---

### Phase 9 — Testing, Validation & Error Handling

**Objective:** Production reliability.

**Priority:** 🟠 High (parallel with other phases)

#### Tasks

1. Unit tests: `orderCalculations.ts`, pricing rules, purchase sync
2. Integration tests: IPC handlers with in-memory SQLite
3. E2E smoke test: product → sale → purchase → receive → collect debt
4. Add Zod validation to all IPC inputs
5. Structured logging in main process (`electron-log`)
6. Remove dead code: bcrypt (or implement auth), stub types in electron.d.ts
7. Fix logout (remove or implement)

#### Dependencies

- Phases 1–3 minimum for meaningful E2E

#### Files Likely Affected

- New: `src/**/*.test.ts`
- All IPC handlers
- `vitest.config.ts` (may need creation)

#### Estimated Complexity

**Medium** (ongoing, 3–5 days initial)

#### Acceptance Criteria

- [ ] Core business rules covered by automated tests
- [ ] `npm test` passes in CI
- [ ] No unhandled promise rejections in main process

---

### Phase 10 — Polish, i18n & Deployment

**Objective:** Production-ready installers and bilingual UX.

**Priority:** 🟡 Medium (final gate)

#### Tasks

1. Complete Arabic translations for POS screen
2. RTL layout verification on all screens
3. Align branding (name, icons, installer strings)
4. Code signing for macOS / Windows
5. Verify auto-update flow
6. Performance pass on Register with 500+ products
7. Accessibility: focus traps in modals, ARIA labels audit
8. User documentation (quick-start for employees)

#### Dependencies

- All prior phases

#### Files Likely Affected

- `src/renderer/content/ar.json`, `en.json`
- `electron-builder.yml`
- `package.json`

#### Estimated Complexity

**Medium** (3–4 days)

#### Acceptance Criteria

- [ ] Full Arabic UI with correct RTL
- [ ] Installers build on macOS and Windows
- [ ] Employee can complete daily workflow without English
- [ ] Auto-update tested on staging channel

---

## 11. Technical Improvements

### 11.1 State Management

- Introduce a **CatalogProvider** context loaded once at app start (products, categories, flavors, suppliers, customers) — reduces redundant IPC calls from Register + modals
- Keep cart state local to Register (frequent mutations)

### 11.2 Database Optimizations

- Composite index on `purchases(supplier_id, status)`
- Add `order_item_purchase_allocations` junction table
- Periodic `PRAGMA integrity_check` on startup (log only)
- Consider FTS5 virtual table for product search if catalog exceeds ~2000 SKUs

### 11.3 Electron IPC Improvements

- Namespace channels consistently (`domain:action`)
- Add request validation layer (Zod) before handler body
- Return structured errors: `{ code: 'CUSTOMER_NOT_FOUND', message: '...' }`
- Consider `ipcMain.handle` batch endpoint for Register bootstrap: `pos:init` → products + customers + categories in one round-trip

### 11.4 Performance

- Virtualize product grid (`@tanstack/react-virtual`) when catalog grows
- Debounce search input (150ms) — currently filters on every keystroke (acceptable now)
- Lazy-load feature screens with `React.lazy` (App currently imports all screens statically)

### 11.5 Code Organization

- Move business logic from IPC handlers into `src/main/services/` (purchaseSync, pricing, creditLedger)
- Split `lib/controllers.ts` into per-domain files
- Consolidate duplicate hooks under `features/*/hooks/`
- Sync `docs/schema.sql` with `schema.ts` or remove duplicate

### 11.6 Reusable Components

- Extract **DataTable** with sort/filter from repeated table markup
- Extract **EntityFormModal** pattern from Create/Edit modals
- Extract **FilterBar** component for list screens
- Extract **CurrencyInput** for consistent JOD formatting

### 11.7 Testing Strategy

| Layer | Tool | Focus |
|-------|------|-------|
| Unit | Vitest | Pricing rules, orderCalculations, purchaseSync |
| Integration | Vitest + better-sqlite3 in-memory | IPC handlers |
| E2E | Playwright (optional) | Full checkout flow |

### 11.8 Error Handling & Logging

- Add `electron-log` to main process; log all IPC errors with channel name
- Renderer: global error toast for `{ success: false }` in a wrapper hook
- Database errors: map SQLite constraint codes to user-friendly messages

### 11.9 Validation

- Shared Zod schemas in `src/shared/validation/` imported by both IPC and forms
- Enforce `supplier_id` required on product create/update
- Validate monetary amounts: non-negative, max 2 decimal places

---

## 12. Final Production Checklist

### Business Workflows

- [ ] Customer order entry via POS is fast (< 30 seconds per typical order)
- [ ] Wholesale pricing auto-applies at 6+ units
- [ ] Manual price override works
- [ ] Order auto-adds to correct open supplier purchase invoice
- [ ] Submitted purchase invoices lock; new orders create new invoices
- [ ] Flexible payments update customer balance correctly
- [ ] Supplier credit updates on purchase receive
- [ ] Debt collection and repayment work with ledger history
- [ ] Customer creatable from register without navigation

### Data Integrity

- [ ] All balance mutations inside transactions
- [ ] Order cancellation reverses customer credit
- [ ] Purchase cancellation reverses supplier credit (received portion)
- [ ] No double-allocation of order items to purchases
- [ ] Database backup runs daily; manual backup/restore available
- [ ] Foreign keys enforced; orphaned records prevented

### UI / UX

- [ ] Full Arabic translation + RTL
- [ ] Keyboard shortcuts documented and functional
- [ ] All nav items lead to working screens (no Coming Soon)
- [ ] Logout works or is hidden
- [ ] Consistent currency formatting everywhere

### Documents & Reports

- [ ] Customer invoice PDF generation
- [ ] Supplier purchase order PDF generation
- [ ] Outstanding balances report
- [ ] Customer history report
- [ ] Supplier history report
- [ ] Dashboard accessible from navigation

### Technical

- [ ] Zero critical bugs in order → purchase → receive → payment cycle
- [ ] Automated tests for core business rules
- [ ] Input validation on all IPC endpoints
- [ ] Error logging in main process
- [ ] macOS and Windows installers build successfully
- [ ] Auto-update tested
- [ ] Product name/branding consistent in app, installer, docs

### Documentation

- [ ] Employee quick-start guide (Arabic)
- [ ] README updated to match actual schema location and workflows
- [ ] Open questions (Section 9) resolved and documented

---

## Appendix A — Suggested Implementation Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 1 — Purchase pipeline | 1 week | Week 1 |
| Phase 2 — POS completion | 1 week | Week 2 |
| Phase 3 — Purchases UI | 1 week | Week 3 |
| Phase 4 — PDF | 0.5 week | Week 3–4 |
| Phase 5 — Reports | 1 week | Week 4–5 |
| Phase 6 — Inventory | 0.5 week | Week 5 |
| Phase 7 — Settings | 0.5 week | Week 5–6 |
| Phase 8 — Payment hardening | 0.5 week | Week 6 |
| Phase 9 — Testing | 1 week (parallel) | Week 3–6 |
| Phase 10 — Polish & deploy | 1 week | Week 7 |

**Estimated total: 7–8 weeks** to production-ready for a single developer, assuming open questions are resolved in Week 1.

---

## Appendix B — Key File Reference

| Purpose | Path |
|---------|------|
| App entry / routing | `src/renderer/src/App.tsx` |
| POS register | `src/renderer/src/screens/RegisterScreen.tsx` |
| Order IPC | `src/main/ipc/order.ts` |
| Purchase IPC | `src/main/ipc/purchases.ts` |
| Database schema | `src/main/db/schema.ts` |
| Migrations | `src/main/db/migrations.ts` |
| IPC bridge | `src/preload/index.ts` |
| Renderer controllers | `src/renderer/src/lib/controllers.ts` |
| Navigation config | `src/renderer/src/constants/NavLinks.ts` |
| Business requirements | `docs/Prompt.md` |
| Prior plan (superseded by this doc) | `docs/IMPLEMENTATION_PLAN.md` |

---

*This document should be treated as the single source of truth for remaining development work. Update it as phases complete and open questions are resolved.*
