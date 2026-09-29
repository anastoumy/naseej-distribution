import type { IpcResponse, Order, OrderPaymentType, OrderStatus } from "@/types/Global";

export type OrderItemInput = {
  product_id: number;
  flavor_id?: number | null;
  quantity: number;
  price: number;
  tax_amount?: number;
  deducted_qty?: number;
};

export const ordersController = {
  getAll: (): Promise<IpcResponse<Order[]>> => window.api.orders.getAll(),

  getById: (id: number): Promise<IpcResponse<Order>> =>
    window.api.orders.getById(id),

  create: (data: {
    customer_id: number;
    payment_type?: OrderPaymentType;
    notes?: string | null;
    items?: OrderItemInput[];
    total_price?: number;
  }): Promise<IpcResponse<{ id: number }>> => window.api.orders.create(data),

  update: (data: {
    id: number;
    customer_id?: number;
    payment_type?: OrderPaymentType;
    notes?: string | null;
    items?: OrderItemInput[];
    total_price?: number;
  }): Promise<IpcResponse> => window.api.orders.update(data),

  updateStatus: (data: {
    id: number;
    status: OrderStatus;
  }): Promise<IpcResponse> => window.api.orders.updateStatus(data),

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

  markDelivered: (id: number): Promise<IpcResponse> =>
    window.api.orders.markDelivered(id),
};
