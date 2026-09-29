import { useState, useCallback, useEffect } from "react";
import type { Supplier } from "@/types/Global";
import { suppliersController } from "../controllers/suppliersController";

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await suppliersController.getAll();
    if (res.success) setSuppliers(res.data ?? []);
    else setError(res.error ?? "Failed to load suppliers");
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const create = async (data: {
    name: string;
    phone?: string;
    opening_balance?: number;
    opening_balance_notes?: string;
    opening_balance_date?: string;
  }) => {
    const res = await suppliersController.create(data);
    if (res.success) await reload();
    return res;
  };

  const update = async (data: { id: number; name?: string; phone?: string | null }) => {
    const res = await suppliersController.update(data);
    if (res.success) await reload();
    return res;
  };

  const remove = async (id: number) => {
    const res = await suppliersController.delete(id);
    if (res.success) await reload();
    return res;
  };

  return { suppliers, loading, error, reload, create, update, remove };
}
