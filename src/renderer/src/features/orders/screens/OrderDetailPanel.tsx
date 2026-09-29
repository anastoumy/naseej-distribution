import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Pencil,
  Printer,
  Trash2,
  XCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/custom/toast/useToast";
import { orderController } from "@/lib/controllers";
import type { Order, OrderFulfillmentStatus, OrderStatus } from "@/types/Global";
import { formatDate, formatJOD } from "@/lib/utils";
import { OrderStatusBadge } from "../components/OrderStatusBadge";
import { OrderFulfillmentBadge } from "../components/OrderFulfillmentBadge";
import {
  calculateLineTotal,
  calculateOrderTotal,
  toOrderItemInput,
} from "../utils/orderCalculations";

interface Props {
  orderId: number;
  onBack: () => void;
  onEdit: (order: Order) => void;
  getById: (id: number) => Promise<{ success: boolean; data?: Order; error?: string }>;
  onUpdate: (data: {
    id: number;
    items?: ReturnType<typeof toOrderItemInput>[];
    total_price?: number;
  }) => Promise<{ success: boolean; error?: string }>;
  onUpdateStatus: (data: {
    id: number;
    status: OrderStatus;
  }) => Promise<{ success: boolean; error?: string }>;
  onMarkDelivered: (id: number) => Promise<{ success: boolean; error?: string }>;
  onDelete: (id: number) => Promise<{ success: boolean; error?: string }>;
}

export function OrderDetailPanel({
  orderId,
  onBack,
  onEdit,
  getById,
  onUpdate,
  onUpdateStatus,
  onMarkDelivered,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [deductedDraft, setDeductedDraft] = useState<Record<number, number>>(
    {},
  );
  const [savingDeductions, setSavingDeductions] = useState(false);
  const [statusLoading, setStatusLoading] = useState<OrderStatus | null>(null);
  const [markingDelivered, setMarkingDelivered] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pdfLoading, setPdfLoading] = useState<"save" | "open" | "print" | null>(
    null,
  );

  const loadOrder = async () => {
    setLoading(true);
    const res = await getById(orderId);
    if (res.success && res.data) {
      setOrder(res.data);
      const draft: Record<number, number> = {};
      for (const item of res.data.items ?? []) {
        draft[item.id] = item.deducted_qty;
      }
      setDeductedDraft(draft);
    } else {
      toast({ variant: "error", title: res.error ?? t("common.error") });
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadOrder();
  }, [orderId]);

  const computedTotal = useMemo(() => {
    if (!order?.items) return 0;
    return calculateOrderTotal(
      order.items.map((item) => ({
        ...item,
        deducted_qty: deductedDraft[item.id] ?? item.deducted_qty,
      })),
    );
  }, [order, deductedDraft]);

  const deductionsDirty = useMemo(() => {
    if (!order?.items) return false;
    return order.items.some(
      (item) => (deductedDraft[item.id] ?? 0) !== item.deducted_qty,
    );
  }, [order, deductedDraft]);

  const handleSaveDeductions = async () => {
    if (!order?.items) return;

    setSavingDeductions(true);
    const items = order.items.map((item) => ({
      product_id: item.product_id,
      flavor_id: item.flavor_id,
      quantity: item.quantity,
      price: item.unit_price,
      tax_amount: item.tax_amount,
      deducted_qty: Math.min(
        item.quantity,
        Math.max(0, deductedDraft[item.id] ?? 0),
      ),
    }));

    const res = await onUpdate({
      id: order.id,
      items,
      total_price: calculateOrderTotal(
        order.items.map((item) => ({
          ...item,
          deducted_qty: Math.min(
            item.quantity,
            Math.max(0, deductedDraft[item.id] ?? 0),
          ),
        })),
      ),
    });
    setSavingDeductions(false);

    if (res.success) {
      toast({ variant: "success", title: t("orders.deductionsSaved") });
      await loadOrder();
    } else {
      toast({ variant: "error", title: res.error ?? t("common.error") });
    }
  };

  const handleStatusChange = async (status: OrderStatus) => {
    if (!order) return;

    const confirmMessages: Partial<Record<OrderStatus, string>> = {
      confirmed: t("orders.confirmOrderPrompt"),
      cancelled: t("orders.cancelOrderPrompt"),
      paid: t("orders.markPaidPrompt"),
      partially_paid: t("orders.markPartialPrompt"),
    };

    if (confirmMessages[status] && !confirm(confirmMessages[status])) return;

    setStatusLoading(status);
    const res = await onUpdateStatus({ id: order.id, status });
    setStatusLoading(null);

    if (res.success) {
      toast({ variant: "success", title: t("orders.statusUpdated") });
      await loadOrder();
    } else {
      toast({ variant: "error", title: res.error ?? t("common.error") });
    }
  };

  const handleMarkDelivered = async () => {
    if (!order) return;
    if (!confirm(t("orders.markDeliveredPrompt"))) return;

    setMarkingDelivered(true);
    const res = await onMarkDelivered(order.id);
    setMarkingDelivered(false);

    if (!res.success) {
      toast({ variant: "error", title: res.error ?? t("common.error") });
      return;
    }

    toast({ variant: "success", title: t("orders.fulfillmentUpdated") });
    await loadOrder();
  };

  const handleDelete = async () => {
    if (!order) return;
    if (!confirm(t("orders.deleteConfirm", { id: order.id }))) return;

    setDeleting(true);
    const res = await onDelete(order.id);
    setDeleting(false);

    if (res.success) {
      toast({ variant: "success", title: t("orders.deleteSuccess") });
      onBack();
    } else {
      toast({ variant: "error", title: res.error ?? t("common.error") });
    }
  };

  const runPdfAction = async (
    action: "save" | "open" | "print",
    handler: () => Promise<{ success: boolean; error?: string }>,
  ) => {
    if (!order) return;
    setPdfLoading(action);
    const res = await handler();
    setPdfLoading(null);
    if (res.success) {
      toast({
        variant: "success",
        title:
          action === "save"
            ? t("pdf.saved")
            : action === "print"
              ? t("pdf.printStarted")
              : t("pdf.opened"),
      });
      if (action === "save") {
        await loadOrder();
      }
    } else {
      toast({ variant: "error", title: res.error ?? t("common.error") });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">{t("orders.notFound")}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-md text-sm bg-secondary hover:bg-secondary/80 transition-colors cursor-pointer"
        >
          {t("orders.backToList")}
        </button>
      </div>
    );
  }

  const canEdit = order.status === "draft";
  const canDelete = order.status === "draft";
  const canDeduct =
    order.status !== "draft" &&
    order.status !== "cancelled" &&
    (order.items?.length ?? 0) > 0;
  const fulfillmentStatus: OrderFulfillmentStatus =
    order.fulfillment_status ?? "pending";
  const canMarkDelivered =
    order.status !== "draft" &&
    order.status !== "cancelled" &&
    fulfillmentStatus !== "delivered";

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer mt-0.5"
            aria-label={t("orders.backToList")}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">
                {t("orders.detailTitle", { id: order.id })}
              </h1>
              <OrderStatusBadge status={order.status} />
              <OrderFulfillmentBadge status={fulfillmentStatus} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {order.customer_name ?? `#${order.customer_id}`} ·{" "}
              {t(`orders.payment.${order.payment_type}`)} ·{" "}
              {formatDate(order.created_at)}
            </p>
            {order.notes && (
              <p className="text-sm text-muted-foreground mt-2">
                {t("common.notes")}: {order.notes}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {order.status !== "draft" && (
            <>
              <button
                onClick={() =>
                  void runPdfAction("save", () =>
                    orderController.exportPdf(order.id, true),
                  )
                }
                disabled={pdfLoading !== null}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm border border-border hover:bg-secondary disabled:opacity-50 transition-colors cursor-pointer"
              >
                <FileText size={14} />
                {pdfLoading === "save" ? t("common.loading") : t("pdf.save")}
              </button>
              <button
                onClick={() =>
                  void runPdfAction("open", () => orderController.openPdf(order.id))
                }
                disabled={pdfLoading !== null}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm border border-border hover:bg-secondary disabled:opacity-50 transition-colors cursor-pointer"
              >
                <FileText size={14} />
                {pdfLoading === "open" ? t("common.loading") : t("pdf.open")}
              </button>
              <button
                onClick={() =>
                  void runPdfAction("print", () => orderController.printPdf(order.id))
                }
                disabled={pdfLoading !== null}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm border border-border hover:bg-secondary disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Printer size={14} />
                {pdfLoading === "print" ? t("common.loading") : t("pdf.print")}
              </button>
            </>
          )}
          {canEdit && (
            <button
              onClick={() => onEdit(order)}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm border border-border hover:bg-secondary transition-colors cursor-pointer"
            >
              <Pencil size={14} />
              {t("common.edit")}
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-destructive border border-destructive/30 hover:bg-destructive/10 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Trash2 size={14} />
              {t("common.delete")}
            </button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                {t("orders.product")}
              </th>
              <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                {t("orders.flavor")}
              </th>
              <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                {t("orders.quantity")}
              </th>
              <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                {t("orders.unitPrice")}
              </th>
              <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                {t("orders.tax")}
              </th>
              <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                {t("orders.deductedQty")}
              </th>
              <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                {t("orders.effectiveQty")}
              </th>
              <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                {t("orders.lineTotal")}
              </th>
            </tr>
          </thead>
          <tbody>
            {(order.items ?? []).map((item) => {
              const deducted = deductedDraft[item.id] ?? item.deducted_qty;
              const effectiveQty = Math.max(0, item.quantity - deducted);
              const lineTotal = calculateLineTotal({
                ...item,
                deducted_qty: deducted,
              });

              return (
                <tr
                  key={item.id}
                  className="border-b border-border/50 hover:bg-secondary/20"
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    {item.product_title}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {item.flavor_name ?? t("inventory.noFlavor")}
                  </td>
                  <td className="px-4 py-3">{item.quantity}</td>
                  <td className="px-4 py-3">{item.unit_price.toFixed(2)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {item.tax_amount.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    {canDeduct ? (
                      <input
                        type="number"
                        min={0}
                        max={item.quantity}
                        step={1}
                        value={deducted}
                        onChange={(e) =>
                          setDeductedDraft((prev) => ({
                            ...prev,
                            [item.id]: Math.min(
                              item.quantity,
                              Math.max(0, Number(e.target.value) || 0),
                            ),
                          }))
                        }
                        className="w-20 px-2 py-1 rounded-md bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                      />
                    ) : (
                      item.deducted_qty
                    )}
                  </td>
                  <td className="px-4 py-3">{effectiveQty}</td>
                  <td className="px-4 py-3 font-medium">
                    {lineTotal.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {order.status === "draft" && (
            <>
              <button
                onClick={() => void handleStatusChange("confirmed")}
                disabled={!!statusLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm hover:bg-accent/90 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <CheckCircle2 size={16} />
                {statusLoading === "confirmed"
                  ? t("common.loading")
                  : t("orders.confirmOrder")}
              </button>
              <button
                onClick={() => void handleStatusChange("cancelled")}
                disabled={!!statusLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <XCircle size={16} />
                {t("orders.cancelOrder")}
              </button>
            </>
          )}

          {order.status === "confirmed" && order.payment_type === "cash" && (
            <>
              <button
                onClick={() => void handleStatusChange("paid")}
                disabled={!!statusLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm hover:bg-accent/90 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {t("orders.markPaid")}
              </button>
              <button
                onClick={() => void handleStatusChange("partially_paid")}
                disabled={!!statusLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm border border-border hover:bg-secondary disabled:opacity-50 transition-colors cursor-pointer"
              >
                {t("orders.markPartial")}
              </button>
            </>
          )}

          {order.status === "confirmed" && (
            <button
              onClick={() => void handleStatusChange("cancelled")}
              disabled={!!statusLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {t("orders.cancelOrder")}
            </button>
          )}

          {order.status === "partially_paid" && (
            <button
              onClick={() => void handleStatusChange("paid")}
              disabled={!!statusLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm hover:bg-accent/90 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {t("orders.markPaid")}
            </button>
          )}

          {canMarkDelivered && (
            <button
              onClick={() => void handleMarkDelivered()}
              disabled={markingDelivered}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-success text-success-foreground text-sm hover:bg-success/90 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <CheckCircle2 size={16} />
              {markingDelivered ? t("common.loading") : t("orders.markDelivered")}
            </button>
          )}

          {canDeduct && deductionsDirty && (
            <button
              onClick={() => void handleSaveDeductions()}
              disabled={savingDeductions}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm border border-accent/30 text-accent hover:bg-accent/10 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {savingDeductions
                ? t("common.loading")
                : t("orders.saveDeductions")}
            </button>
          )}
        </div>

        <div className="px-4 py-3 rounded-lg bg-card border border-border min-w-[180px]">
          <p className="text-xs text-muted-foreground">{t("common.total")}</p>
          <p className="text-xl font-semibold text-foreground mt-0.5">
            {formatJOD(deductionsDirty ? computedTotal : order.total)}
          </p>
        </div>
      </div>
    </div>
  );
}
