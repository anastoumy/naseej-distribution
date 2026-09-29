import type {
  DashboardSummary,
  IpcResponse,
  OrderByCustomerRow,
  OrderBySupplierRow,
  PaymentHistoryRow,
  PurchaseHistoryRow,
  ReportDateFilter,
} from "@/types/Global";

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
