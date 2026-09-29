import { LucideIcon } from "lucide-react";

// ── App View/Navigation ──────────────────────────────────────────────────────

export type AppLayout = "sales" | "catalog" | "operations" | "insights";

export type AppView =
  | "register"
  | "orders"
  | "products"
  | "categories"
  | "flavors"
  | "inventory"
  | "customers"
  | "suppliers"
  | "purchases"
  | "debts"
  | "dashboard"
  | "reports"
  | "settings";

export interface AppSettings {
  company_name: string;
  company_name_ar: string;
  company_phone: string;
  company_address: string;
  company_email: string;
  company_cr: string;
  company_po_box: string;
  company_vatin: string;
  invoice_prefix: string;
  currency_symbol: string;
  default_tax: number;
  invoice_footer: string;
}

export interface BackupEntry {
  name: string;
  path: string;
  date: string;
  size_bytes: number;
}

export type ReportType =
  | "outstandingCustomers"
  | "outstandingSuppliers"
  | "ordersByCustomer"
  | "ordersBySupplier"
  | "purchaseHistory"
  | "paymentHistory";

export interface DashboardSummary {
  today_order_count: number;
  today_order_value: number;
}

export interface ReportDateFilter {
  from?: string | null;
  to?: string | null;
}

export interface OrderByCustomerRow {
  id: number;
  customer_id: number;
  customer_name: string;
  status: OrderStatus;
  payment_type: OrderPaymentType;
  total: number;
  amount_paid: number;
  created_at: string;
}

export interface OrderBySupplierRow {
  order_id: number;
  supplier_id: number;
  supplier_name: string;
  customer_name: string;
  line_total: number;
  item_count: number;
  created_at: string;
}

export interface PurchaseHistoryRow {
  id: number;
  supplier_id: number;
  supplier_name: string;
  status: PurchaseStatus;
  total: number;
  submitted_at: string | null;
  created_at: string;
}

export interface PaymentHistoryRow {
  id: number;
  payment_type: "customer" | "supplier";
  party_id: number;
  party_name: string;
  amount: number;
  notes: string | null;
  created_at: string;
}

export type NavItem = {
  view: AppView;
  icon: LucideIcon;
  labelKey: string;
};

export type SidebarProps = {
  activeView: AppView;
  activeLayout: AppLayout;
  onNavigate: (view: AppView) => void;
  onLayoutChange: (layout: AppLayout) => void;
};

// ── IPC Response ─────────────────────────────────────────────────────────────

export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ── Domain Types ─────────────────────────────────────────────────────────────

export interface Category {
  id: number;
  title: string;
  parent_id: number | null;
  parent_title?: string | null;
  created_at: string;
}

export interface Flavor {
  id: number;
  name: string;
  created_at: string;
}

export interface ProductFlavor {
  id: number;
  name: string;
  price: number;
  wholesale_price: number;
  purchase_price: number;
}

export interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  credit: number;
  created_at: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  credit: number;
  created_at: string;
}

export interface DebtCollection {
  id: number;
  customer_id: number;
  customer_name?: string | null;
  amount: number;
  notes: string | null;
  order_id?: number | null;
  created_at: string;
}

export interface DebtRepayment {
  id: number;
  supplier_id: number;
  supplier_name?: string | null;
  amount: number;
  notes: string | null;
  created_at: string;
}

export type DebtLedgerEntryType =
  | "order"
  | "collection"
  | "purchase"
  | "repayment"
  | "prepayment"
  | "prepayment_applied"
  | "opening_balance";

export interface DebtLedgerEntry {
  entry_type: DebtLedgerEntryType;
  reference_id: number;
  amount: number;
  description: string;
  created_at: string;
}

export interface DebtAdjustment {
  id: number;
  amount: number;
  notes: string | null;
  effective_date: string;
  created_at: string;
}

export interface OutstandingDebt {
  id: number;
  name: string;
  phone: string | null;
  credit: number;
}

export interface CreditReconciliation {
  stored_credit: number;
  computed_credit: number;
  in_sync: boolean;
  difference: number;
}

export interface DebtAccountLedger {
  id: number;
  name: string;
  credit: number;
  reconciliation?: CreditReconciliation;
  ledger: DebtLedgerEntry[];
}

export interface Product {
  id: number;
  title: string;
  category_id: number | null;
  category_title?: string | null;
  supplier_id: number | null;
  supplier_name?: string | null;
  price: number;
  wholesale_price: number;
  purchase_price: number;
  taxable: boolean;
  image_path: string | null;
  flavor_names?: string | null;
  flavors?: ProductFlavor[];
  created_at: string;
}

export interface InventoryRow {
  id: number;
  product_id: number;
  product_title: string;
  flavor_id: number | null;
  flavor_name: string | null;
  quantity: number;
  created_at: string;
}

export type OrderStatus = "draft" | "confirmed" | "partially_paid" | "paid" | "cancelled";

export type OrderFulfillmentStatus =
  | "pending"
  | "partially_received"
  | "received"
  | "delivered"
  | "cancelled";

export type OrderPaymentType = "cash" | "credit";

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product_title?: string | null;
  flavor_id: number | null;
  flavor_name?: string | null;
  quantity: number;
  unit_price: number;
  tax_amount: number;
  deducted_qty: number;
  effective_qty?: number;
  line_total?: number;
  created_at: string;
}

export interface Order {
  id: number;
  customer_id: number;
  customer_name?: string | null;
  status: OrderStatus;
  fulfillment_status: OrderFulfillmentStatus;
  payment_type: OrderPaymentType;
  total: number;
  amount_paid: number;
  discount_total: number;
  invoice_pdf: string | null;
  notes: string | null;
  item_count?: number;
  items?: OrderItem[];
  created_at: string;
}

export type PurchaseStatus = "pending" | "received" | "partially_received" | "cancelled";

export interface PurchaseItem {
  id: number;
  purchase_id: number;
  product_id: number;
  product_title?: string | null;
  flavor_id: number | null;
  flavor_name?: string | null;
  quantity: number;
  unit_cost: number;
  received_qty: number;
  remaining_qty?: number;
  created_at: string;
}

export interface Purchase {
  id: number;
  supplier_id: number;
  supplier_name?: string | null;
  status: PurchaseStatus;
  total: number;
  invoice_pdf: string | null;
  notes: string | null;
  submitted_at: string | null;
  item_count?: number;
  items?: PurchaseItem[];
  created_at: string;
}

// ── POS / Register Types ─────────────────────────────────────────────────────

export interface ProductVariant {
  id: string;
  productId?: number;
  flavorId?: number | null;
  productName: string;
  sku: string;
  price: number;
  retailPrice: number;
  wholesalePrice: number;
  sellTax: number;
  size: string;
  color: string;
  colorHex: string;
  stockQty: number;
  flavorName?: string | null;
}

export interface CartItem {
  id: string;
  variant: ProductVariant;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  lineTotal: number;
  wholesaleApplied?: boolean;
  priceOverridden?: boolean;
  priceNote?: string;
}

export interface POSCustomer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  loyaltyPoints: number;
  totalOrders: number;
}

export interface ReceiptData {
  orderId?: number;
  receiptNumber: string;
  dateTime: string;
  staffName: string;
  customer: POSCustomer | null;
  items: CartItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  paymentMethod: "cash" | "credit" | "partial";
  amountPaid: number;
  debtAmount?: number;
  cashPaid?: number;
  changeDue?: number;
  creditApplied?: number;
  prepaymentUsed?: number;
}

