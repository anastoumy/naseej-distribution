import type { IpcResponse, Purchase, PurchaseStatus } from "@/types/Global";

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
