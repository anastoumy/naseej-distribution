import { useCallback, useState } from "react";

import { customersController } from "@/lib/controllers";
import type { Customer } from "@/types/Global";

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await customersController.getAll();
      if (res.success && res.data) {
        setCustomers(res.data);
      } else {
        setError(res.error ?? "Failed to load customers");
      }
    } catch {
      setError("Could not reach customer service");
    } finally {
      setLoading(false);
    }
  }, []);

  return { customers, loading, error, fetch, setCustomers };
}

export function useCustomer() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await customersController.getById(id);
      if (res.success && res.data) {
        setCustomer(res.data);
      } else {
        setError(res.error ?? "Failed to load customer");
      }
    } catch {
      setError("Could not reach customer service");
    } finally {
      setLoading(false);
    }
  }, []);

  return { customer, loading, error, fetch };
}
