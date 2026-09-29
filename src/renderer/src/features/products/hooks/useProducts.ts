import { useState, useCallback, useEffect } from "react";
import type { Product } from "@/types/Global";
import { productsController } from "../controllers/productsController";
import type { ProductFormInput, ProductUpdateInput } from "../types";

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await productsController.getAll();
    if (res.success) setProducts(res.data ?? []);
    else setError(res.error ?? "Failed to load products");
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const create = async (data: ProductFormInput) => {
    const res = await productsController.create(data);
    if (res.success) await reload();
    return res;
  };

  const update = async (data: ProductUpdateInput) => {
    const res = await productsController.update(data);
    if (res.success) await reload();
    return res;
  };

  const remove = async (id: number) => {
    const res = await productsController.delete(id);
    if (res.success) await reload();
    return res;
  };

  return { products, loading, error, reload, create, update, remove };
}
