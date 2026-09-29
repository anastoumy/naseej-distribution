import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, ExternalLink } from "lucide-react";
import { useDebts } from "@/features/debts/hooks/useDebts";
import { useCustomers } from "@/features/customers/hooks/useCustomers";
import { useSuppliers } from "@/features/suppliers/hooks/useSuppliers";
import { reportsController } from "../controllers/reportsController";
import { DateRangeFilter } from "../components/DateRangeFilter";
import { downloadCsv } from "@/lib/csvExport";
import { formatDate, formatJOD } from "@/lib/utils";
import type {
  OrderByCustomerRow,
  OrderBySupplierRow,
  PaymentHistoryRow,
  PurchaseHistoryRow,
  ReportType,
} from "@/types/Global";

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}

const REPORT_TYPES: ReportType[] = [
  "outstandingCustomers",
  "outstandingSuppliers",
  "ordersByCustomer",
  "ordersBySupplier",
  "purchaseHistory",
  "paymentHistory",
];

export function ReportsScreen() {
  const { t } = useTranslation();
  const {
    outstandingCustomers,
    outstandingSuppliers,
    loading: debtsLoading,
    reload: reloadDebts,
  } = useDebts();
  const { customers } = useCustomers();
  const { suppliers } = useSuppliers();

  const [activeReport, setActiveReport] =
    useState<ReportType>("outstandingCustomers");
  const [from, setFrom] = useState(() => defaultDateRange().from);
  const [to, setTo] = useState(() => defaultDateRange().to);
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<
    "all" | "customer" | "supplier"
  >("all");
  const [loading, setLoading] = useState(false);

  const [ordersByCustomer, setOrdersByCustomer] = useState<OrderByCustomerRow[]>(
    [],
  );
  const [ordersBySupplier, setOrdersBySupplier] = useState<OrderBySupplierRow[]>(
    [],
  );
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistoryRow[]>(
    [],
  );
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryRow[]>([]);

  const needsDateFilter = ![
    "outstandingCustomers",
    "outstandingSuppliers",
  ].includes(activeReport);

  const loadReport = useCallback(async () => {
    setLoading(true);

    const dateFilter = { from: from || null, to: to || null };

    switch (activeReport) {
      case "outstandingCustomers":
      case "outstandingSuppliers":
        await reloadDebts();
        break;
      case "ordersByCustomer": {
        const res = await reportsController.getOrdersByCustomer({
          ...dateFilter,
          customer_id:
            customerFilter === "all" ? null : Number(customerFilter),
        });
        if (res.success) setOrdersByCustomer(res.data ?? []);
        break;
      }
      case "ordersBySupplier": {
        const res = await reportsController.getOrdersBySupplier({
          ...dateFilter,
          supplier_id:
            supplierFilter === "all" ? null : Number(supplierFilter),
        });
        if (res.success) setOrdersBySupplier(res.data ?? []);
        break;
      }
      case "purchaseHistory": {
        const res = await reportsController.getPurchaseHistory({
          ...dateFilter,
          supplier_id:
            supplierFilter === "all" ? null : Number(supplierFilter),
        });
        if (res.success) setPurchaseHistory(res.data ?? []);
        break;
      }
      case "paymentHistory": {
        const res = await reportsController.getPaymentHistory({
          ...dateFilter,
          type: paymentTypeFilter,
        });
        if (res.success) setPaymentHistory(res.data ?? []);
        break;
      }
    }

    setLoading(false);
  }, [
    activeReport,
    from,
    to,
    customerFilter,
    supplierFilter,
    paymentTypeFilter,
    reloadDebts,
  ]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const resetDates = () => {
    const range = defaultDateRange();
    setFrom(range.from);
    setTo(range.to);
  };

  const exportFilename = useMemo(
    () => `${activeReport}-${from || "all"}-${to || "all"}`,
    [activeReport, from, to],
  );

  const handleExport = () => {
    switch (activeReport) {
      case "outstandingCustomers":
        downloadCsv(
          exportFilename,
          [
            { key: "name", label: t("customers.name") },
            { key: "phone", label: t("customers.phone") },
            { key: "credit", label: t("customers.credit") },
          ],
          outstandingCustomers.map((r) => ({
            name: r.name,
            phone: r.phone ?? "",
            credit: r.credit.toFixed(2),
          })),
        );
        break;
      case "outstandingSuppliers":
        downloadCsv(
          exportFilename,
          [
            { key: "name", label: t("suppliers.name") },
            { key: "phone", label: t("suppliers.phone") },
            { key: "credit", label: t("suppliers.credit") },
          ],
          outstandingSuppliers.map((r) => ({
            name: r.name,
            phone: r.phone ?? "",
            credit: r.credit.toFixed(2),
          })),
        );
        break;
      case "ordersByCustomer":
        downloadCsv(
          exportFilename,
          [
            { key: "id", label: t("orders.orderId") },
            { key: "customer_name", label: t("orders.customer") },
            { key: "status", label: t("orders.statusLabel") },
            { key: "payment_type", label: t("orders.paymentType") },
            { key: "total", label: t("common.total") },
            { key: "amount_paid", label: t("orders.amountPaid") },
            { key: "created_at", label: t("common.date") },
          ],
          ordersByCustomer.map((r) => ({
            ...r,
            total: r.total.toFixed(2),
            amount_paid: r.amount_paid.toFixed(2),
            created_at: formatDate(r.created_at),
          })),
        );
        break;
      case "ordersBySupplier":
        downloadCsv(
          exportFilename,
          [
            { key: "order_id", label: t("orders.orderId") },
            { key: "supplier_name", label: t("suppliers.name") },
            { key: "customer_name", label: t("orders.customer") },
            { key: "item_count", label: t("reports.itemCount") },
            { key: "line_total", label: t("reports.supplierTotal") },
            { key: "created_at", label: t("common.date") },
          ],
          ordersBySupplier.map((r) => ({
            ...r,
            line_total: r.line_total.toFixed(2),
            created_at: formatDate(r.created_at),
          })),
        );
        break;
      case "purchaseHistory":
        downloadCsv(
          exportFilename,
          [
            { key: "id", label: t("purchases.purchaseId") },
            { key: "supplier_name", label: t("suppliers.name") },
            { key: "status", label: t("purchases.statusLabel") },
            { key: "total", label: t("common.total") },
            { key: "submitted_at", label: t("purchases.submittedDate") },
            { key: "created_at", label: t("common.date") },
          ],
          purchaseHistory.map((r) => ({
            ...r,
            total: r.total.toFixed(2),
            submitted_at: r.submitted_at ? formatDate(r.submitted_at) : "",
            created_at: formatDate(r.created_at),
          })),
        );
        break;
      case "paymentHistory":
        downloadCsv(
          exportFilename,
          [
            { key: "payment_type", label: t("reports.paymentType") },
            { key: "party_name", label: t("reports.party") },
            { key: "amount", label: t("common.total") },
            { key: "notes", label: t("common.notes") },
            { key: "created_at", label: t("common.date") },
          ],
          paymentHistory.map((r) => ({
            ...r,
            payment_type:
              r.payment_type === "customer"
                ? t("reports.customerPayment")
                : t("reports.supplierPayment"),
            amount: r.amount.toFixed(2),
            notes: r.notes ?? "",
            created_at: formatDate(r.created_at),
          })),
        );
        break;
    }
  };

  const isLoading = loading || debtsLoading;

  const renderTable = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
          {t("common.loading")}
        </div>
      );
    }

    switch (activeReport) {
      case "outstandingCustomers":
        return (
          <ReportTable
            headers={[
              t("customers.name"),
              t("customers.phone"),
              t("customers.credit"),
            ]}
            empty={outstandingCustomers.length === 0}
            rows={outstandingCustomers.map((r) => [
              r.name,
              r.phone ?? "—",
              formatJOD(r.credit),
            ])}
          />
        );
      case "outstandingSuppliers":
        return (
          <ReportTable
            headers={[
              t("suppliers.name"),
              t("suppliers.phone"),
              t("suppliers.credit"),
            ]}
            empty={outstandingSuppliers.length === 0}
            rows={outstandingSuppliers.map((r) => [
              r.name,
              r.phone ?? "—",
              formatJOD(r.credit),
            ])}
          />
        );
      case "ordersByCustomer":
        return (
          <ReportTable
            headers={[
              t("orders.orderId"),
              t("orders.customer"),
              t("orders.statusLabel"),
              t("orders.paymentType"),
              t("common.total"),
              t("orders.amountPaid"),
              t("common.date"),
            ]}
            empty={ordersByCustomer.length === 0}
            rows={ordersByCustomer.map((r) => [
              `#${r.id}`,
              r.customer_name,
              t(`orders.status.${r.status}`),
              t(`orders.payment.${r.payment_type}`),
              formatJOD(r.total),
              formatJOD(r.amount_paid),
              formatDate(r.created_at),
            ])}
          />
        );
      case "ordersBySupplier":
        return (
          <ReportTable
            headers={[
              t("orders.orderId"),
              t("suppliers.name"),
              t("orders.customer"),
              t("reports.itemCount"),
              t("reports.supplierTotal"),
              t("common.date"),
            ]}
            empty={ordersBySupplier.length === 0}
            rows={ordersBySupplier.map((r) => [
              `#${r.order_id}`,
              r.supplier_name,
              r.customer_name,
              String(r.item_count),
              formatJOD(r.line_total),
              formatDate(r.created_at),
            ])}
          />
        );
      case "purchaseHistory":
        return (
          <ReportTable
            headers={[
              t("purchases.purchaseId"),
              t("suppliers.name"),
              t("purchases.statusLabel"),
              t("common.total"),
              t("purchases.submittedDate"),
              t("common.date"),
            ]}
            empty={purchaseHistory.length === 0}
            rows={purchaseHistory.map((r) => [
              `#${r.id}`,
              r.supplier_name,
              t(`purchases.status.${r.status}`),
              formatJOD(r.total),
              r.submitted_at ? formatDate(r.submitted_at) : "—",
              formatDate(r.created_at),
            ])}
          />
        );
      case "paymentHistory":
        return (
          <ReportTable
            headers={[
              t("reports.paymentType"),
              t("reports.party"),
              t("common.total"),
              t("common.notes"),
              t("common.date"),
            ]}
            empty={paymentHistory.length === 0}
            rows={paymentHistory.map((r) => [
              r.payment_type === "customer"
                ? t("reports.customerPayment")
                : t("reports.supplierPayment"),
              r.party_name,
              formatJOD(r.amount),
              r.notes ?? "—",
              formatDate(r.created_at),
            ])}
          />
        );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("reports.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("reports.subtitle")}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-56 shrink-0 flex flex-row lg:flex-col gap-1 overflow-x-auto">
          {REPORT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setActiveReport(type)}
              className={`text-start px-3 py-2.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                activeReport === type
                  ? "bg-accent/15 text-accent font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {t(`reports.types.${type}`)}
            </button>
          ))}
        </aside>

        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {(activeReport === "outstandingCustomers" ||
            activeReport === "outstandingSuppliers") && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ExternalLink size={14} />
              {t("reports.debtsHint")}
            </p>
          )}

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-end gap-4">
              {needsDateFilter && (
                <DateRangeFilter
                  from={from}
                  to={to}
                  onFromChange={setFrom}
                  onToChange={setTo}
                  onReset={resetDates}
                />
              )}

              {activeReport === "ordersByCustomer" && (
                <EntityFilter
                  label={t("orders.customer")}
                  value={customerFilter}
                  onChange={setCustomerFilter}
                  options={customers.map((c) => ({
                    value: String(c.id),
                    label: c.name,
                  }))}
                />
              )}

              {(activeReport === "ordersBySupplier" ||
                activeReport === "purchaseHistory") && (
                <EntityFilter
                  label={t("suppliers.name")}
                  value={supplierFilter}
                  onChange={setSupplierFilter}
                  options={suppliers.map((s) => ({
                    value: String(s.id),
                    label: s.name,
                  }))}
                />
              )}

              {activeReport === "paymentHistory" && (
                <EntityFilter
                  label={t("reports.paymentType")}
                  value={paymentTypeFilter}
                  onChange={(v) =>
                    setPaymentTypeFilter(v as "all" | "customer" | "supplier")
                  }
                  options={[
                    { value: "all", label: t("common.all") },
                    { value: "customer", label: t("reports.customerPayment") },
                    { value: "supplier", label: t("reports.supplierPayment") },
                  ]}
                />
              )}
            </div>

            <button
              type="button"
              onClick={handleExport}
              disabled={isLoading}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              <Download size={16} />
              {t("reports.exportCsv")}
            </button>
          </div>

          <div className="rounded-xl bg-card border border-border overflow-hidden">
            {renderTable()}
          </div>
        </div>
      </div>
    </div>
  );
}

function EntityFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const { t } = useTranslation();

  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 min-w-[160px] rounded-lg border border-border bg-background px-3 text-sm text-foreground"
      >
        <option value="all">{t("common.all")}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReportTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: string[][];
  empty: boolean;
}) {
  const { t } = useTranslation();

  if (empty) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        {t("common.noData")}
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {headers.map((h) => (
              <th
                key={h}
                className="text-start px-4 py-3 font-medium text-muted-foreground whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 text-foreground whitespace-nowrap">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
