import { useState, useCallback, useEffect } from "react";
import type { Category } from "@/types/Global";
import { categoriesController } from "../controllers/categoriesController";

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await categoriesController.getAll();
    if (res.success) setCategories(res.data ?? []);
    else setError(res.error ?? "Failed to load categories");
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const create = async (data: { title: string; parent_id?: number | null }) => {
    const res = await categoriesController.create(data);
    if (res.success) await reload();
    return res;
  };

  const update = async (data: { id: number; title?: string; parent_id?: number | null }) => {
    const res = await categoriesController.update(data);
    if (res.success) await reload();
    return res;
  };

  const remove = async (id: number) => {
    const res = await categoriesController.delete(id);
    if (res.success) await reload();
    return res;
  };

  return { categories, loading, error, reload, create, update, remove };
}
