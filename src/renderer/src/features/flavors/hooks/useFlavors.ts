import { useState, useCallback, useEffect } from "react";
import type { Flavor } from "@/types/Global";
import { flavorsController } from "../controllers/flavorsController";

export function useFlavors() {
  const [flavors, setFlavors] = useState<Flavor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await flavorsController.getAll();
    if (res.success) setFlavors(res.data ?? []);
    else setError(res.error ?? "Failed to load flavors");
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const create = async (data: { name: string }) => {
    const res = await flavorsController.create(data);
    if (res.success) await reload();
    return res;
  };

  const update = async (data: { id: number; name: string }) => {
    const res = await flavorsController.update(data);
    if (res.success) await reload();
    return res;
  };

  const remove = async (id: number) => {
    const res = await flavorsController.delete(id);
    if (res.success) await reload();
    return res;
  };

  return { flavors, loading, error, reload, create, update, remove };
}
