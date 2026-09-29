import type { IpcResponse, Category } from "@/types/Global";

export const categoriesController = {
  getAll: (): Promise<IpcResponse<Category[]>> =>
    window.api.categories.getAll(),

  create: (data: { title: string; parent_id?: number | null }): Promise<IpcResponse<{ id: number }>> =>
    window.api.categories.create(data),

  update: (data: { id: number; title?: string; parent_id?: number | null }): Promise<IpcResponse> =>
    window.api.categories.update(data),

  delete: (id: number): Promise<IpcResponse> =>
    window.api.categories.delete(id),
};
