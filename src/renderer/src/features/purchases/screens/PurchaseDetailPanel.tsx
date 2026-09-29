import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  PackageCheck,
  Printer,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/custom/toast/useToast";
import { purchasesController } from "../controllers/purchasesController";
import type { Purchase, PurchaseItem } from "@/types/Global";
import { formatDate, formatJOD } from "@/lib/utils";
import { PurchaseStatusBadge } from "../components/PurchaseStatusBadge";

interface Props {
  purchaseId: number;
  onBack: () => void;
  getById: (id: number) => Promise<{
    success: boolean;
    data?: Purchase;
    error?: string;
  }>;
  onSubmit: (id: number) => Promise<{ success: boolean; error?: string }>;
  onUpdateStatus: (
    id: number,
    status: Purchase["status"],
  ) => Promise<{ success: boolean; error?: string }>;
  onReceiveItem: (
    id: number,
    qty: number,
  ) => Promise<{ success: boolean; error?: string }>;
  onDelete: (id: number) => Promise<{ success: boolean; error?: string }>;
}

function calcReceivedValue(items: PurchaseItem[]): number {
  return Number(
    items
      .reduce((sum, item) => sum + item.received_qty * item.unit_cost, 0)
      .toFixed(2),
  );
}

export function PurchaseDetailPanel({
  purchaseId,
  onBack,
  getById,
  onSubmit,
  onUpdateStatus,
  onReceiveItem,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [receivedDraft, setReceivedDraft] = useState<Record<number, number>>({});
  const [savingReceive, setSavingReceive] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState<"save" | "open" | "print" | null>(
    null,
  );

  const loadPurchase = async () => {
    setLoading(true);
    const res = await getById(purchaseId);
    if (res.success && res.data) {
      setPurchase(res.data);
      const draft: Record<number, number> = {};
      for (const item of res.data.items ?? []) {
        draft[item.id] = item.received_qty;
      }
      setReceivedDraft(draft);
    } else {
      toast({ variant: "error", title: res.error ?? t("common.error") });
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadPurchase();
  }, [purchaseId]);

  const receiveDirty = useMemo(() => {
    if (!purchase?.items) return false;
    return purchase.items.some(
      (item) => (receivedDraft[item.id] ?? 0) !== item.received_qty,
    );
  }, [purchase, receivedDraft]);

  const shortfallItems = useMemo(() => {
    if (!purchase?.items) return [];
    return purchase.items.filter((item) => {
      const received = receivedDraft[item.id] ?? item.received_qty;
      return received < item.quantity;
    });
  }, [purchase, receivedDraft]);

  const handleSaveReceived = async () => {
    if (!purchase?.items) return;

    if (shortfallItems.length > 0) {
      const proceed = confirm(t("purchases.shortfallPrompt"));
      if (!proceed) return;
    }

    setSavingReceive(true);
    let hadError = false;

    for (const item of purchase.items) {
      const nextQty = Math.min(
        item.quantity,
        Math.max(0, receivedDraft[item.id] ?? item.received_qty),
      );

      if (nextQty === item.received_qty) continue;

      const res = await onReceiveItem(item.id, nextQty);
      if (!res.success) {
        hadError = true;
        toast({ variant: "error", title: res.error ?? t("common.error") });
        break;
      }
    }

    setSavingReceive(false);

    if (!hadError) {
      toast({ variant: "success", title: t("purchases.receiveSaved") });
      await loadPurchase();
    }
  };

  const handleSubmit = async () => {
    if (!purchase) return;
    if (!confirm(t("purchases.submitConfirm", { id: purchase.id }))) return;

    setActionLoading("submit");
    const res = await onSubmit(purchase.id);
    setActionLoading(null);

    if (res.success) {
      toast({ variant: "success", title: t("purchases.submitSuccess") });
      await loadPurchase();
    } else {
      toast({ variant: "error", title: res.error ?? t("common.error") });
    }
  };

  const handleCancel = async () => {
    if (!purchase) return;
    if (!confirm(t("purchases.cancelConfirm", { id: purchase.id }))) return;

    setActionLoading("cancel");
    const res = await onUpdateStatus(purchase.id, "cancelled");
    setActionLoading(null);

    if (res.success) {
      toast({ variant: "success", title: t("purchases.cancelSuccess") });
      await loadPurchase();
    } else {
      toast({ variant: "error", title: res.error ?? t("common.error") });
    }
  };

  const handleDelete = async () => {
    if (!purchase) return;
    if (!confirm(t("purchases.deleteConfirm", { id: purchase.id }))) return;

    setActionLoading("delete");
    const res = await onDelete(purchase.id);
    setActionLoading(null);

    if (res.success) {
      toast({ variant: "success", title: t("purchases.deleteSuccess") });
      onBack();
    } else {
      toast({ variant: "error", title: res.error ?? t("common.error") });
    }
  };

  const handleReceiveAll = () => {
    if (!purchase?.items) return;
    const next: Record<number, number> = {};
    for (const item of purchase.items) {
      next[item.id] = item.quantity;
    }
    setReceivedDraft(next);
  };

  const runPdfAction = async (
    action: "save" | "open" | "print",
    handler: () => Promise<{ success: boolean; error?: string }>,
  ) => {
    if (!purchase) return;
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
        await loadPurchase();
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

  if (!purchase) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">{t("purchases.notFound")}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-md text-sm bg-secondary hover:bg-secondary/80 transition-colors cursor-pointer"
        >
          {t("purchases.backToList")}
        </button>
      </div>
    );
  }

  const isSubmitted = Boolean(purchase.submitted_at);
  const canSubmit =
    !isSubmitted &&
    purchase.status !== "cancelled" &&
    purchase.status !== "received" &&
    (purchase.items?.length ?? 0) > 0;
  const canCancel =
    purchase.status !== "cancelled" && purchase.status !== "received";
  const canDelete =
    purchase.status === "pending" && !isSubmitted && (purchase.items?.length ?? 0) > 0;
  const canReceive =
    purchase.status !== "cancelled" && purchase.status !== "received";

  const receivedValue = calcReceivedValue(purchase.items ?? []);

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer mt-0.5"
            aria-label={t("purchases.backToList")}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">
                {t("purchases.detailTitle", { id: purchase.id })}
              </h1>
              <PurchaseStatusBadge
                status={purchase.status}
                submitted={isSubmitted}
              />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {purchase.supplier_name ?? `#${purchase.supplier_id}`} ·{" "}
              {formatDate(purchase.created_at)}
              {isSubmitted && purchase.submitted_at && (
                <> · {t("purchases.submittedAt", { date: formatDate(purchase.submitted_at) })}</>
              )}
            </p>
            {purchase.notes && (
              <p className="text-sm text-muted-foreground mt-2">
                {t("common.notes")}: {purchase.notes}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                {t("purchases.product")}
              </th>
              <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                {t("purchases.flavor")}
              </th>
              <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                {t("purchases.orderedQty")}
              </th>
              <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                {t("purchases.receivedQty")}
              </th>
              <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                {t("purchases.remainingQty")}
              </th>
              <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                {t("purchases.unitCost")}
              </th>
              <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                {t("purchases.lineTotal")}
              </th>
            </tr>
          </thead>
          <tbody>
            {(purchase.items ?? []).map((item) => {
              const received = receivedDraft[item.id] ?? item.received_qty;
              const remaining = Math.max(0, item.quantity - received);
              const lineTotal = Number((item.quantity * item.unit_cost).toFixed(2));

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
                  <td className="px-4 py-3">
                    {canReceive ? (
                      <input
                        type="number"
                        min={0}
                        max={item.quantity}
                        step={1}
                        value={received}
                        onChange={(e) =>
                          setReceivedDraft((prev) => ({
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
                      item.received_qty
                    )}
                  </td>
                  <td className="px-4 py-3">{remaining}</td>
                  <td className="px-4 py-3">{formatJOD(item.unit_cost)}</td>
                  <td className="px-4 py-3 font-medium">{formatJOD(lineTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              void runPdfAction("save", () =>
                purchasesController.exportPdf(purchase.id, true),
              )
            }
            disabled={pdfLoading !== null}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm border border-border hover:bg-secondary disabled:opacity-50 transition-colors cursor-pointer"
          >
            <FileText size={16} />
            {pdfLoading === "save" ? t("common.loading") : t("pdf.save")}
          </button>
          <button
            onClick={() =>
              void runPdfAction("open", () => purchasesController.openPdf(purchase.id))
            }
            disabled={pdfLoading !== null}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm border border-border hover:bg-secondary disabled:opacity-50 transition-colors cursor-pointer"
          >
            <FileText size={16} />
            {pdfLoading === "open" ? t("common.loading") : t("pdf.open")}
          </button>
          <button
            onClick={() =>
              void runPdfAction("print", () => purchasesController.printPdf(purchase.id))
            }
            disabled={pdfLoading !== null}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm border border-border hover:bg-secondary disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Printer size={16} />
            {pdfLoading === "print" ? t("common.loading") : t("pdf.print")}
          </button>

          {canSubmit && (
            <button
              onClick={() => void handleSubmit()}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm hover:bg-accent/90 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Send size={16} />
              {actionLoading === "submit"
                ? t("common.loading")
                : t("purchases.submitToSupplier")}
            </button>
          )}

          {canReceive && (
            <>
              <button
                onClick={handleReceiveAll}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm border border-border hover:bg-secondary transition-colors cursor-pointer"
              >
                <PackageCheck size={16} />
                {t("purchases.receiveAll")}
              </button>
              {receiveDirty && (
                <button
                  onClick={() => void handleSaveReceived()}
                  disabled={savingReceive}
                  className="flex items-center gap-2 px-4 py-2 rounded-md text-sm border border-accent/30 text-accent hover:bg-accent/10 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <CheckCircle2 size={16} />
                  {savingReceive
                    ? t("common.loading")
                    : t("purchases.saveReceived")}
                </button>
              )}
            </>
          )}

          {canCancel && (
            <button
              onClick={() => void handleCancel()}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <XCircle size={16} />
              {t("purchases.cancelPurchase")}
            </button>
          )}

          {canDelete && (
            <button
              onClick={() => void handleDelete()}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm text-destructive border border-destructive/30 hover:bg-destructive/10 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Trash2 size={16} />
              {t("common.delete")}
            </button>
          )}
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="px-4 py-3 rounded-lg bg-card border border-border min-w-[160px]">
            <p className="text-xs text-muted-foreground">{t("purchases.orderTotal")}</p>
            <p className="text-lg font-semibold text-foreground mt-0.5">
              {formatJOD(purchase.total)}
            </p>
          </div>
          <div className="px-4 py-3 rounded-lg bg-card border border-border min-w-[160px]">
            <p className="text-xs text-muted-foreground">{t("purchases.receivedValue")}</p>
            <p className="text-lg font-semibold text-accent mt-0.5">
              {formatJOD(receivedValue)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
