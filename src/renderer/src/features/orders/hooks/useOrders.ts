import { useCallback, useEffect, useState } from "react";
import type { Order, OrderPaymentType, OrderStatus } from "@/types/Global";
import {
  ordersController,
  type OrderItemInput,
} from "../controllers/ordersController";

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await ordersController.getAll();
    if (res.success) setOrders(res.data ?? []);
    else setError(res.error ?? "Failed to load orders");
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const getById = useCallback(async (id: number) => {
    return ordersController.getById(id);
  }, []);

  const create = async (data: {
    customer_id: number;
    payment_type?: OrderPaymentType;
    notes?: string | null;
    items?: OrderItemInput[];
    total_price?: number;
  }) => {
    const res = await ordersController.create(data);
    if (res.success) await reload();
    return res;
  };

  const update = async (data: {
    id: number;
    customer_id?: number;
    payment_type?: OrderPaymentType;
    notes?: string | null;
    items?: OrderItemInput[];
    total_price?: number;
  }) => {
    const res = await ordersController.update(data);
    if (res.success) await reload();
    return res;
  };

  const updateStatus = async (data: { id: number; status: OrderStatus }) => {
    const res = await ordersController.updateStatus(data);
    if (res.success) await reload();
    return res;
  };

  const markDelivered = async (id: number) => {
    const res = await ordersController.markDelivered(id);
    if (res.success) await reload();
    return res;
  };

  const remove = async (id: number) => {
    const res = await ordersController.delete(id);
    if (res.success) await reload();
    return res;
  };

  return {
    orders,
    loading,
    error,
    reload,
    getById,
    create,
    update,
    updateStatus,
    markDelivered,
    remove,
  };
}
