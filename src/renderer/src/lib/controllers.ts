import type {
  IpcResponse,
  Category,
  Customer,
  DebtAccountLedger,
  CreditReconciliation,
  DebtCollection,
  DebtRepayment,
  Flavor,
  InventoryRow,
  Order,
  OrderPaymentType,
  OrderStatus,
  OutstandingDebt,
  Purchase,
  PurchaseStatus,
  Supplier,
  Product,
  DashboardSummary,
  OrderByCustomerRow,
  OrderBySupplierRow,
  PurchaseHistoryRow,
  PaymentHistoryRow,
  ReportDateFilter,
  AppSettings,
  BackupEntry,
} from "@/types/Global";

export const productsController = {
  getAll: (): Promise<IpcResponse<Product[]>> => window.api.products.getAll(),

  getById: (id: number): Promise<IpcResponse<Product>> =>
    window.api.products.getById(id),

  create: (data: {
    title: string;
    category_id?: number | null;
    supplier_id?: number | null;
    price: number;
    wholesale_price: number;
    purchase_price: number;
    taxable?: boolean;
    flavors?: { flavor_id: number; price: number; wholesale_price?: number; purchase_price?: number }[];
    flavor_ids?: number[];
    imageFile?: File;
  }): Promise<IpcResponse<{ id: number }>> => {
    const imageFile = data.imageFile;
    if (imageFile) {
      // this narrows File | undefined → File, satisfying readAsDataURL
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const { imageFile, ...rest } = data; // strip the File before sending over IPC
          window.api.products
            .create({ ...rest, imageDataUrl: reader.result as string })
            .then(resolve);
        };
        reader.readAsDataURL(imageFile);
      });
    }
    return window.api.products.create(data);
  },

  update: (data: {
    id: number;
    title?: string;
    category_id?: number | null;
    supplier_id?: number | null;
    price?: number;
    wholesale_price?: number;
    purchase_price?: number;
    taxable?: boolean;
    flavors?: { flavor_id: number; price: number; wholesale_price?: number; purchase_price?: number }[];
    flavor_ids?: number[];
    imageFile?: File;
  }): Promise<IpcResponse> => {
    const imageFile = data.imageFile;
    if (imageFile) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          window.api.products
            .update({
              ...data,
              imageDataUrl: reader.result as string,
            })
            .then(resolve);
        };
        reader.readAsDataURL(imageFile);
      });
    }
    return window.api.products.update(data);
  },

  delete: (id: number): Promise<IpcResponse> => window.api.products.delete(id),
};

export const categoriesController = {
  getAll: (): Promise<IpcResponse<Category[]>> =>
    window.api.categories.getAll(),

  create: (data: {
    title: string;
    parent_id?: number | null;
  }): Promise<IpcResponse<{ id: number }>> =>
    window.api.categories.create(data),

  update: (data: {
    id: number;
    title?: string;
    parent_id?: number | null;
  }): Promise<IpcResponse> => window.api.categories.update(data),

  delete: (id: number): Promise<IpcResponse> =>
    window.api.categories.delete(id),
};

export const customersController = {
  getAll: (): Promise<IpcResponse<Customer[]>> => window.api.customers.getAll(),

  getById: (id: number): Promise<IpcResponse<Customer>> =>
    window.api.customers.getById(id),

  create: (data: {
    name: string;
    phone?: string;
    opening_balance?: number;
    opening_balance_notes?: string;
    opening_balance_date?: string;
  }): Promise<IpcResponse<{ id: number }>> => window.api.customers.create(data),

  update: (data: {
    id: number;
    name?: string;
    phone?: string | null;
  }): Promise<IpcResponse> => window.api.customers.update(data),

  delete: (id: number): Promise<IpcResponse> => window.api.customers.delete(id),
};

export const debtCollectionsController = {
  getAll: (): Promise<IpcResponse<DebtCollection[]>> =>
    window.api.debtCollections.getAll(),

  getById: (id: number): Promise<IpcResponse<DebtCollection>> =>
    window.api.debtCollections.getById(id),

  getCustomerLedger: (
    customerId: number,
  ): Promise<IpcResponse<DebtAccountLedger>> =>
    window.api.debtCollections.getCustomerLedger(customerId),

  getOutstanding: (): Promise<IpcResponse<OutstandingDebt[]>> =>
    window.api.debtCollections.getOutstanding(),

  getPrepaymentAccounts: (): Promise<IpcResponse<OutstandingDebt[]>> =>
    window.api.debtCollections.getPrepaymentAccounts(),

  reconcileCustomer: (
    customerId: number,
  ): Promise<IpcResponse<CreditReconciliation>> =>
    window.api.debtCollections.reconcileCustomer(customerId),

  verifyAllCustomers: () => window.api.debtCollections.verifyAllCustomers(),

  create: (data: {
    customer_id: number;
    amount: number;
    notes?: string | null;
    order_id?: number | null;
  }): Promise<IpcResponse<{ id: number }>> =>
    window.api.debtCollections.create(data),

  delete: (id: number): Promise<IpcResponse> =>
    window.api.debtCollections.delete(id),
};

export const flavorsController = {
  getAll: (): Promise<IpcResponse<Flavor[]>> => window.api.flavors.getAll(),

  create: (data: { name: string }): Promise<IpcResponse<{ id: number }>> =>
    window.api.flavors.create(data),

  update: (data: { id: number; name: string }): Promise<IpcResponse> =>
    window.api.flavors.update(data),

  delete: (id: number): Promise<IpcResponse> => window.api.flavors.delete(id),
};

export const inventoryController = {
  getAll: (): Promise<IpcResponse<InventoryRow[]>> =>
    window.api.inventory.getAll(),

  getByProduct: (productId: number): Promise<IpcResponse<InventoryRow[]>> =>
    window.api.inventory.getByProduct(productId),

  adjust: (data: {
    product_id: number;
    flavor_id?: number | null;
    delta: number;
  }): Promise<IpcResponse> => window.api.inventory.adjust(data),

  setQty: (data: {
    product_id: number;
    flavor_id?: number | null;
    qty: number;
  }): Promise<IpcResponse> => window.api.inventory.setQty(data),
};

export const suppliersController = {
  getAll: (): Promise<IpcResponse<Supplier[]>> => window.api.suppliers.getAll(),

  getById: (id: number): Promise<IpcResponse<Supplier>> =>
    window.api.suppliers.getById(id),

  create: (data: {
    name: string;
    phone?: string;
    opening_balance?: number;
    opening_balance_notes?: string;
    opening_balance_date?: string;
  }): Promise<IpcResponse<{ id: number }>> => window.api.suppliers.create(data),

  update: (data: {
    id: number;
    name?: string;
    phone?: string | null;
  }): Promise<IpcResponse> => window.api.suppliers.update(data),

  delete: (id: number): Promise<IpcResponse> => window.api.suppliers.delete(id),
};

export const debtRepaymentsController = {
  getAll: (): Promise<IpcResponse<DebtRepayment[]>> =>
    window.api.debtRepayments.getAll(),

  getById: (id: number): Promise<IpcResponse<DebtRepayment>> =>
    window.api.debtRepayments.getById(id),

  getSupplierLedger: (
    supplierId: number,
  ): Promise<IpcResponse<DebtAccountLedger>> =>
    window.api.debtRepayments.getSupplierLedger(supplierId),

  getOutstanding: (): Promise<IpcResponse<OutstandingDebt[]>> =>
    window.api.debtRepayments.getOutstanding(),

  reconcileSupplier: (
    supplierId: number,
  ): Promise<IpcResponse<CreditReconciliation>> =>
    window.api.debtRepayments.reconcileSupplier(supplierId),

  verifyAllSuppliers: () => window.api.debtRepayments.verifyAllSuppliers(),

  create: (data: {
    supplier_id: number;
    amount: number;
    notes?: string | null;
  }): Promise<IpcResponse<{ id: number }>> =>
    window.api.debtRepayments.create(data),

  delete: (id: number): Promise<IpcResponse> =>
    window.api.debtRepayments.delete(id),
};

export const customerDebtAdjustmentsController = {
  getByCustomer: (customerId: number) =>
    window.api.customerDebtAdjustments.getByCustomer(customerId),

  create: (data: {
    account_id: number;
    amount: number;
    notes?: string | null;
    effective_date?: string;
  }) => window.api.customerDebtAdjustments.create(data),

  update: (data: {
    id: number;
    amount: number;
    notes?: string | null;
    effective_date?: string;
  }) => window.api.customerDebtAdjustments.update(data),

  delete: (id: number) => window.api.customerDebtAdjustments.delete(id),
};

export const supplierDebtAdjustmentsController = {
  getBySupplier: (supplierId: number) =>
    window.api.supplierDebtAdjustments.getBySupplier(supplierId),

  create: (data: {
    account_id: number;
    amount: number;
    notes?: string | null;
    effective_date?: string;
  }) => window.api.supplierDebtAdjustments.create(data),

  update: (data: {
    id: number;
    amount: number;
    notes?: string | null;
    effective_date?: string;
  }) => window.api.supplierDebtAdjustments.update(data),

  delete: (id: number) => window.api.supplierDebtAdjustments.delete(id),
};

export const orderController = {
  getAll: (): Promise<IpcResponse<Order[]>> => window.api.orders.getAll(),

  getById: (id: number): Promise<IpcResponse<Order>> =>
    window.api.orders.getById(id),

  create: (data: {
    customer_id: number;
    payment_type?: OrderPaymentType;
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
  }): Promise<IpcResponse<{ id: number }>> => window.api.orders.create(data),

  checkout: (data: {
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
  }): Promise<
    IpcResponse<{
      id: number;
      status: OrderStatus;
      debt: number;
      prepayment: number;
      creditUsed: number;
      amount_paid: number;
      total: number;
    }>
  > => window.api.orders.checkout(data),

  update: (data: {
    id: number;
    customer_id?: number;
    payment_type?: OrderPaymentType;
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
  }): Promise<IpcResponse> => window.api.orders.update(data),

  updateStatus: (data: {
    id: number;
    status: OrderStatus;
  }): Promise<IpcResponse> => window.api.orders.updateStatus(data),

  addItem: (data: {
    order_id: number;
    product_id: number;
    flavor_id?: number | null;
    quantity: number;
    price: number;
    tax_amount?: number;
    deducted_qty?: number;
  }): Promise<IpcResponse<{ id: number }>> => window.api.orders.addItem(data),

  deductItem: (id: number, qty: number): Promise<IpcResponse> =>
    window.api.orders.deductItem(id, qty),

  delete: (id: number): Promise<IpcResponse> => window.api.orders.delete(id),

  exportPdf: (
    id: number,
    regenerate = false,
  ): Promise<IpcResponse<{ path: string }>> =>
    window.api.orders.exportPdf(id, regenerate),

  openPdf: (id: number): Promise<IpcResponse<{ path: string }>> =>
    window.api.orders.openPdf(id),

  printPdf: (id: number): Promise<IpcResponse<{ path: string }>> =>
    window.api.orders.printPdf(id),
};

export const purchasesController = {
  getAll: (): Promise<IpcResponse<Purchase[]>> => window.api.purchases.getAll(),

  getById: (id: number): Promise<IpcResponse<Purchase>> =>
    window.api.purchases.getById(id),

  generate: (): Promise<
    IpcResponse<{
      purchase_ids: number[];
      orders_processed: number;
      items_synced: number;
    }>
  > => window.api.purchases.generate(),

  submit: (id: number): Promise<IpcResponse> => window.api.purchases.submit(id),

  updateStatus: (id: number, status: PurchaseStatus): Promise<IpcResponse> =>
    window.api.purchases.updateStatus(id, status),

  receiveItem: (id: number, qty: number): Promise<IpcResponse> =>
    window.api.purchases.receiveItem(id, qty),

  delete: (id: number): Promise<IpcResponse> => window.api.purchases.delete(id),

  exportPdf: (
    id: number,
    regenerate = false,
  ): Promise<IpcResponse<{ path: string }>> =>
    window.api.purchases.exportPdf(id, regenerate),

  openPdf: (id: number): Promise<IpcResponse<{ path: string }>> =>
    window.api.purchases.openPdf(id),

  printPdf: (id: number): Promise<IpcResponse<{ path: string }>> =>
    window.api.purchases.printPdf(id),
};

export const reportsController = {
  getDashboardSummary: (): Promise<IpcResponse<DashboardSummary>> =>
    window.api.reports.getDashboardSummary(),

  getOrdersByCustomer: (
    filter: ReportDateFilter & { customer_id?: number | null } = {},
  ): Promise<IpcResponse<OrderByCustomerRow[]>> =>
    window.api.reports.getOrdersByCustomer(filter),

  getOrdersBySupplier: (
    filter: ReportDateFilter & { supplier_id?: number | null } = {},
  ): Promise<IpcResponse<OrderBySupplierRow[]>> =>
    window.api.reports.getOrdersBySupplier(filter),

  getPurchaseHistory: (
    filter: ReportDateFilter & { supplier_id?: number | null } = {},
  ): Promise<IpcResponse<PurchaseHistoryRow[]>> =>
    window.api.reports.getPurchaseHistory(filter),

  getPaymentHistory: (
    filter: ReportDateFilter & {
      type?: "all" | "customer" | "supplier";
    } = {},
  ): Promise<IpcResponse<PaymentHistoryRow[]>> =>
    window.api.reports.getPaymentHistory(filter),
};

export const settingsController = {
  getAll: (): Promise<IpcResponse<AppSettings>> => window.api.settings.getAll(),

  update: (data: Partial<AppSettings>): Promise<IpcResponse<AppSettings>> =>
    window.api.settings.update(data),
};

export const backupController = {
  create: (): Promise<IpcResponse<{ path: string }>> => window.api.backup.create(),

  list: (): Promise<BackupEntry[]> => window.api.backup.list(),

  restore: (
    backupPath: string,
  ): Promise<{ success: boolean; error?: string }> =>
    window.api.backup.restore(backupPath),
};
