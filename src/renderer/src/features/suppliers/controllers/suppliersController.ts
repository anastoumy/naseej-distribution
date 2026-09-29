import type { IpcResponse, Supplier } from "@/types/Global";

export const suppliersController = {
  getAll: (): Promise<IpcResponse<Supplier[]>> =>
    window.api.suppliers.getAll(),

  getById: (id: number): Promise<IpcResponse<Supplier>> =>
    window.api.suppliers.getById(id),

  create: (data: {
    name: string;
    phone?: string;
    opening_balance?: number;
    opening_balance_notes?: string;
    opening_balance_date?: string;
  }): Promise<IpcResponse<{ id: number }>> =>
    window.api.suppliers.create(data),

  update: (data: { id: number; name?: string; phone?: string | null }): Promise<IpcResponse> =>
    window.api.suppliers.update(data),

  delete: (id: number): Promise<IpcResponse> =>
    window.api.suppliers.delete(id),
};
