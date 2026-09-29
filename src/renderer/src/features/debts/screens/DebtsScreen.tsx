import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Banknote,
  Eye,
  History,
  Search,
  Users,
  Truck,
} from "lucide-react";
import { useDebts, type DebtAccountLedger } from "../hooks/useDebts";
import { CollectDebtModal } from "../forms/CollectDebtModal";
import { RepayDebtModal } from "../forms/RepayDebtModal";
import { AdjustDebtModal } from "../forms/AdjustDebtModal";
import { DebtLedgerTable } from "../components/DebtLedgerTable";
import { useCustomers } from "@/features/customers/hooks/useCustomers";
import { useSuppliers } from "@/features/suppliers/hooks/useSuppliers";
import { useToast } from "@/components/ui/custom/toast/useToast";
import { formatDate, formatJOD } from "@/lib/utils";
import type { DebtAdjustment, DebtLedgerEntry, OutstandingDebt } from "@/types/Global";

type DebtTab = "customers" | "suppliers";
type ViewMode = "list" | "ledger";

export function DebtsScreen() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { customers } = useCustomers();
  const { suppliers } = useSuppliers();
  const {
    outstandingCustomers,
    prepaymentCustomers,
    outstandingSuppliers,
    collections,
    repayments,
    totalCustomerDebt,
    totalPrepaymentCredit,
    totalSupplierDebt,
    loading,
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
    reload,
  } = useDebts();

  const [tab, setTab] = useState<DebtTab>("customers");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [ledger, setLedger] = useState<DebtAccountLedger | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [showCollect, setShowCollect] = useState(false);
  const [showRepay, setShowRepay] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [editingAdjustment, setEditingAdjustment] = useState<DebtAdjustment | null>(
    null,
  );
  const [preselectedCustomerId, setPreselectedCustomerId] = useState<
    number | null
  >(null);
  const [preselectedSupplierId, setPreselectedSupplierId] = useState<
    number | null
  >(null);

  const [reconciling, setReconciling] = useState(false);

  const formatAccountBalance = (credit: number) => {
    if (credit < 0) {
      return {
        label: t("debts.prepaymentBalance"),
        value: formatJOD(Math.abs(credit)),
        className: "text-success",
      };
    }
    return {
      label: t("debts.outstandingBalance"),
      value: formatJOD(credit),
      className: credit > 0 ? "text-destructive" : "text-muted-foreground",
    };
  };

  const activeList =
    tab === "customers" ? outstandingCustomers : outstandingSuppliers;

  const filtered = activeList.filter(
    (row) =>
      row.name.toLowerCase().includes(search.toLowerCase()) ||
      (row.phone ?? "").includes(search),
  );

  const recentTransactions =
    tab === "customers" ? collections.slice(0, 8) : repayments.slice(0, 8);

  useEffect(() => {
    setViewMode("list");
    setLedger(null);
    setSearch("");
  }, [tab]);

  const openCustomerLedger = async (customer: OutstandingDebt) => {
    setLedgerLoading(true);
    setViewMode("ledger");
    const res = await getCustomerLedger(customer.id);
    setLedgerLoading(false);
    if (res.success && res.data) {
      setLedger(res.data);
    } else {
      setLedger({
        id: customer.id,
        name: customer.name,
        credit: customer.credit,
        ledger: [],
      });
    }
  };

  const openSupplierLedger = async (supplier: OutstandingDebt) => {
    setLedgerLoading(true);
    setViewMode("ledger");
    const res = await getSupplierLedger(supplier.id);
    setLedgerLoading(false);
    if (res.success && res.data) {
      setLedger(res.data);
    } else {
      setLedger({
        id: supplier.id,
        name: supplier.name,
        credit: supplier.credit,
        ledger: [],
      });
    }
  };

  const handleBackToList = () => {
    setViewMode("list");
    setLedger(null);
    void reload();
  };

  const openCollect = (customerId?: number) => {
    setPreselectedCustomerId(customerId ?? null);
    setShowCollect(true);
  };

  const openRepay = (supplierId?: number) => {
    setPreselectedSupplierId(supplierId ?? null);
    setShowRepay(true);
  };

  const openAdjust = (adjustment?: DebtAdjustment | null) => {
    setEditingAdjustment(adjustment ?? null);
    setShowAdjust(true);
  };

  const refreshLedger = async (accountId: number) => {
    const ledgerRes =
      tab === "customers"
        ? await getCustomerLedger(accountId)
        : await getSupplierLedger(accountId);
    if (ledgerRes.success && ledgerRes.data) {
      setLedger(ledgerRes.data);
    }
  };

  const handleSaveAdjustment = async (data: {
    account_id: number;
    amount: number;
    notes?: string | null;
    effective_date?: string;
    id?: number;
  }) => {
    const res =
      tab === "customers"
        ? await saveCustomerAdjustment(data)
        : await saveSupplierAdjustment(data);

    if (res.success && viewMode === "ledger" && ledger) {
      await refreshLedger(ledger.id);
    }

    return res;
  };

  const handleEditLedgerAdjustment = (entry: DebtLedgerEntry) => {
    setEditingAdjustment({
      id: entry.reference_id,
      amount: entry.amount,
      notes: entry.description,
      effective_date: entry.created_at,
      created_at: entry.created_at,
    });
    setShowAdjust(true);
  };

  const handleDeleteLedgerAdjustment = async (entry: DebtLedgerEntry) => {
    if (!confirm(t("debts.deleteAdjustmentConfirm"))) return;

    const res =
      tab === "customers"
        ? await deleteCustomerAdjustment(entry.reference_id)
        : await deleteSupplierAdjustment(entry.reference_id);

    if (!res.success) {
      toast({ variant: "error", title: res.error ?? t("common.error") });
      return;
    }

    toast({ variant: "success", title: t("debts.adjustmentDeleteSuccess") });
    if (ledger) {
      await refreshLedger(ledger.id);
    }
  };

  const accountOptions: OutstandingDebt[] =
    tab === "customers"
      ? customers.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          credit: c.credit,
        }))
      : suppliers.map((s) => ({
          id: s.id,
          name: s.name,
          phone: s.phone,
          credit: s.credit,
        }));

  const handleReconcile = async () => {
    if (!ledger) return;
    setReconciling(true);
    const res =
      tab === "customers"
        ? await reconcileCustomer(ledger.id)
        : await reconcileSupplier(ledger.id);
    setReconciling(false);

    if (res.success) {
      const ledgerRes =
        tab === "customers"
          ? await getCustomerLedger(ledger.id)
          : await getSupplierLedger(ledger.id);
      if (ledgerRes.success && ledgerRes.data) {
        setLedger(ledgerRes.data);
      }
    }
  };

  if (viewMode === "ledger" && ledger) {
    const balance = formatAccountBalance(ledger.credit);
    const reconciliation = ledger.reconciliation;

    return (
      <div className="flex flex-col gap-6 h-full">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              onClick={handleBackToList}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer mt-0.5"
              aria-label={t("debts.backToList")}
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {ledger.name}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t("debts.ledgerSubtitle")}
              </p>
            </div>
          </div>

          {tab === "customers" ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => openAdjust()}
                className="flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm hover:bg-secondary transition-colors cursor-pointer"
              >
                <History size={16} />
                {t("debts.addAdjustment")}
              </button>
              <button
                onClick={() => openCollect(ledger.id)}
                disabled={ledger.credit <= 0}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm hover:bg-accent/90 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Banknote size={16} />
                {t("debts.collectPayment")}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => openAdjust()}
                className="flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm hover:bg-secondary transition-colors cursor-pointer"
              >
                <History size={16} />
                {t("debts.addAdjustment")}
              </button>
              <button
                onClick={() => openRepay(ledger.id)}
                disabled={ledger.credit <= 0}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm hover:bg-accent/90 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Banknote size={16} />
                {t("debts.repayPayment")}
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-start gap-4">
          <div className="px-4 py-3 rounded-lg bg-card border border-border w-fit">
            <p className="text-xs text-muted-foreground">{balance.label}</p>
            <p className={`text-xl font-semibold mt-0.5 ${balance.className}`}>
              {balance.value}
            </p>
          </div>

          {reconciliation && (
            <div
              className={`px-4 py-3 rounded-lg border w-fit ${
                reconciliation.in_sync
                  ? "bg-card border-border"
                  : "bg-warning/10 border-warning/30"
              }`}
            >
              <p className="text-xs text-muted-foreground">
                {t("debts.reconciliationTitle")}
              </p>
              <p className="text-sm font-medium text-foreground mt-0.5">
                {reconciliation.in_sync
                  ? t("debts.reconciliationInSync")
                  : t("debts.reconciliationMismatch", {
                      stored: formatJOD(reconciliation.stored_credit),
                      computed: formatJOD(reconciliation.computed_credit),
                    })}
              </p>
              {!reconciliation.in_sync && (
                <button
                  onClick={() => void handleReconcile()}
                  disabled={reconciling}
                  className="mt-2 text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {reconciling
                    ? t("common.loading")
                    : t("debts.reconcileBalance")}
                </button>
              )}
            </div>
          )}
        </div>

        <DebtLedgerTable
          ledger={ledger.ledger}
          loading={ledgerLoading}
          onEditAdjustment={handleEditLedgerAdjustment}
          onDeleteAdjustment={(entry) => void handleDeleteLedgerAdjustment(entry)}
        />

        <AdjustDebtModal
          open={showAdjust}
          onClose={() => {
            setShowAdjust(false);
            setEditingAdjustment(null);
          }}
          accountType={tab === "customers" ? "customer" : "supplier"}
          accounts={accountOptions}
          fixedAccountId={ledger.id}
          adjustment={editingAdjustment}
          onSave={handleSaveAdjustment}
        />

        <CollectDebtModal
          open={showCollect}
          onClose={() => {
            setShowCollect(false);
            setPreselectedCustomerId(null);
          }}
          customers={outstandingCustomers}
          preselectedCustomerId={preselectedCustomerId}
          onCollect={collectFromCustomer}
        />
        <RepayDebtModal
          open={showRepay}
          onClose={() => {
            setShowRepay(false);
            setPreselectedSupplierId(null);
          }}
          suppliers={outstandingSuppliers}
          preselectedSupplierId={preselectedSupplierId}
          onRepay={repayToSupplier}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("debts.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("debts.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
        <button
          onClick={() =>
            tab === "customers" ? openCollect() : openRepay()
          }
          disabled={
            tab === "customers"
              ? outstandingCustomers.length === 0
              : outstandingSuppliers.length === 0
          }
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm hover:bg-accent/90 disabled:opacity-50 transition-colors cursor-pointer"
        >
          <Banknote size={16} />
          {tab === "customers"
            ? t("debts.collectPayment")
            : t("debts.repayPayment")}
        </button>
        <button
          onClick={() => openAdjust()}
          className="flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm hover:bg-secondary transition-colors cursor-pointer"
        >
          <History size={16} />
          {t("debts.addAdjustment")}
        </button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setTab("customers")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            tab === "customers"
              ? "border-accent text-accent"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users size={16} />
          {t("debts.customerDebts")}
        </button>
        <button
          onClick={() => setTab("suppliers")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            tab === "suppliers"
              ? "border-accent text-accent"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Truck size={16} />
          {t("debts.supplierDebts")}
        </button>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="px-4 py-3 rounded-lg bg-card border border-border">
          <p className="text-xs text-muted-foreground">
            {tab === "customers"
              ? t("debts.totalCustomerDebt")
              : t("debts.totalSupplierDebt")}
          </p>
          <p className="text-lg font-semibold text-destructive mt-0.5">
            {formatJOD(
              tab === "customers" ? totalCustomerDebt : totalSupplierDebt,
            )}
          </p>
        </div>
        {tab === "customers" && prepaymentCustomers.length > 0 && (
          <div className="px-4 py-3 rounded-lg bg-card border border-border">
            <p className="text-xs text-muted-foreground">
              {t("debts.totalPrepaymentCredit")}
            </p>
            <p className="text-lg font-semibold text-success mt-0.5">
              {formatJOD(totalPrepaymentCredit)}
            </p>
          </div>
        )}
        <div className="px-4 py-3 rounded-lg bg-card border border-border">
          <p className="text-xs text-muted-foreground">
            {t("debts.accountsWithDebt")}
          </p>
          <p className="text-lg font-semibold text-foreground mt-0.5">
            {activeList.length}
          </p>
        </div>
      </div>

      <div className="relative">
        <Search
          size={16}
          className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("debts.searchPlaceholder")}
          className="w-full ps-9 pe-4 py-2 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 flex-1 min-h-0">
        <div className="xl:col-span-2 flex flex-col gap-3 min-h-0">
          <h2 className="text-sm font-semibold text-foreground">
            {t("debts.outstandingAccounts")}
          </h2>
          <div className="flex-1 overflow-auto rounded-lg border border-border">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                {t("common.loading")}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                {t("debts.noOutstanding")}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {tab === "customers"
                        ? t("debts.customer")
                        : t("debts.supplier")}
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {t("customers.phone")}
                    </th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                      {t("debts.outstandingBalance")}
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        {row.name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row.phone ?? "—"}
                      </td>
                      <td
                        className={`px-4 py-3 font-medium ${
                          row.credit < 0 ? "text-success" : "text-destructive"
                        }`}
                      >
                        {row.credit < 0
                          ? formatJOD(Math.abs(row.credit))
                          : formatJOD(row.credit)}
                        {row.credit < 0 && (
                          <span className="ms-1 text-xs text-muted-foreground">
                            {t("debts.prepaymentShort")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() =>
                              tab === "customers"
                                ? void openCustomerLedger(row)
                                : void openSupplierLedger(row)
                            }
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                            title={t("debts.viewLedger")}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() =>
                              tab === "customers"
                                ? openCollect(row.id)
                                : openRepay(row.id)
                            }
                            className="p-1.5 rounded-md text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer"
                            title={
                              tab === "customers"
                                ? t("debts.collectPayment")
                                : t("debts.repayPayment")
                            }
                          >
                            <Banknote size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 min-h-0">
          <h2 className="text-sm font-semibold text-foreground">
            {tab === "customers"
              ? t("debts.recentCollections")
              : t("debts.recentRepayments")}
          </h2>
          <div className="flex-1 overflow-auto rounded-lg border border-border">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                {t("common.loading")}
              </div>
            ) : recentTransactions.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm px-4 text-center">
                {t("debts.noRecentPayments")}
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="px-4 py-3 hover:bg-secondary/20 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-foreground text-sm truncate">
                        {"customer_name" in tx
                          ? tx.customer_name
                          : tx.supplier_name}
                      </p>
                      <p className="text-success font-medium text-sm shrink-0">
                        -{formatJOD(tx.amount)}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(tx.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {tab === "customers" && prepaymentCustomers.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">
            {t("debts.prepaymentAccounts")}
          </h2>
          <div className="rounded-lg border border-border overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t("debts.customer")}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t("customers.phone")}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                    {t("debts.prepaymentBalance")}
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {prepaymentCustomers.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {row.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.phone ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-success">
                      {formatJOD(Math.abs(row.credit))}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => void openCustomerLedger(row)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer float-end"
                        title={t("debts.viewLedger")}
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CollectDebtModal
        open={showCollect}
        onClose={() => {
          setShowCollect(false);
          setPreselectedCustomerId(null);
        }}
        customers={outstandingCustomers}
        preselectedCustomerId={preselectedCustomerId}
        onCollect={collectFromCustomer}
      />
      <RepayDebtModal
        open={showRepay}
        onClose={() => {
          setShowRepay(false);
          setPreselectedSupplierId(null);
        }}
        suppliers={outstandingSuppliers}
        preselectedSupplierId={preselectedSupplierId}
        onRepay={repayToSupplier}
      />
      <AdjustDebtModal
        open={showAdjust}
        onClose={() => {
          setShowAdjust(false);
          setEditingAdjustment(null);
        }}
        accountType={tab === "customers" ? "customer" : "supplier"}
        accounts={accountOptions}
        adjustment={editingAdjustment}
        onSave={handleSaveAdjustment}
      />
    </div>
  );
}
