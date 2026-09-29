# Naseej Lite — Screens & Features

## Overview

This document details all screens and features in the Naseej Lite distributor application.
The app is organized into feature modules corresponding to the core distributor workflow.

---

## Application Navigation

```
├── Dashboard (summary stats)
├── Customers
├── Suppliers
├── Products
│   ├── Catalog
│   ├── Categories
│   └── Flavors
├── Inventory
├── Orders (Customer Invoices)
│   ├── Order List
│   └── Order Detail
├── Purchases (Supplier POs)
│   ├── Purchase List
│   └── Purchase Detail
├── Debts
│   ├── Customer Debt Collections
│   └── Supplier Debt Repayments
├── Reports
└── Settings
```

---

## Screen 1: Dashboard

**Purpose:** Overview of key metrics at a glance.

**Widgets:**
- Today's orders count and total value (cash vs. credit breakdown)
- Customers with outstanding credit (top 5 by amount)
- Suppliers with outstanding credit (top 5 by amount)
- Low or zero stock alerts
- Pending purchase orders awaiting delivery

---

## Screen 2: Customers

**Purpose:** Manage the customer directory.

### Customer List

| Column | Notes |
|--------|-------|
| Name | Sortable |
| Phone | |
| Credit Balance | Highlighted if > 0 |
| Created | |

**Actions:** Create · Edit · Delete (with confirmation) · View orders · View debt history

### Customer Form

Fields: Name (required), Phone, initial Credit (defaults to 0).

---

## Screen 3: Suppliers

**Purpose:** Manage the supplier directory.

### Supplier List

| Column | Notes |
|--------|-------|
| Name | Sortable |
| Phone | |
| Credit Balance | Distributor owes this supplier; highlighted if > 0 |
| Created | |

**Actions:** Create · Edit · Delete · View purchases · View debt history

---

## Screen 4: Products

### 4.1 Product Catalog

**Purpose:** View and manage the full product list.

| Column | Notes |
|--------|-------|
| Title | |
| Category | |
| Supplier | |
| Price | Customer sell price |
| Wholesale Price | Purchase price from supplier |
| Flavors | Comma-separated flavor names |

**Actions:** Create · Edit · Delete · View inventory

### 4.2 Product Form

Fields:
- **Title** (required)
- **Category** — hierarchical dropdown
- **Supplier** — links product to a supplier for PO grouping
- **Price** — customer-facing sell price
- **Wholesale Price** — cost from supplier
- **Fixed Tax**, **Purchase Tax**, **Sell Tax** — tax rates
- **Image** — optional file upload
- **Flavors** — multi-select from global flavors list

### 4.3 Categories

Tree view with parent/child nesting. Create / rename / delete categories.
Deleting a category sets `category_id = NULL` on its products (no cascade delete).

### 4.4 Flavors

Simple list: create and rename flavors. Flavors are global and shared across products.
Deleting a flavor sets `flavor_id = NULL` on linked rows (no cascade delete of inventory/orders).

---

## Screen 5: Inventory

**Purpose:** View and adjust current stock levels.

### Stock Table

| Column | Notes |
|--------|-------|
| Product | |
| Flavor | Blank if no flavor |
| Quantity | Highlighted red if ≤ 0 |
| Last Updated | |

**Filters:** By product, by supplier, show only low/zero stock.

### Adjust Stock

Click a row → enter new quantity or delta amount → confirm.
No reason-code required (simple distributor workflow).

---

## Screen 6: Orders (Customer Invoices)

### 6.1 Order List

| Column | Notes |
|--------|-------|
| # | Auto-incrementing ID |
| Customer | |
| Status | Badge: draft / confirmed / partially_paid / paid / cancelled |
| Payment | cash / credit |
| Total | |
| Created | |

**Filters:** Status, customer, date range, payment type.

**Actions per row:** View · Edit (draft only) · Change status · Export PDF · Delete (draft only)

### 6.2 Order Detail

**Header:** Customer name, status badge, payment type, created date, notes.

**Line Items Table:**

| Product | Flavor | Qty | Unit Price | Tax | Deducted | Effective Qty | Line Total |
|---------|--------|-----|-----------|-----|----------|---------------|------------|

- **Deducted Qty:** Editable field. When the supplier delivers short, the distributor
  enters the missing quantity here. Effective qty = `quantity - deducted_qty`. Order total
  recalculates automatically.

**Footer:** Total (auto-calculated), status change buttons, PDF export button.

**Status Transitions:**

| From | To | Guard |
|------|----|-------|
| draft | confirmed | At least one item with qty > 0 |
| confirmed | paid | payment_type = cash (credit orders settle via debt collections) |
| confirmed | partially_paid | Partial cash received |
| draft / confirmed | cancelled | No irreversible side-effects if credit not yet applied |

---

## Screen 7: Purchases (Supplier Purchase Orders)

### 7.1 Purchase List

| Column | Notes |
|--------|-------|
| # | |
| Supplier | |
| Status | pending / received / partially_received / cancelled |
| Total | |
| Created | |

**Actions per row:** View · Change status · Export PDF · Attach supplier invoice PDF

### 7.2 Purchase Detail

**Header:** Supplier name, status badge, total, created date, notes.

**Line Items Table:**

| Product | Flavor | Ordered Qty | Unit Cost | Received Qty | Remaining |
|---------|--------|------------|----------|--------------|-----------|

- **Received Qty:** Editable. Filled in when delivery arrives.
- Saving received quantities triggers:
  1. Update `purchase_items.received_qty`
  2. Update purchase status (`partially_received` or `received`)
  3. Prompt user to propagate shortfalls to customer order items

### 7.3 Generate Daily Purchase Orders

**Trigger:** "Generate Today's POs" button on the Purchase List page.

**Process:**
1. Read all order items for orders with `status = 'confirmed'`
2. Aggregate by `product.supplier_id`
3. Create one `purchases` record per supplier + corresponding `purchase_items`
4. Confirmation dialog shows the summary before committing

---

## Screen 8: Debts

### 8.1 Customer Debt Collections

**Purpose:** Record cash received from a customer to reduce their credit balance.

**Form:** Select customer (shows current balance) → enter amount → optional notes → confirm.

**Ledger view:** Timeline of all orders (credit entries) and collections (debit entries)
for the selected customer.

### 8.2 Supplier Debt Repayments

**Purpose:** Record cash paid to a supplier to reduce the distributor's balance.

**Form:** Select supplier (shows current balance) → enter amount → optional notes → confirm.

**Ledger view:** Timeline of all purchases received on credit + repayments.

---

## Screen 9: Reports

| Report | Contents |
|--------|---------|
| Daily Orders Summary | Orders confirmed today; cash vs. credit totals |
| Outstanding Customer Debts | All customers with `credit > 0`; total outstanding |
| Outstanding Supplier Debts | All suppliers with `credit > 0`; total outstanding |
| Inventory Snapshot | Current stock per product/flavor; zero-stock highlighted |
| Purchase History | All POs for a date range and/or supplier |

All reports are printable and exportable as PDF.

---

## Screen 10: Settings

| Setting | Description |
|---------|-------------|
| Company Name | Printed on PDF invoice header |
| Currency | Display currency symbol (default: SAR) |
| Default Tax Rate | Pre-fill sell_tax on new products |
| Invoice Header | Custom text at top of invoices |
| Invoice Footer | Custom text at bottom of invoices |
| Language | Arabic (RTL) / English |
| Backup | Export `naseej.db` to a chosen location |
