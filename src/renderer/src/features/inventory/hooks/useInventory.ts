import { useState, useCallback, useEffect } from "react";
import type { InventoryRow } from "@/types/Global";
import { inventoryController } from "../controllers/inventoryController";

export function useInventory() {
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await inventoryController.getAll();
    if (res.success) setInventory(res.data ?? []);
    else setError(res.error ?? "Failed to load inventory");
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const adjust = async (data: { product_id: number; flavor_id?: number | null; delta: number }) => {
    const res = await inventoryController.adjust(data);
    if (res.success) await reload();
    return res;
  };

  const setQty = async (data: { product_id: number; flavor_id?: number | null; qty: number }) => {
    const res = await inventoryController.setQty(data);
    if (res.success) await reload();
    return res;
  };

  return { inventory, loading, error, reload, adjust, setQty };
}
