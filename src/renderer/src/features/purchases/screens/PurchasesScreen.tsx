import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, RefreshCw, Search } from "lucide-react";
import { usePurchases } from "../hooks/usePurchases";
import { useSuppliers } from "@/features/suppliers/hooks/useSuppliers";
import { PurchaseDetailPanel } from "./PurchaseDetailPanel";
import { PurchaseStatusBadge } from "../components/PurchaseStatusBadge";
import { useToast } from "@/components/ui/custom/toast/useToast";
import { formatDate, formatJOD } from "@/lib/utils";
import type { Purchase, PurchaseStatus } from "@/types/Global";

type ViewMode = "list" | "detail";
type SubmissionFilter = "all" | "open" | "submitted";

function isOpenPurchase(purchase: Purchase): boolean {
  return (
    !purchase.submitted_at &&
    purchase.status !== "cancelled" &&
    purchase.status !== "received"
  );
}

export function PurchasesScreen() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const {
    purchases,
    loading,
    reload,
    getById,
    generate,
    submit,
    updateStatus,
    receiveItem,
    remove,
  } = usePurchases();
  const { suppliers } = useSuppliers();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PurchaseStatus | "all">("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [submissionFilter, setSubmissionFilter] =
    useState<SubmissionFilter>("all");
  const [dateFilter, setDateFilter] = useState("");
  const [groupBySupplier, setGroupBySupplier] = useState(true);
  const [reconciling, setReconciling] = useState(false);

  const filtered = useMemo(() => {
    return purchases.filter((purchase) => {
      const matchesSearch =
        String(purchase.id).includes(search) ||
        (purchase.supplier_name ?? "")
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || purchase.status === statusFilter;

      const matchesSupplier =
        supplierFilter === "all" ||
        String(purchase.supplier_id) === supplierFilter;

      const matchesSubmission =
        submissionFilter === "all" ||
        (submissionFilter === "open" && isOpenPurchase(purchase)) ||
        (submissionFilter === "submitted" && Boolean(purchase.submitted_at));

      const matchesDate =
        !dateFilter ||
        purchase.created_at.slice(0, 10) === dateFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesSupplier &&
        matchesSubmission &&
        matchesDate
      );
    });
  }, [
    purchases,
    search,
    statusFilter,
    supplierFilter,
    submissionFilter,
    dateFilter,
  ]);

  const grouped = useMemo(() => {
    if (!groupBySupplier) {
      return [{ supplierId: 0, supplierName: "", items: filtered }];
    }

    const map = new Map<string, Purchase[]>();
    for (const purchase of filtered) {
      const key = String(purchase.supplier_id);
      const bucket = map.get(key) ?? [];
      bucket.push(purchase);
      map.set(key, bucket);
    }

    return [...map.entries()]
      .map(([supplierId, items]) => ({
        supplierId: Number(supplierId),
        supplierName: items[0]?.supplier_name ?? `#${supplierId}`,
        items: items.sort((a, b) => b.id - a.id),
      }))
      .sort((a, b) => a.supplierName.localeCompare(b.supplierName));
  }, [filtered, groupBySupplier]);

  const stats = useMemo(() => {
    const open = purchases.filter(isOpenPurchase).length;
    const submitted = purchases.filter((p) => Boolean(p.submitted_at)).length;
    const awaitingReceive = purchases.filter(
      (p) =>
        p.status === "pending" ||
        p.status === "partially_received",
    ).length;
    const totalValue = purchases
      .filter((p) => p.status !== "cancelled")
      .reduce((sum, p) => sum + p.total, 0);

    return { open, submitted, awaitingReceive, totalValue };
  }, [purchases]);

  const openDetail = (purchaseId: number) => {
    setSelectedPurchaseId(purchaseId);
    setViewMode("detail");
  };

  const handleBackToList = () => {
    setViewMode("list");
    setSelectedPurchaseId(null);
    void reload();
  };

  const handleReconcile = async () => {
    setReconciling(true);
    const res = await generate();
    setReconciling(false);

    if (!res.success) {
      toast({ variant: "error", title: res.error ?? t("common.error") });
      return;
    }

    const synced = res.data?.items_synced ?? 0;
    toast({
      variant: synced > 0 ? "success" : "neutral",
      title:
        synced > 0
          ? t("purchases.reconcileSuccess", { count: synced })
          : t("purchases.reconcileNothing"),
    });
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setSupplierFilter("all");
    setSubmissionFilter("all");
    setDateFilter("");
  };

  const renderPurchaseRow = (purchase: Purchase) => (
    <tr
      key={purchase.id}
      className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
    >
      <td className="px-4 py-3 font-medium text-foreground">{purchase.id}</td>
      {!groupBySupplier && (
        <td className="px-4 py-3 text-foreground">
          {purchase.supplier_name ?? `#${purchase.supplier_id}`}
        </td>
      )}
      <td className="px-4 py-3">
        <PurchaseStatusBadge
          status={purchase.status}
          submitted={Boolean(purchase.submitted_at)}
        />
      </td>
      <td className="px-4 py-3 font-medium text-foreground">
        {formatJOD(purchase.total)}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {purchase.item_count ?? 0}
      </td>
      <td className="px-4 py-3 text-muted-foreground text-xs">
        {formatDate(purchase.created_at)}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => openDetail(purchase.id)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
          title={t("common.details")}
        >
          <Eye size={14} />
        </button>
      </td>
    </tr>
  );

  if (viewMode === "detail" && selectedPurchaseId) {
    return (
      <PurchaseDetailPanel
        purchaseId={selectedPurchaseId}
        onBack={handleBackToList}
        getById={getById}
        onSubmit={submit}
        onUpdateStatus={updateStatus}
        onReceiveItem={receiveItem}
        onDelete={remove}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("purchases.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("purchases.subtitle")}
          </p>
        </div>
        <button
          onClick={() => void handleReconcile()}
          disabled={reconciling}
          className="flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm hover:bg-secondary disabled:opacity-50 transition-colors cursor-pointer"
        >
          <RefreshCw size={16} className={reconciling ? "animate-spin" : ""} />
          {reconciling ? t("common.loading") : t("purchases.reconcile")}
        </button>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="px-4 py-3 rounded-lg bg-card border border-border">
          <p className="text-xs text-muted-foreground">{t("purchases.openInvoices")}</p>
          <p className="text-lg font-semibold text-accent mt-0.5">{stats.open}</p>
        </div>
        <div className="px-4 py-3 rounded-lg bg-card border border-border">
          <p className="text-xs text-muted-foreground">{t("purchases.submittedCount")}</p>
          <p className="text-lg font-semibold text-foreground mt-0.5">
            {stats.submitted}
          </p>
        </div>
        <div className="px-4 py-3 rounded-lg bg-card border border-border">
          <p className="text-xs text-muted-foreground">{t("purchases.awaitingReceive")}</p>
          <p className="text-lg font-semibold text-warning mt-0.5">
            {stats.awaitingReceive}
          </p>
        </div>
        <div className="px-4 py-3 rounded-lg bg-card border border-border">
          <p className="text-xs text-muted-foreground">{t("purchases.totalValue")}</p>
          <p className="text-lg font-semibold text-foreground mt-0.5">
            {formatJOD(stats.totalValue)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        <div className="relative xl:col-span-2">
          <Search
            size={16}
            className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("purchases.searchPlaceholder")}
            className="w-full ps-9 pe-4 py-2 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>

        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className="px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          <option value="all">{t("purchases.allSuppliers")}</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as PurchaseStatus | "all")
          }
          className="px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          <option value="all">{t("purchases.allStatuses")}</option>
          <option value="pending">{t("purchases.status.pending")}</option>
          <option value="partially_received">
            {t("purchases.status.partially_received")}
          </option>
          <option value="received">{t("purchases.status.received")}</option>
          <option value="cancelled">{t("purchases.status.cancelled")}</option>
        </select>

        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={submissionFilter}
          onChange={(e) =>
            setSubmissionFilter(e.target.value as SubmissionFilter)
          }
          className="px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 min-w-[180px]"
        >
          <option value="all">{t("purchases.allSubmissions")}</option>
          <option value="open">{t("purchases.openOnly")}</option>
          <option value="submitted">{t("purchases.submittedOnly")}</option>
        </select>

        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={groupBySupplier}
            onChange={(e) => setGroupBySupplier(e.target.checked)}
            className="rounded border-border"
          />
          {t("purchases.groupBySupplier")}
        </label>

        <button
          onClick={resetFilters}
          className="px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
        >
          {t("common.reset")}
        </button>
      </div>

      <div className="flex-1 overflow-auto rounded-lg border border-border">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            {t("common.loading")}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            {t("common.noData")}
          </div>
        ) : groupBySupplier ? (
          <div className="divide-y divide-border">
            {grouped.map((group) => (
              <div key={group.supplierId}>
                <div className="px-4 py-3 bg-secondary/40 border-b border-border">
                  <h2 className="text-sm font-semibold text-foreground">
                    {group.supplierName}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("purchases.invoiceCount", { count: group.items.length })}
                  </p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/20">
                      <th className="text-start px-4 py-2 font-medium text-muted-foreground">
                        #
                      </th>
                      <th className="text-start px-4 py-2 font-medium text-muted-foreground">
                        {t("purchases.statusLabel")}
                      </th>
                      <th className="text-start px-4 py-2 font-medium text-muted-foreground">
                        {t("common.total")}
                      </th>
                      <th className="text-start px-4 py-2 font-medium text-muted-foreground">
                        {t("purchases.items")}
                      </th>
                      <th className="text-start px-4 py-2 font-medium text-muted-foreground">
                        {t("common.date")}
                      </th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>{group.items.map(renderPurchaseRow)}</tbody>
                </table>
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                  #
                </th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                  {t("purchases.supplier")}
                </th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                  {t("purchases.statusLabel")}
                </th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                  {t("common.total")}
                </th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                  {t("purchases.items")}
                </th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                  {t("common.date")}
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>{filtered.map(renderPurchaseRow)}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
