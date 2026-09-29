import { useCallback, useEffect, useState } from "react";
import type { Purchase, PurchaseStatus } from "@/types/Global";
import { purchasesController } from "../controllers/purchasesController";

export function usePurchases() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await purchasesController.getAll();
    if (res.success) setPurchases(res.data ?? []);
    else setError(res.error ?? "Failed to load purchases");
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const getById = useCallback(async (id: number) => {
    return purchasesController.getById(id);
  }, []);

  const generate = async () => {
    const res = await purchasesController.generate();
    if (res.success) await reload();
    return res;
  };

  const submit = async (id: number) => {
    const res = await purchasesController.submit(id);
    if (res.success) await reload();
    return res;
  };

  const updateStatus = async (id: number, status: PurchaseStatus) => {
    const res = await purchasesController.updateStatus(id, status);
    if (res.success) await reload();
    return res;
  };

  const receiveItem = async (id: number, qty: number) => {
    const res = await purchasesController.receiveItem(id, qty);
    if (res.success) await reload();
    return res;
  };

  const remove = async (id: number) => {
    const res = await purchasesController.delete(id);
    if (res.success) await reload();
    return res;
  };

  return {
    purchases,
    loading,
    error,
    reload,
    getById,
    generate,
    submit,
    updateStatus,
    receiveItem,
    remove,
  };
}
