import type { IpcResponse, Flavor } from "@/types/Global";

export const flavorsController = {
  getAll: (): Promise<IpcResponse<Flavor[]>> =>
    window.api.flavors.getAll(),

  create: (data: { name: string }): Promise<IpcResponse<{ id: number }>> =>
    window.api.flavors.create(data),

  update: (data: { id: number; name: string }): Promise<IpcResponse> =>
    window.api.flavors.update(data),

  delete: (id: number): Promise<IpcResponse> =>
    window.api.flavors.delete(id),
};
