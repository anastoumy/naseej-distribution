import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Wallet } from "lucide-react";
import { cn, formatJOD } from "@/lib/utils";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import type { POSCustomer } from "@/types/Global";

interface PaymentModalProps {
  total: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  attachedCustomer: POSCustomer | null;
  customerCredit?: number;
  staffName: string;
  onSuccess: (receiptNum: string, amountPaid: number) => Promise<void> | void;
  onClose: () => void;
}

export default function PaymentModal({
  total,
  subtotal,
  taxAmount,
  discountAmount,
  attachedCustomer,
  customerCredit = 0,
  staffName,
  onSuccess,
  onClose,
}: PaymentModalProps) {
  const { t } = useTranslation();
  const panelRef = useFocusTrap<HTMLDivElement>(true);
  const [amountInput, setAmountInput] = useState(total.toFixed(2));
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const prepaymentAvailable = Math.max(0, Number((-customerCredit).toFixed(2)));
  const prepaymentApplied = Math.min(prepaymentAvailable, total);
  const effectiveTotal = Math.max(
    0,
    Number((total - prepaymentApplied).toFixed(2)),
  );

  const amountPaid = parseFloat(amountInput) || 0;
  const debtAmount = Math.max(
    0,
    Number((effectiveTotal - amountPaid).toFixed(2)),
  );
  const creditApplied = Math.max(
    0,
    Number((amountPaid - effectiveTotal).toFixed(2)),
  );
  const isValid = amountPaid >= 0;

  const handleConfirm = async () => {
    setError("");
    if (!isValid) {
      setError(t("pos.payment.invalidAmount"));
      return;
    }
    setProcessing(true);
    try {
      const receiptNum = `RCP-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
      await onSuccess(receiptNum, amountPaid);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("pos.payment.failed");
      setError(message);
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-modal-title"
        className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 id="payment-modal-title" className="text-base font-semibold text-foreground">
            {t("pos.payment.title")}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("common.closeModal")}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-muted rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">
              {t("pos.payment.totalDue")}
            </p>
            <p className="text-3xl font-bold text-foreground tabular-nums">
              {formatJOD(prepaymentApplied > 0 ? effectiveTotal : total)}
            </p>
            {prepaymentApplied > 0 && (
              <p className="text-xs text-muted-foreground mt-1 line-through">
                {formatJOD(total)}
              </p>
            )}
            {discountAmount > 0 && (
              <p className="text-xs text-success mt-1">
                {t("pos.payment.includesDiscount", {
                  amount: formatJOD(discountAmount),
                })}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {t("pos.payment.subtotalTax", {
                subtotal: formatJOD(subtotal),
                tax: formatJOD(taxAmount),
              })}
            </p>
          </div>

          {attachedCustomer && (
            <div className="flex items-center gap-2 px-3 py-2 bg-accent/5 border border-accent/20 rounded-lg">
              <div className="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-accent">
                  {attachedCustomer.firstName[0]}
                </span>
              </div>
              <span className="text-xs text-foreground">
                {attachedCustomer.firstName} {attachedCustomer.lastName}
              </span>
            </div>
          )}

          {prepaymentApplied > 0 && (
            <div className="flex items-start gap-3 px-3 py-3 bg-accent/5 border border-accent/20 rounded-xl">
              <Wallet className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-accent">
                  {t("pos.payment.prepaymentApplied")}
                </p>
                <p className="text-lg font-bold text-accent tabular-nums">
                  {formatJOD(prepaymentApplied)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {t("pos.payment.prepaymentAppliedHint", {
                    balance: formatJOD(prepaymentAvailable),
                  })}
                </p>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs text-muted-foreground mb-2">
              {t("pos.payment.amountPaidNow")}
            </p>
            <input
              autoFocus
              type="number"
              min={0}
              step="0.01"
              value={amountInput}
              onChange={(e) => {
                setAmountInput(e.target.value);
                setError("");
              }}
              className="pos-input text-lg font-semibold tabular-nums text-center"
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setAmountInput(
                    (prepaymentApplied > 0 ? effectiveTotal : total).toFixed(2),
                  )
                }
                className="text-xs py-2 rounded-lg border border-border hover:bg-secondary transition-colors cursor-pointer"
              >
                {t("pos.payment.payFull")}
              </button>
              <button
                type="button"
                onClick={() => setAmountInput("0")}
                className="text-xs py-2 rounded-lg border border-border hover:bg-secondary transition-colors cursor-pointer"
              >
                {t("pos.payment.payLater")}
              </button>
            </div>
          </div>

          {debtAmount > 0 && (
            <div className="flex items-start gap-3 px-3 py-3 bg-destructive/5 border border-destructive/20 rounded-xl">
              <Wallet className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-destructive">
                  {t("pos.payment.addedToDebt")}
                </p>
                <p className="text-lg font-bold text-destructive tabular-nums">
                  {formatJOD(debtAmount)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {t("pos.payment.debtHint")}
                </p>
              </div>
            </div>
          )}

          {creditApplied > 0 && (
            <div className="flex items-start gap-3 px-3 py-3 bg-success/5 border border-success/20 rounded-xl">
              <Wallet className="w-4 h-4 text-success shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-success">
                  {t("pos.payment.creditApplied")}
                </p>
                <p className="text-lg font-bold text-success tabular-nums">
                  {formatJOD(creditApplied)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {t("pos.payment.creditAppliedHint")}
                </p>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <p className="text-[10px] text-muted-foreground text-center">
            {t("pos.payment.staff", { name: staffName })}
          </p>
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onClose}
            disabled={processing}
            className="flex-1 btn-ghost h-11 text-sm"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid || processing}
            className={cn(
              "flex-1 h-11 text-sm font-semibold rounded-md transition-colors",
              debtAmount > 0
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "btn-primary",
            )}
          >
            {processing
              ? t("pos.payment.processing")
              : debtAmount > 0
                ? t("pos.payment.confirmWithDebt", {
                    amount: formatJOD(debtAmount),
                  })
                : t("pos.payment.confirmPaid", {
                    amount: formatJOD(
                      prepaymentApplied > 0 ? effectiveTotal : total,
                    ),
                  })}
          </button>
        </div>
      </div>
    </div>
  );
}
