import type {
  DebtAccountLedger,
  DebtCollection,
  DebtRepayment,
  IpcResponse,
  OutstandingDebt,
} from "@/types/Global";
import {
  customerDebtAdjustmentsController,
  debtCollectionsController,
  debtRepaymentsController,
  supplierDebtAdjustmentsController,
} from "@/lib/controllers";

export const debtsController = {
  getOutstandingCustomers: (): Promise<IpcResponse<OutstandingDebt[]>> =>
    debtCollectionsController.getOutstanding(),

  getPrepaymentCustomers: (): Promise<IpcResponse<OutstandingDebt[]>> =>
    debtCollectionsController.getPrepaymentAccounts(),

  getOutstandingSuppliers: (): Promise<IpcResponse<OutstandingDebt[]>> =>
    debtRepaymentsController.getOutstanding(),

  getCustomerLedger: (
    customerId: number,
  ): Promise<IpcResponse<DebtAccountLedger>> =>
    debtCollectionsController.getCustomerLedger(customerId),

  getSupplierLedger: (
    supplierId: number,
  ): Promise<IpcResponse<DebtAccountLedger>> =>
    debtRepaymentsController.getSupplierLedger(supplierId),

  reconcileCustomer: (customerId: number) =>
    debtCollectionsController.reconcileCustomer(customerId),

  reconcileSupplier: (supplierId: number) =>
    debtRepaymentsController.reconcileSupplier(supplierId),

  getCollections: (): Promise<IpcResponse<DebtCollection[]>> =>
    debtCollectionsController.getAll(),

  getRepayments: (): Promise<IpcResponse<DebtRepayment[]>> =>
    debtRepaymentsController.getAll(),

  collectFromCustomer: (data: {
    customer_id: number;
    amount: number;
    notes?: string | null;
    order_id?: number | null;
  }): Promise<IpcResponse<{ id: number }>> =>
    debtCollectionsController.create(data),

  repayToSupplier: (data: {
    supplier_id: number;
    amount: number;
    notes?: string | null;
  }): Promise<IpcResponse<{ id: number }>> =>
    debtRepaymentsController.create(data),

  createCustomerAdjustment: (data: {
    account_id: number;
    amount: number;
    notes?: string | null;
    effective_date?: string;
  }) => customerDebtAdjustmentsController.create(data),

  updateCustomerAdjustment: (data: {
    id: number;
    amount: number;
    notes?: string | null;
    effective_date?: string;
  }) => customerDebtAdjustmentsController.update(data),

  deleteCustomerAdjustment: (id: number) =>
    customerDebtAdjustmentsController.delete(id),

  createSupplierAdjustment: (data: {
    account_id: number;
    amount: number;
    notes?: string | null;
    effective_date?: string;
  }) => supplierDebtAdjustmentsController.create(data),

  updateSupplierAdjustment: (data: {
    id: number;
    amount: number;
    notes?: string | null;
    effective_date?: string;
  }) => supplierDebtAdjustmentsController.update(data),

  deleteSupplierAdjustment: (id: number) =>
    supplierDebtAdjustmentsController.delete(id),
};
