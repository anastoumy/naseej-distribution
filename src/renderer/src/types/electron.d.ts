import type {
  IpcResponse,
  Category,
  Flavor,
  Supplier,
  Customer,
  DebtCollection,
  DebtRepayment,
  DebtAccountLedger,
  DebtAdjustment,
  CreditReconciliation,
  OutstandingDebt,
  Product,
  InventoryRow,
  Order,
  OrderFulfillmentStatus,
  OrderPaymentType,
  OrderStatus,
  Purchase,
  PurchaseStatus,
  DashboardSummary,
  OrderByCustomerRow,
  OrderBySupplierRow,
  PurchaseHistoryRow,
  PaymentHistoryRow,
  ReportDateFilter,
  AppSettings,
  BackupEntry,
} from "./Global";

declare global {
  interface Window {
    api: {
      getPlatform: () => string;
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;

      categories: {
        getAll: () => Promise<IpcResponse<Category[]>>;
        create: (data: {
          title: string;
          parent_id?: number | null;
        }) => Promise<IpcResponse<{ id: number }>>;
        update: (data: {
          id: number;
          title?: string;
          parent_id?: number | null;
        }) => Promise<IpcResponse>;
        delete: (id: number) => Promise<IpcResponse>;
      };

      flavors: {
        getAll: () => Promise<IpcResponse<Flavor[]>>;
        create: (data: {
          name: string;
        }) => Promise<IpcResponse<{ id: number }>>;
        update: (data: { id: number; name: string }) => Promise<IpcResponse>;
        delete: (id: number) => Promise<IpcResponse>;
      };

      suppliers: {
        getAll: () => Promise<IpcResponse<Supplier[]>>;
        getById: (id: number) => Promise<IpcResponse<Supplier>>;
        create: (data: {
          name: string;
          phone?: string;
          opening_balance?: number;
          opening_balance_notes?: string;
          opening_balance_date?: string;
        }) => Promise<IpcResponse<{ id: number }>>;
        update: (data: {
          id: number;
          name?: string;
          phone?: string | null;
        }) => Promise<IpcResponse>;
        delete: (id: number) => Promise<IpcResponse>;
      };

      customers: {
        getAll: () => Promise<IpcResponse<Customer[]>>;
        getById: (id: number) => Promise<IpcResponse<Customer>>;
        create: (data: {
          name: string;
          phone?: string;
          opening_balance?: number;
          opening_balance_notes?: string;
          opening_balance_date?: string;
        }) => Promise<IpcResponse<{ id: number }>>;
        update: (data: {
          id: number;
          name?: string;
          phone?: string | null;
        }) => Promise<IpcResponse>;
        delete: (id: number) => Promise<IpcResponse>;
      };

      debtCollections: {
        getAll: () => Promise<IpcResponse<DebtCollection[]>>;
        getById: (id: number) => Promise<IpcResponse<DebtCollection>>;
        getCustomerLedger: (
          customerId: number,
        ) => Promise<IpcResponse<DebtAccountLedger>>;
        getOutstanding: () => Promise<IpcResponse<OutstandingDebt[]>>;
        getPrepaymentAccounts: () => Promise<IpcResponse<OutstandingDebt[]>>;
        reconcileCustomer: (
          customerId: number,
        ) => Promise<IpcResponse<CreditReconciliation>>;
        verifyAllCustomers: () => Promise<
          IpcResponse<
            Array<
              OutstandingDebt & {
                stored_credit: number;
                computed_credit: number;
                difference: number;
                in_sync: boolean;
              }
            >
          >
        >;
        create: (data: {
          customer_id: number;
          amount: number;
          notes?: string | null;
          order_id?: number | null;
        }) => Promise<IpcResponse<{ id: number }>>;
        delete: (id: number) => Promise<IpcResponse>;
      };

      debtRepayments: {
        getAll: () => Promise<IpcResponse<DebtRepayment[]>>;
        getById: (id: number) => Promise<IpcResponse<DebtRepayment>>;
        getSupplierLedger: (
          supplierId: number,
        ) => Promise<IpcResponse<DebtAccountLedger>>;
        getOutstanding: () => Promise<IpcResponse<OutstandingDebt[]>>;
        reconcileSupplier: (
          supplierId: number,
        ) => Promise<IpcResponse<CreditReconciliation>>;
        verifyAllSuppliers: () => Promise<
          IpcResponse<
            Array<
              OutstandingDebt & {
                stored_credit: number;
                computed_credit: number;
                difference: number;
                in_sync: boolean;
              }
            >
          >
        >;
        create: (data: {
          supplier_id: number;
          amount: number;
          notes?: string | null;
        }) => Promise<IpcResponse<{ id: number }>>;
        delete: (id: number) => Promise<IpcResponse>;
      };

      customerDebtAdjustments: {
        getByCustomer: (
          customerId: number,
        ) => Promise<IpcResponse<DebtAdjustment[]>>;
        create: (data: {
          account_id: number;
          amount: number;
          notes?: string | null;
          effective_date?: string;
        }) => Promise<IpcResponse<{ id: number }>>;
        update: (data: {
          id: number;
          amount: number;
          notes?: string | null;
          effective_date?: string;
        }) => Promise<IpcResponse>;
        delete: (id: number) => Promise<IpcResponse>;
      };

      supplierDebtAdjustments: {
        getBySupplier: (
          supplierId: number,
        ) => Promise<IpcResponse<DebtAdjustment[]>>;
        create: (data: {
          account_id: number;
          amount: number;
          notes?: string | null;
          effective_date?: string;
        }) => Promise<IpcResponse<{ id: number }>>;
        update: (data: {
          id: number;
          amount: number;
          notes?: string | null;
          effective_date?: string;
        }) => Promise<IpcResponse>;
        delete: (id: number) => Promise<IpcResponse>;
      };

      products: {
        getAll: () => Promise<IpcResponse<Product[]>>;
        getById: (id: number) => Promise<IpcResponse<Product>>;
        getImageDataUrl: (imagePath: string) => Promise<IpcResponse<string>>;
        create: (data: {
          title: string;
          category_id?: number | null;
          supplier_id?: number | null;
          price: number;
          wholesale_price: number;
          purchase_price: number;
          taxable?: boolean;
          flavors?: {
            flavor_id: number;
            price: number;
            wholesale_price?: number;
            purchase_price?: number;
          }[];
          flavor_ids?: number[];
          imageDataUrl?: string;
        }) => Promise<IpcResponse<{ id: number }>>;
        update: (data: {
          id: number;
          title?: string;
          category_id?: number | null;
          supplier_id?: number | null;
          price?: number;
          wholesale_price?: number;
          purchase_price?: number;
          taxable?: boolean;
          flavors?: {
            flavor_id: number;
            price: number;
            wholesale_price?: number;
            purchase_price?: number;
          }[];
          flavor_ids?: number[];
          imageDataUrl?: string;
        }) => Promise<IpcResponse>;
        delete: (id: number) => Promise<IpcResponse>;
      };

      inventory: {
        getAll: () => Promise<IpcResponse<InventoryRow[]>>;
        getByProduct: (
          productId: number,
        ) => Promise<IpcResponse<InventoryRow[]>>;
        adjust: (data: {
          product_id: number;
          flavor_id?: number | null;
          delta: number;
        }) => Promise<IpcResponse>;
        setQty: (data: {
          product_id: number;
          flavor_id?: number | null;
          qty: number;
        }) => Promise<IpcResponse>;
      };

      orders: {
        getAll: () => Promise<IpcResponse<Order[]>>;
        getById: (id: number) => Promise<IpcResponse<Order>>;
        create: (data: {
          customer_id: number;
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
        }) => Promise<IpcResponse<{ id: number }>>;
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
        }) => Promise<
          IpcResponse<{
            id: number;
            status: OrderStatus;
            debt: number;
            prepayment: number;
            creditUsed: number;
            amount_paid: number;
            total: number;
          }>
        >;
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
        }) => Promise<IpcResponse>;
        updateStatus: (data: {
          id: number;
          status: OrderStatus;
        }) => Promise<IpcResponse>;
        addItem: (data: {
          order_id: number;
          product_id: number;
          flavor_id?: number | null;
          quantity: number;
          price: number;
          tax_amount?: number;
          deducted_qty?: number;
        }) => Promise<IpcResponse<{ id: number }>>;
        deductItem: (id: number, qty: number) => Promise<IpcResponse>;
        delete: (id: number) => Promise<IpcResponse>;
        exportPdf: (
          id: number,
          regenerate?: boolean,
        ) => Promise<IpcResponse<{ path: string }>>;
        openPdf: (id: number) => Promise<IpcResponse<{ path: string }>>;
        printPdf: (id: number) => Promise<IpcResponse<{ path: string }>>;
        markDelivered: (id: number) => Promise<IpcResponse>;
      };

      purchases: {
        getAll: () => Promise<IpcResponse<Purchase[]>>;
        getById: (id: number) => Promise<IpcResponse<Purchase>>;
        generate: () => Promise<
          IpcResponse<{
            purchase_ids: number[];
            orders_processed: number;
            items_synced: number;
          }>
        >;
        submit: (id: number) => Promise<IpcResponse>;
        updateStatus: (id: number, status: PurchaseStatus) => Promise<IpcResponse>;
        receiveItem: (id: number, qty: number) => Promise<IpcResponse>;
        delete: (id: number) => Promise<IpcResponse>;
        exportPdf: (
          id: number,
          regenerate?: boolean,
        ) => Promise<IpcResponse<{ path: string }>>;
        openPdf: (id: number) => Promise<IpcResponse<{ path: string }>>;
        printPdf: (id: number) => Promise<IpcResponse<{ path: string }>>;
      };

      reports: {
        getDashboardSummary: () => Promise<IpcResponse<DashboardSummary>>;
        getOrdersByCustomer: (
          filter?: ReportDateFilter & { customer_id?: number | null },
        ) => Promise<IpcResponse<OrderByCustomerRow[]>>;
        getOrdersBySupplier: (
          filter?: ReportDateFilter & { supplier_id?: number | null },
        ) => Promise<IpcResponse<OrderBySupplierRow[]>>;
        getPurchaseHistory: (
          filter?: ReportDateFilter & { supplier_id?: number | null },
        ) => Promise<IpcResponse<PurchaseHistoryRow[]>>;
        getPaymentHistory: (
          filter?: ReportDateFilter & {
            type?: "all" | "customer" | "supplier";
          },
        ) => Promise<IpcResponse<PaymentHistoryRow[]>>;
      };

      settings: {
        getAll: () => Promise<IpcResponse<AppSettings>>;
        update: (data: Partial<AppSettings>) => Promise<IpcResponse<AppSettings>>;
      };

      backup: {
        create: () => Promise<IpcResponse<{ path: string }>>;
        list: () => Promise<BackupEntry[]>;
        restore: (backupPath: string) => Promise<{ success: boolean; error?: string }>;
      };
    };
  }
}

export {};
