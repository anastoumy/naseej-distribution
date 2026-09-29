# Naseej Lite — Application Map

## Screen Architecture & Workflow Definitions

**Platform:** Electron (Vite + React)  
**Layout:** Sidebar navigation + main content area  
**Input:** Mouse, keyboard, touch — no barcode scanner

---

## Application Layout

```
┌───────────────────────────────────────────────────────────────┐
│  Status Bar (App name, current date, language toggle)         │
├──────────┬────────────────────────────────────────────────────┤
│          │                                                    │
│  Left    │           Main Content Area                        │
│  Nav     │                                                    │
│          │   ┌────────────────────────────────────────────┐  │
│  [ ]     │   │                                            │  │
│  Dash    │   │   Page-level component renders here        │  │
│          │   │                                            │  │
│  [ ]     │   │                                            │  │
│  Cust.   │   │                                            │  │
│          │   │                                            │  │
│  [ ]     │   └────────────────────────────────────────────┘  │
│  Suppl.  │                                                    │
│          │                                                    │
│  [ ]     │                                                    │
│  Prod.   │                                                    │
│          │                                                    │
│  [ ]     │                                                    │
│  Inv.    │                                                    │
│          │                                                    │
│  [ ]     │                                                    │
│  Orders  │                                                    │
│          │                                                    │
│  [ ]     │                                                    │
│  POs     │                                                    │
│          │                                                    │
│  [ ]     │                                                    │
│  Debts   │                                                    │
│          │                                                    │
│  [ ]     │                                                    │
│  Reports │                                                    │
│          │                                                    │
│  [ ]     │                                                    │
│  Settings│                                                    │
└──────────┴────────────────────────────────────────────────────┘
```

---

## Screen Map

```
Electron Main Process (SQLite · IPC Handlers)
│
└── React Renderer Window
    │
    ├── /dashboard                    Key metrics overview
    │
    ├── /customers                    Customer list + CRUD
    │   └── /customers/:id/debt       Customer debt ledger
    │
    ├── /suppliers                    Supplier list + CRUD
    │   └── /suppliers/:id/debt       Supplier debt ledger
    │
    ├── /products                     Product catalog
    │   ├── /products/categories      Category tree management
    │   └── /products/flavors         Global flavor management
    │
    ├── /inventory                    Stock levels + adjustment
    │
    ├── /orders                       Customer invoice list
    │   ├── /orders/new               Create new order
    │   └── /orders/:id               Order detail + deduction entry
    │
    ├── /purchases                    Supplier PO list
    │   └── /purchases/:id            PO detail + delivery entry
    │
    ├── /debts                        Debt management
    │   ├── /debts/collections        Record customer payment
    │   └── /debts/repayments         Record supplier payment
    │
    ├── /reports                      Summary reports
    │
    └── /settings                     App configuration
```

---

## Screen Specifications

### Dashboard (`/dashboard`)

| Widget | Data Source |
|--------|-------------|
| Today's confirmed orders | `orders` WHERE date = today AND status = 'confirmed' |
| Cash vs credit totals | `orders.payment_type` aggregate |
| Top overdue customers | `customers` ORDER BY credit DESC LIMIT 5 |
| Top owed suppliers | `suppliers` ORDER BY credit DESC LIMIT 5 |
| Zero-stock products | `inventory` WHERE quantity <= 0 |

---

### Customers (`/customers`)

| Feature | Detail |
|---------|--------|
| List | Name, phone, credit balance, created date |
| Create/Edit | Name (required), phone, notes |
| Delete | Soft confirmation; blocked if customer has active orders |
| Debt view | Navigate to `/customers/:id/debt` for full ledger |

---

### Orders (`/orders`, `/orders/new`, `/orders/:id`)

**Order List filters:** Status, customer, payment type, date range.

**Create Order flow:**
```
Select Customer → Choose payment type (cash / credit)
→ Add line items (product + flavor + qty + price)
→ Review total → Save as draft
→ Confirm (triggers credit update if payment_type = credit)
```

**Order Detail — key interactions:**

| Action | Behavior |
|--------|----------|
| Add item | Pick product → pick flavor (if available) → enter qty + price |
| Edit deducted qty | Enter `deducted_qty`; effective qty and total recalculate live |
| Change status | Button row: Confirm / Mark Paid / Cancel (with guard checks) |
| Export PDF | Generate invoice PDF; save path to `orders.invoice_pdf` |

**Deduction workflow:**
```
Supplier delivers fewer units than ordered
    ↓
Distributor opens the relevant order
    ↓
Enters deducted_qty on the shortage line
    ↓
Total recalculates: (qty - deducted_qty) × unit_price + tax
    ↓
Export updated PDF invoice for customer
```

---

### Purchases (`/purchases`, `/purchases/:id`)

**Generate POs button:** Reads all confirmed orders, groups by supplier, creates POs.

```
Confirmed orders (grouped by products.supplier_id)
    ↓
One purchases record per supplier
    ↓
purchase_items rows for each product/flavor/qty aggregate
    ↓
Status = pending
```

**Receive delivery flow:**
```
Supplier delivers
    ↓
Open purchase detail
    ↓
Enter received_qty for each item
    ↓
Status → received / partially_received
    ↓
If shortage: prompt to propagate deductions to linked orders
```

---

### Debts (`/debts/collections`, `/debts/repayments`)

**Collection form:**
```
Customer selector (shows current balance)
    ↓
Amount input
    ↓
Confirm → INSERT debt_collections + UPDATE customers.credit
```

**Repayment form:**
```
Supplier selector (shows current balance)
    ↓
Amount input
    ↓
Confirm → INSERT debt_repayments + UPDATE suppliers.credit
```

---

## Data Flow: Confirmed Order (Credit)

```
User confirms order with payment_type = 'credit'
            │
            ▼
IPC: orders:updateStatus(id, 'confirmed')
            │
            ▼
db.transaction() {
  UPDATE orders SET status = 'confirmed'
  UPDATE customers SET credit = credit + order.total
}
            │
            ▼
Customer record shows increased balance
Customer can see debt in /customers/:id/debt ledger
```

## Data Flow: Daily PO Generation

```
User clicks "Generate Today's POs"
            │
            ▼
IPC: purchases:generate()
            │
            ▼
db.transaction() {
  SELECT confirmed order items grouped by supplier
  INSERT INTO purchases (one per supplier)
  INSERT INTO purchase_items (all lines per supplier)
}
            │
            ▼
Purchase list shows new POs with status = pending
```
