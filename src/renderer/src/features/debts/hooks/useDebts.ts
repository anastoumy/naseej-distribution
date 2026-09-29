import { useCallback, useEffect, useState } from "react";
import type {
  DebtAccountLedger,
  DebtCollection,
  DebtRepayment,
  OutstandingDebt,
} from "@/types/Global";
import { debtsController } from "../controllers/debtsController";

export function useDebts() {
  const [outstandingCustomers, setOutstandingCustomers] = useState<
    OutstandingDebt[]
  >([]);
  const [prepaymentCustomers, setPrepaymentCustomers] = useState<
    OutstandingDebt[]
  >([]);
  const [outstandingSuppliers, setOutstandingSuppliers] = useState<
    OutstandingDebt[]
  >([]);
  const [collections, setCollections] = useState<DebtCollection[]>([]);
  const [repayments, setRepayments] = useState<DebtRepayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [
      customersRes,
      prepaymentRes,
      suppliersRes,
      collectionsRes,
      repaymentsRes,
    ] = await Promise.all([
      debtsController.getOutstandingCustomers(),
      debtsController.getPrepaymentCustomers(),
      debtsController.getOutstandingSuppliers(),
      debtsController.getCollections(),
      debtsController.getRepayments(),
    ]);

    if (customersRes.success) {
      setOutstandingCustomers(customersRes.data ?? []);
    } else {
      setError(customersRes.error ?? "Failed to load customer debts");
    }

    if (prepaymentRes.success) {
      setPrepaymentCustomers(prepaymentRes.data ?? []);
    }

    if (suppliersRes.success) {
      setOutstandingSuppliers(suppliersRes.data ?? []);
    } else {
      setError((prev) => prev ?? suppliersRes.error ?? "Failed to load supplier debts");
    }

    if (collectionsRes.success) setCollections(collectionsRes.data ?? []);
    if (repaymentsRes.success) setRepayments(repaymentsRes.data ?? []);

    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const getCustomerLedger = useCallback(async (customerId: number) => {
    return debtsController.getCustomerLedger(customerId);
  }, []);

  const getSupplierLedger = useCallback(async (supplierId: number) => {
    return debtsController.getSupplierLedger(supplierId);
  }, []);

  const reconcileCustomer = async (customerId: number) => {
    const res = await debtsController.reconcileCustomer(customerId);
    if (res.success) await reload();
    return res;
  };

  const reconcileSupplier = async (supplierId: number) => {
    const res = await debtsController.reconcileSupplier(supplierId);
    if (res.success) await reload();
    return res;
  };

  const collectFromCustomer = async (data: {
    customer_id: number;
    amount: number;
    notes?: string | null;
    order_id?: number | null;
  }) => {
    const res = await debtsController.collectFromCustomer(data);
    if (res.success) await reload();
    return res;
  };

  const repayToSupplier = async (data: {
    supplier_id: number;
    amount: number;
    notes?: string | null;
  }) => {
    const res = await debtsController.repayToSupplier(data);
    if (res.success) await reload();
    return res;
  };

  const saveCustomerAdjustment = async (data: {
    account_id: number;
    amount: number;
    notes?: string | null;
    effective_date?: string;
    id?: number;
  }) => {
    const res = data.id
      ? await debtsController.updateCustomerAdjustment({
          id: data.id,
          amount: data.amount,
          notes: data.notes,
          effective_date: data.effective_date,
        })
      : await debtsController.createCustomerAdjustment(data);
    if (res.success) await reload();
    return res;
  };

  const saveSupplierAdjustment = async (data: {
    account_id: number;
    amount: number;
    notes?: string | null;
    effective_date?: string;
    id?: number;
  }) => {
    const res = data.id
      ? await debtsController.updateSupplierAdjustment({
          id: data.id,
          amount: data.amount,
          notes: data.notes,
          effective_date: data.effective_date,
        })
      : await debtsController.createSupplierAdjustment(data);
    if (res.success) await reload();
    return res;
  };

  const deleteCustomerAdjustment = async (id: number) => {
    const res = await debtsController.deleteCustomerAdjustment(id);
    if (res.success) await reload();
    return res;
  };

  const deleteSupplierAdjustment = async (id: number) => {
    const res = await debtsController.deleteSupplierAdjustment(id);
    if (res.success) await reload();
    return res;
  };

  const totalCustomerDebt = outstandingCustomers.reduce(
    (sum, c) => sum + c.credit,
    0,
  );
  const totalPrepaymentCredit = prepaymentCustomers.reduce(
    (sum, c) => sum + Math.abs(c.credit),
    0,
  );
  const totalSupplierDebt = outstandingSuppliers.reduce(
    (sum, s) => sum + s.credit,
    0,
  );

  return {
    outstandingCustomers,
    prepaymentCustomers,
    outstandingSuppliers,
    collections,
    repayments,
    totalCustomerDebt,
    totalPrepaymentCredit,
    totalSupplierDebt,
    loading,
    error,
    reload,
    getCustomerLedger,
    getSupplierLedger,
    reconcileCustomer,
    reconcileSupplier,
    collectFromCustomer,
    repayToSupplier,
    saveCustomerAdjustment,
    saveSupplierAdjustment,
    deleteCustomerAdjustment,
    deleteSupplierAdjustment,
  };
}

export type { DebtAccountLedger };
