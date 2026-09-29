import type { IpcResponse, Product } from "@/types/Global";
import type { ProductFormInput, ProductUpdateInput } from "../types";

export const productsController = {
  getAll: (): Promise<IpcResponse<Product[]>> => window.api.products.getAll(),

  getById: (id: number): Promise<IpcResponse<Product>> =>
    window.api.products.getById(id),

  create: (data: ProductFormInput): Promise<IpcResponse<{ id: number }>> => {
    const imageFile = data.imageFile;
    if (imageFile) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const { imageFile: _imageFile, ...rest } = data;
          window.api.products
            .create({ ...rest, imageDataUrl: reader.result as string })
            .then(resolve);
        };
        reader.readAsDataURL(imageFile);
      });
    }
    return window.api.products.create(data);
  },

  update: (data: ProductUpdateInput): Promise<IpcResponse> => {
    const imageFile = data.imageFile;
    if (imageFile) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const { imageFile: _imageFile, ...rest } = data;
          window.api.products
            .update({ ...rest, imageDataUrl: reader.result as string })
            .then(resolve);
        };
        reader.readAsDataURL(imageFile);
      });
    }
    return window.api.products.update(data);
  },

  delete: (id: number): Promise<IpcResponse> => window.api.products.delete(id),
};
