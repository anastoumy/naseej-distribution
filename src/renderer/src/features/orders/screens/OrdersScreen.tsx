import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useOrders } from "../hooks/useOrders";
import { useCustomers } from "@/features/customers/hooks/useCustomers";
import { useProducts } from "@/features/products/hooks/useProducts";
import { CreateOrderModal } from "../forms/CreateOrderModal";
import { EditOrderModal } from "../forms/EditOrderModal";
import { OrderDetailPanel } from "./OrderDetailPanel";
import { OrderStatusBadge } from "../components/OrderStatusBadge";
import { OrderFulfillmentBadge } from "../components/OrderFulfillmentBadge";
import { useToast } from "@/components/ui/custom/toast/useToast";
import { formatDate, formatJOD } from "@/lib/utils";
import type {
  Order,
  OrderFulfillmentStatus,
  OrderPaymentType,
  OrderStatus,
} from "@/types/Global";

type ViewMode = "list" | "detail";

export function OrdersScreen() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const {
    orders,
    loading,
    create,
    update,
    updateStatus,
    markDelivered,
    remove,
    getById,
    reload,
  } = useOrders();
  const { customers } = useCustomers();
  const { products } = useProducts();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [fulfillmentFilter, setFulfillmentFilter] = useState<
    OrderFulfillmentStatus | "all"
  >("all");
  const [paymentFilter, setPaymentFilter] = useState<OrderPaymentType | "all">(
    "all",
  );
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Order | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch =
        String(order.id).includes(search) ||
        (order.customer_name ?? "")
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || order.status === statusFilter;
      const matchesFulfillment =
        fulfillmentFilter === "all" ||
        (order.fulfillment_status ?? "pending") === fulfillmentFilter;
      const matchesPayment =
        paymentFilter === "all" || order.payment_type === paymentFilter;
      const matchesCustomer =
        customerFilter === "all" ||
        String(order.customer_id) === customerFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesFulfillment &&
        matchesPayment &&
        matchesCustomer
      );
    });
  }, [orders, search, statusFilter, fulfillmentFilter, paymentFilter, customerFilter]);

  const stats = useMemo(() => {
    const draft = orders.filter((o) => o.status === "draft").length;
    const confirmed = orders.filter((o) => o.status === "confirmed").length;
    const totalValue = orders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + o.total, 0);
    return { draft, confirmed, totalValue };
  }, [orders]);

  const openDetail = (orderId: number) => {
    setSelectedOrderId(orderId);
    setViewMode("detail");
  };

  const handleBackToList = () => {
    setViewMode("list");
    setSelectedOrderId(null);
    void reload();
  };

  const handleEditFromList = async (order: Order) => {
    if (order.status !== "draft") {
      toast({ variant: "error", title: t("orders.editDraftOnly") });
      return;
    }

    const res = await getById(order.id);
    if (res.success && res.data) {
      setEditTarget(res.data);
    } else {
      toast({ variant: "error", title: res.error ?? t("common.error") });
    }
  };

  const handleEditFromDetail = async (order: Order) => {
    setEditTarget(order);
  };

  const handleDelete = async (order: Order) => {
    if (order.status !== "draft") {
      toast({ variant: "error", title: t("orders.deleteDraftOnly") });
      return;
    }

    if (!confirm(t("orders.deleteConfirm", { id: order.id }))) return;

    setDeletingId(order.id);
    const res = await remove(order.id);
    setDeletingId(null);

    if (!res.success) {
      toast({ variant: "error", title: res.error ?? t("common.error") });
    } else {
      toast({ variant: "success", title: t("orders.deleteSuccess") });
    }
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setFulfillmentFilter("all");
    setPaymentFilter("all");
    setCustomerFilter("all");
  };

  if (viewMode === "detail" && selectedOrderId) {
    return (
      <>
        <OrderDetailPanel
          orderId={selectedOrderId}
          onBack={handleBackToList}
          onEdit={handleEditFromDetail}
          getById={getById}
          onUpdate={update}
          onUpdateStatus={updateStatus}
          onMarkDelivered={markDelivered}
          onDelete={remove}
        />
        <EditOrderModal
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          order={editTarget}
          onUpdate={async (data) => {
            const res = await update(data);
            if (res.success && editTarget) {
              const refreshed = await getById(editTarget.id);
              if (refreshed.success && refreshed.data) {
                setEditTarget(null);
              }
            }
            return res;
          }}
          customers={customers}
          products={products}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("orders.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("orders.subtitle")}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm hover:bg-accent/90 transition-colors cursor-pointer"
        >
          <Plus size={16} />
          {t("orders.create")}
        </button>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="px-4 py-3 rounded-lg bg-card border border-border">
          <p className="text-xs text-muted-foreground">{t("orders.drafts")}</p>
          <p className="text-lg font-semibold text-foreground mt-0.5">
            {stats.draft}
          </p>
        </div>
        <div className="px-4 py-3 rounded-lg bg-card border border-border">
          <p className="text-xs text-muted-foreground">
            {t("orders.confirmed")}
          </p>
          <p className="text-lg font-semibold text-accent mt-0.5">
            {stats.confirmed}
          </p>
        </div>
        <div className="px-4 py-3 rounded-lg bg-card border border-border">
          <p className="text-xs text-muted-foreground">
            {t("orders.totalValue")}
          </p>
          <p className="text-lg font-semibold text-foreground mt-0.5">
            {formatJOD(stats.totalValue)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative md:col-span-2">
          <Search
            size={16}
            className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("orders.searchPlaceholder")}
            className="w-full ps-9 pe-4 py-2 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as OrderStatus | "all")
          }
          className="px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          <option value="all">{t("orders.allStatuses")}</option>
          <option value="draft">{t("orders.status.draft")}</option>
          <option value="confirmed">{t("orders.status.confirmed")}</option>
          <option value="partially_paid">
            {t("orders.status.partially_paid")}
          </option>
          <option value="paid">{t("orders.status.paid")}</option>
          <option value="cancelled">{t("orders.status.cancelled")}</option>
        </select>

        <select
          value={paymentFilter}
          onChange={(e) =>
            setPaymentFilter(e.target.value as OrderPaymentType | "all")
          }
          className="px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          <option value="all">{t("orders.allPayments")}</option>
          <option value="cash">{t("orders.payment.cash")}</option>
          <option value="credit">{t("orders.payment.credit")}</option>
        </select>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={fulfillmentFilter}
          onChange={(e) =>
            setFulfillmentFilter(e.target.value as OrderFulfillmentStatus | "all")
          }
          className="px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 min-w-[200px]"
        >
          <option value="all">{t("orders.allFulfillmentStatuses")}</option>
          <option value="pending">{t("orders.fulfillment.pending")}</option>
          <option value="partially_received">
            {t("orders.fulfillment.partially_received")}
          </option>
          <option value="received">{t("orders.fulfillment.received")}</option>
          <option value="delivered">{t("orders.fulfillment.delivered")}</option>
          <option value="cancelled">{t("orders.fulfillment.cancelled")}</option>
        </select>
        <select
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          className="px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 min-w-[200px]"
        >
          <option value="all">{t("orders.allCustomers")}</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
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
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                  #
                </th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                  {t("orders.customer")}
                </th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                  {t("orders.statusLabel")}
                </th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                  {t("orders.fulfillmentLabel")}
                </th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                  {t("orders.paymentType")}
                </th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                  {t("common.total")}
                </th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                  {t("orders.items")}
                </th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                  {t("common.date")}
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    {order.id}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {order.customer_name ?? `#${order.customer_id}`}
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3">
                    <OrderFulfillmentBadge
                      status={order.fulfillment_status ?? "pending"}
                    />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">
                    {t(`orders.payment.${order.payment_type}`)}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {formatJOD(order.total)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {order.item_count ?? 0}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {formatDate(order.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => openDetail(order.id)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                        title={t("common.details")}
                      >
                        <Eye size={14} />
                      </button>
                      {order.status === "draft" && (
                        <>
                          <button
                            onClick={() => void handleEditFromList(order)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                            title={t("common.edit")}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => void handleDelete(order)}
                            disabled={deletingId === order.id}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50"
                            title={t("common.delete")}
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CreateOrderModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={create}
        customers={customers}
        products={products}
      />

      <EditOrderModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        order={editTarget}
        onUpdate={update}
        customers={customers}
        products={products}
      />
    </div>
  );
}
