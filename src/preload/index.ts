import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

const api = {
  // ── Platform & Window controls ────────────────────────────────────────────
  getPlatform: () => process.platform,
  minimizeWindow: () => ipcRenderer.send("window:minimize"),
  maximizeWindow: () => ipcRenderer.send("window:maximize"),
  closeWindow:    () => ipcRenderer.send("window:close"),

  // ── Categories ────────────────────────────────────────────────────────────
  categories: {
    getAll:  () => ipcRenderer.invoke("categories:getAll"),
    create:  (data: { title: string; parent_id?: number | null }) =>
               ipcRenderer.invoke("categories:create", data),
    update:  (data: { id: number; title?: string; parent_id?: number | null }) =>
               ipcRenderer.invoke("categories:update", data),
    delete:  (id: number) => ipcRenderer.invoke("categories:delete", id),
  },

  // ── Flavors ───────────────────────────────────────────────────────────────
  flavors: {
    getAll:  () => ipcRenderer.invoke("flavors:getAll"),
    create:  (data: { name: string }) => ipcRenderer.invoke("flavors:create", data),
    update:  (data: { id: number; name: string }) => ipcRenderer.invoke("flavors:update", data),
    delete:  (id: number) => ipcRenderer.invoke("flavors:delete", id),
  },

  // ── Suppliers ─────────────────────────────────────────────────────────────
  suppliers: {
    getAll:  () => ipcRenderer.invoke("suppliers:getAll"),
    getById: (id: number) => ipcRenderer.invoke("suppliers:getById", id),
    create:  (data: {
      name: string;
      phone?: string;
      opening_balance?: number;
      opening_balance_notes?: string;
      opening_balance_date?: string;
    }) => ipcRenderer.invoke("suppliers:create", data),
    update:  (data: { id: number; name?: string; phone?: string | null }) =>
               ipcRenderer.invoke("suppliers:update", data),
    delete:  (id: number) => ipcRenderer.invoke("suppliers:delete", id),
  },

  // ── Customers ─────────────────────────────────────────────────────────────
  customers: {
    getAll:  () => ipcRenderer.invoke("customers:getAll"),
    getById: (id: number) => ipcRenderer.invoke("customers:getById", id),
    create:  (data: {
      name: string;
      phone?: string;
      opening_balance?: number;
      opening_balance_notes?: string;
      opening_balance_date?: string;
    }) => ipcRenderer.invoke("customers:create", data),
    update:  (data: { id: number; name?: string; phone?: string | null }) =>
               ipcRenderer.invoke("customers:update", data),
    delete:  (id: number) => ipcRenderer.invoke("customers:delete", id),
  },

  // ── Debts ───────────────────────────────────────────────────────────────
  debtCollections: {
    getAll:  () => ipcRenderer.invoke("debtCollections:getAll"),
    getById: (id: number) => ipcRenderer.invoke("debtCollections:getById", id),
    getCustomerLedger: (customerId: number) =>
               ipcRenderer.invoke("debtCollections:getCustomerLedger", customerId),
    getOutstanding: () => ipcRenderer.invoke("debtCollections:getOutstanding"),
    getPrepaymentAccounts: () =>
               ipcRenderer.invoke("debtCollections:getPrepaymentAccounts"),
    reconcileCustomer: (customerId: number) =>
               ipcRenderer.invoke("debtCollections:reconcileCustomer", customerId),
    verifyAllCustomers: () => ipcRenderer.invoke("debtCollections:verifyAllCustomers"),
    create:  (data: {
               customer_id: number;
               amount: number;
               notes?: string | null;
               order_id?: number | null;
             }) => ipcRenderer.invoke("debtCollections:create", data),
    delete:  (id: number) => ipcRenderer.invoke("debtCollections:delete", id),
  },

  debtRepayments: {
    getAll:  () => ipcRenderer.invoke("debtRepayments:getAll"),
    getById: (id: number) => ipcRenderer.invoke("debtRepayments:getById", id),
    getSupplierLedger: (supplierId: number) =>
               ipcRenderer.invoke("debtRepayments:getSupplierLedger", supplierId),
    getOutstanding: () => ipcRenderer.invoke("debtRepayments:getOutstanding"),
    reconcileSupplier: (supplierId: number) =>
               ipcRenderer.invoke("debtRepayments:reconcileSupplier", supplierId),
    verifyAllSuppliers: () => ipcRenderer.invoke("debtRepayments:verifyAllSuppliers"),
    create:  (data: { supplier_id: number; amount: number; notes?: string | null }) =>
               ipcRenderer.invoke("debtRepayments:create", data),
    delete:  (id: number) => ipcRenderer.invoke("debtRepayments:delete", id),
  },

  customerDebtAdjustments: {
    getByCustomer: (customerId: number) =>
      ipcRenderer.invoke("customerDebtAdjustments:getByCustomer", customerId),
    create: (data: {
      account_id: number;
      amount: number;
      notes?: string | null;
      effective_date?: string;
    }) => ipcRenderer.invoke("customerDebtAdjustments:create", data),
    update: (data: {
      id: number;
      amount: number;
      notes?: string | null;
      effective_date?: string;
    }) => ipcRenderer.invoke("customerDebtAdjustments:update", data),
    delete: (id: number) =>
      ipcRenderer.invoke("customerDebtAdjustments:delete", id),
  },

  supplierDebtAdjustments: {
    getBySupplier: (supplierId: number) =>
      ipcRenderer.invoke("supplierDebtAdjustments:getBySupplier", supplierId),
    create: (data: {
      account_id: number;
      amount: number;
      notes?: string | null;
      effective_date?: string;
    }) => ipcRenderer.invoke("supplierDebtAdjustments:create", data),
    update: (data: {
      id: number;
      amount: number;
      notes?: string | null;
      effective_date?: string;
    }) => ipcRenderer.invoke("supplierDebtAdjustments:update", data),
    delete: (id: number) =>
      ipcRenderer.invoke("supplierDebtAdjustments:delete", id),
  },

  // ── Products ──────────────────────────────────────────────────────────────
  products: {
    getAll:  () => ipcRenderer.invoke("products:getAll"),
    getById: (id: number) => ipcRenderer.invoke("products:getById", id),
    getImageDataUrl: (imagePath: string) => ipcRenderer.invoke("products:getImageDataUrl", imagePath),
    create:  (data: {
               title: string; category_id?: number | null; supplier_id?: number | null;
               price: number; wholesale_price: number; purchase_price: number;
               taxable?: boolean;
               flavors?: { flavor_id: number; price: number; wholesale_price?: number; purchase_price?: number }[];
               flavor_ids?: number[];
               imageDataUrl?: string;
             }) => ipcRenderer.invoke("products:create", data),
    update:  (data: {
               id: number; title?: string; category_id?: number | null; supplier_id?: number | null;
               price?: number; wholesale_price?: number; purchase_price?: number;
               taxable?: boolean;
               flavors?: { flavor_id: number; price: number; wholesale_price?: number; purchase_price?: number }[];
               flavor_ids?: number[];
               imageDataUrl?: string;
             }) => ipcRenderer.invoke("products:update", data),
    delete:  (id: number) => ipcRenderer.invoke("products:delete", id),
  },

  // ── Orders ───────────────────────────────────────────────────────────────
  orders: {
    getAll:       () => ipcRenderer.invoke("orders:getAll"),
    getById:      (id: number) => ipcRenderer.invoke("orders:getById", id),
    create:       (data: {
                     customer_id: number;
                     payment_type?: "cash" | "credit";
                     notes?: string | null;
                     items?: {
                       product_id: number;
                       flavor_id?: number | null;
                       quantity: number;
                       price: number;
                       tax_amount?: number;
                       deducted_qty?: number;
                     }[];
                     total_price?: number;
                   }) => ipcRenderer.invoke("orders:create", data),
    checkout:     (data: {
                     customer_id: number;
                     amount_paid: number;
                     notes?: string | null;
                     items: {
                       product_id: number;
                       flavor_id?: number | null;
                       quantity: number;
                       price: number;
                       tax_amount?: number;
                       deducted_qty?: number;
                     }[];
                     total_price?: number;
                     discount_total?: number;
                   }) => ipcRenderer.invoke("orders:checkout", data),
    update:       (data: {
                     id: number;
                     customer_id?: number;
                     payment_type?: "cash" | "credit";
                     notes?: string | null;
                     items?: {
                       product_id: number;
                       flavor_id?: number | null;
                       quantity: number;
                       price: number;
                       tax_amount?: number;
                       deducted_qty?: number;
                     }[];
                     total_price?: number;
                   }) => ipcRenderer.invoke("orders:update", data),
    updateStatus: (data: { id: number; status: "draft" | "confirmed" | "partially_paid" | "paid" | "cancelled" }) =>
                   ipcRenderer.invoke("orders:updateStatus", data),
    addItem:      (data: {
                     order_id: number;
                     product_id: number;
                     flavor_id?: number | null;
                     quantity: number;
                     price: number;
                     tax_amount?: number;
                     deducted_qty?: number;
                   }) => ipcRenderer.invoke("orders:addItem", data),
    deductItem:   (id: number, qty: number) => ipcRenderer.invoke("orders:deductItem", id, qty),
    delete:       (id: number) => ipcRenderer.invoke("orders:delete", id),
    exportPdf:    (id: number, regenerate?: boolean) =>
                   ipcRenderer.invoke("orders:exportPdf", id, regenerate),
    openPdf:      (id: number) => ipcRenderer.invoke("orders:openPdf", id),
    printPdf:     (id: number) => ipcRenderer.invoke("orders:printPdf", id),
    markDelivered: (id: number) => ipcRenderer.invoke("orders:markDelivered", id),
  },

  // ── Purchases ────────────────────────────────────────────────────────────
  purchases: {
    getAll:       () => ipcRenderer.invoke("purchases:getAll"),
    getById:      (id: number) => ipcRenderer.invoke("purchases:getById", id),
    generate:     () => ipcRenderer.invoke("purchases:generate"),
    submit:       (id: number) => ipcRenderer.invoke("purchases:submit", id),
    updateStatus: (id: number, status: "pending" | "received" | "partially_received" | "cancelled") =>
                   ipcRenderer.invoke("purchases:updateStatus", id, status),
    receiveItem:  (id: number, qty: number) => ipcRenderer.invoke("purchases:receiveItem", id, qty),
    delete:       (id: number) => ipcRenderer.invoke("purchases:delete", id),
    exportPdf:    (id: number, regenerate?: boolean) =>
                   ipcRenderer.invoke("purchases:exportPdf", id, regenerate),
    openPdf:      (id: number) => ipcRenderer.invoke("purchases:openPdf", id),
    printPdf:     (id: number) => ipcRenderer.invoke("purchases:printPdf", id),
  },

  // ── Inventory ─────────────────────────────────────────────────────────────
  inventory: {
    getAll:       () => ipcRenderer.invoke("inventory:getAll"),
    getByProduct: (productId: number) => ipcRenderer.invoke("inventory:getByProduct", productId),
    adjust:       (data: { product_id: number; flavor_id?: number | null; delta: number }) =>
                    ipcRenderer.invoke("inventory:adjust", data),
    setQty:       (data: { product_id: number; flavor_id?: number | null; qty: number }) =>
                    ipcRenderer.invoke("inventory:setQty", data),
  },

  // ── Reports ───────────────────────────────────────────────────────────────
  reports: {
    getDashboardSummary: () => ipcRenderer.invoke("reports:getDashboardSummary"),
    getOrdersByCustomer: (filter?: {
      from?: string | null;
      to?: string | null;
      customer_id?: number | null;
    }) => ipcRenderer.invoke("reports:getOrdersByCustomer", filter ?? {}),
    getOrdersBySupplier: (filter?: {
      from?: string | null;
      to?: string | null;
      supplier_id?: number | null;
    }) => ipcRenderer.invoke("reports:getOrdersBySupplier", filter ?? {}),
    getPurchaseHistory: (filter?: {
      from?: string | null;
      to?: string | null;
      supplier_id?: number | null;
    }) => ipcRenderer.invoke("reports:getPurchaseHistory", filter ?? {}),
    getPaymentHistory: (filter?: {
      from?: string | null;
      to?: string | null;
      type?: "all" | "customer" | "supplier";
    }) => ipcRenderer.invoke("reports:getPaymentHistory", filter ?? {}),
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  settings: {
    getAll: () => ipcRenderer.invoke("settings:getAll"),
    update: (data: {
      company_name?: string;
      company_name_ar?: string;
      company_phone?: string;
      company_address?: string;
      company_email?: string;
      company_cr?: string;
      company_po_box?: string;
      company_vatin?: string;
      invoice_prefix?: string;
      currency_symbol?: string;
      default_tax?: number;
      invoice_footer?: string;
    }) => ipcRenderer.invoke("settings:update", data),
  },

  // ── Backup ────────────────────────────────────────────────────────────────
  backup: {
    create: () => ipcRenderer.invoke("backup:create"),
    list:   () => ipcRenderer.invoke("backup:list"),
    restore: (backupPath: string) => ipcRenderer.invoke("backup:restore", backupPath),
  },
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electronAPI", electronAPI);
    contextBridge.exposeInMainWorld("api", api);
  } catch (err) {
    console.error(err);
  }
} else {
  // @ts-ignore
  window.electronAPI = electronAPI;
  // @ts-ignore
  window.api = api;
}
