import { useState, useCallback, useEffect } from "react";
import type { Customer } from "@/types/Global";
import { customersController } from "../controllers/customersController";

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await customersController.getAll();
    if (res.success) setCustomers(res.data ?? []);
    else setError(res.error ?? "Failed to load customers");
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
    const res = await customersController.create(data);
    if (res.success) await reload();
    return res;
  };

  const update = async (data: { id: number; name?: string; phone?: string | null }) => {
    const res = await customersController.update(data);
    if (res.success) await reload();
    return res;
  };

  const remove = async (id: number) => {
    const res = await customersController.delete(id);
    if (res.success) await reload();
    return res;
  };

  return { customers, loading, error, reload, create, update, remove };
}
