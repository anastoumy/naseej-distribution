import { useRef, useState } from "react";
import { FileText, Printer, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { orderController } from "@/lib/controllers";
import { formatJOD, formatDateTime } from "@/lib/utils";
import type { ReceiptData } from "@/types/Global";
import { useSettings } from "@/features/settings/hooks/useSettings";
import { useToast } from "@/components/ui/custom/toast/useToast";

interface ReceiptModalProps {
  open: boolean;
  data: ReceiptData;
  onClose: () => void;
}

const STORE_ADDRESS_FALLBACK = "Muscat, Oman";
const STORE_PHONE_FALLBACK = "+968 0000 0000";

export default function ReceiptModal({ open, data, onClose }: ReceiptModalProps) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [pdfLoading, setPdfLoading] = useState<"save" | "print" | "open" | null>(
    null,
  );

  if (!open) return null;

  const storeName = settings?.company_name || t("appName");
  const storeAddress = settings?.company_address || STORE_ADDRESS_FALLBACK;
  const storePhone = settings?.company_phone || STORE_PHONE_FALLBACK;

  const handleHtmlPrint = () => {
    if (!printRef.current) return;
    const html = printRef.current.innerHTML;
    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt ${data.receiptNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: monospace; font-size: 12px; color: #000; background: #fff; padding: 16px; }
            .receipt { max-width: 300px; margin: auto; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; margin: 2px 0; }
            .total-row { font-weight: bold; font-size: 14px; border-top: 1px solid #000; padding-top: 4px; margin-top: 4px; }
          </style>
        </head>
        <body><div class="receipt">${html}</div></body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const runPdfAction = async (
    action: "save" | "print" | "open",
    handler: (orderId: number) => Promise<{ success: boolean; error?: string }>,
  ) => {
    if (!data.orderId) {
      toast({ variant: "error", title: t("pdf.orderRequired") });
      return;
    }

    setPdfLoading(action);
    try {
      const res = await handler(data.orderId);
      if (!res.success) {
        throw new Error(res.error ?? t("pdf.failed"));
      }
      toast({
        variant: "success",
        title:
          action === "save"
            ? t("pdf.saved")
            : action === "print"
              ? t("pdf.printStarted")
              : t("pdf.opened"),
      });
    } catch (err) {
      toast({
        variant: "error",
        title: err instanceof Error ? err.message : t("pdf.failed"),
      });
    } finally {
      setPdfLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            {t("pdf.receiptTitle")}
          </h2>
          <div className="flex items-center gap-2">
            {data.orderId && (
              <>
                <button
                  onClick={() =>
                    void runPdfAction("save", (id) =>
                      orderController.exportPdf(id, true),
                    )
                  }
                  disabled={pdfLoading !== null}
                  className="btn-ghost h-8 px-3 text-xs flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {pdfLoading === "save" ? t("common.loading") : t("pdf.save")}
                </button>
                <button
                  onClick={() =>
                    void runPdfAction("print", (id) => orderController.printPdf(id))
                  }
                  disabled={pdfLoading !== null}
                  className="btn-ghost h-8 px-3 text-xs flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {pdfLoading === "print"
                    ? t("common.loading")
                    : t("pdf.print")}
                </button>
              </>
            )}
            <button
              onClick={handleHtmlPrint}
              className="btn-ghost h-8 px-3 text-xs flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              {t("pdf.quickPrint")}
            </button>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              aria-label={t("common.close")}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto">
          <div ref={printRef} className="font-mono text-xs text-foreground space-y-3">
            <div className="center text-center space-y-0.5">
              <p className="bold text-sm font-semibold">{storeName}</p>
              <p className="text-muted-foreground">{storeAddress}</p>
              <p className="text-muted-foreground">{storePhone}</p>
            </div>

            <div className="border-t border-dashed border-border" />

            <div className="space-y-1">
              {data.orderId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("pdf.orderId")}</span>
                  <span>{data.orderId}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("pdf.receipt")}</span>
                <span>{data.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("common.date")}</span>
                <span>{formatDateTime(data.dateTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("pdf.staff")}</span>
                <span>{data.staffName}</span>
              </div>
              {data.customer && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("orders.customer")}</span>
                  <span>
                    {data.customer.firstName} {data.customer.lastName}
                  </span>
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-border" />

            <div className="space-y-1.5">
              {data.items.map((item) => (
                <div key={item.id}>
                  <p className="font-medium truncate">{item.variant.productName}</p>
                  <div className="flex justify-between text-muted-foreground">
                    <span>
                      {item.variant.size} / {item.variant.color} × {item.quantity}
                    </span>
                    <span className="tabular-nums">{formatJOD(item.lineTotal)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-border" />

            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("pos.subtotal")}</span>
                <span className="tabular-nums">{formatJOD(data.subtotal)}</span>
              </div>
              {data.discountAmount > 0 && (
                <div className="flex justify-between text-success">
                  <span>{t("pos.discount")}</span>
                  <span className="tabular-nums">
                    -{formatJOD(data.discountAmount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("pos.tax")}</span>
                <span className="tabular-nums">{formatJOD(data.taxAmount)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm border-t border-border pt-1 mt-1">
                <span>{t("pos.total")}</span>
                <span className="tabular-nums">{formatJOD(data.total)}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-border" />

            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("pdf.paidNow")}</span>
                <span className="tabular-nums">{formatJOD(data.amountPaid)}</span>
              </div>
              {data.debtAmount !== undefined && data.debtAmount > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>{t("pos.payment.addedToDebt")}</span>
                  <span className="tabular-nums">{formatJOD(data.debtAmount)}</span>
                </div>
              )}
              {data.prepaymentUsed !== undefined && data.prepaymentUsed > 0 && (
                <div className="flex justify-between text-accent">
                  <span>{t("pos.payment.prepaymentApplied")}</span>
                  <span className="tabular-nums">
                    {formatJOD(data.prepaymentUsed)}
                  </span>
                </div>
              )}
              {data.creditApplied !== undefined && data.creditApplied > 0 && (
                <div className="flex justify-between text-success">
                  <span>{t("pos.payment.creditApplied")}</span>
                  <span className="tabular-nums">
                    {formatJOD(data.creditApplied)}
                  </span>
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-border" />

            <p className="text-center text-muted-foreground">{t("pdf.thankYou")}</p>
          </div>
        </div>

        <div className="px-5 pb-5">
          <button onClick={onClose} className="w-full btn-primary h-10 text-sm">
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
