import type { IpcResponse, Customer } from "@/types/Global";

export const customersController = {
  getAll: (): Promise<IpcResponse<Customer[]>> =>
    window.api.customers.getAll(),

  getById: (id: number): Promise<IpcResponse<Customer>> =>
    window.api.customers.getById(id),

  create: (data: {
    name: string;
    phone?: string;
    opening_balance?: number;
    opening_balance_notes?: string;
    opening_balance_date?: string;
  }): Promise<IpcResponse<{ id: number }>> =>
    window.api.customers.create(data),

  update: (data: { id: number; name?: string; phone?: string | null }): Promise<IpcResponse> =>
    window.api.customers.update(data),

  delete: (id: number): Promise<IpcResponse> =>
    window.api.customers.delete(id),
};
