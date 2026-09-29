import type { IpcResponse, InventoryRow } from "@/types/Global";

export const inventoryController = {
  getAll: (): Promise<IpcResponse<InventoryRow[]>> =>
    window.api.inventory.getAll(),

  getByProduct: (productId: number): Promise<IpcResponse<InventoryRow[]>> =>
    window.api.inventory.getByProduct(productId),

  adjust: (data: { product_id: number; flavor_id?: number | null; delta: number }): Promise<IpcResponse> =>
    window.api.inventory.adjust(data),

  setQty: (data: { product_id: number; flavor_id?: number | null; qty: number }): Promise<IpcResponse> =>
    window.api.inventory.setQty(data),
};
