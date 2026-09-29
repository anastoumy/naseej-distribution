import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/ui/custom/modal/Modal";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/custom/toast/useToast";
import type { OutstandingDebt } from "@/types/Global";
import { formatJOD } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  customers: OutstandingDebt[];
  preselectedCustomerId?: number | null;
  onCollect: (data: {
    customer_id: number;
    amount: number;
    notes?: string | null;
  }) => Promise<{ success: boolean; error?: string }>;
}

export function CollectDebtModal({
  open,
  onClose,
  customers,
  preselectedCustomerId,
  onCollect,
}: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ customer?: string; amount?: string }>(
    {},
  );

  const selectedCustomer = customers.find(
    (c) => c.id === Number(customerId),
  );

  useEffect(() => {
    if (!open) return;
    setCustomerId(preselectedCustomerId ? String(preselectedCustomerId) : "");
    setAmount("");
    setNotes("");
    setErrors({});
  }, [open, preselectedCustomerId]);

  const handleClose = () => {
    onClose();
  };

  const handlePayFull = () => {
    if (selectedCustomer) {
      setAmount(selectedCustomer.credit.toFixed(2));
      setErrors((prev) => ({ ...prev, amount: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};

    if (!customerId) newErrors.customer = t("common.required");

    const parsedAmount = Number(amount);
    if (!amount || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      newErrors.amount = t("debts.amountRequired");
    } else if (
      selectedCustomer &&
      parsedAmount > selectedCustomer.credit
    ) {
      newErrors.amount = t("debts.amountExceedsBalance", {
        balance: formatJOD(selectedCustomer.credit),
      });
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    const res = await onCollect({
      customer_id: Number(customerId),
      amount: parsedAmount,
      notes: notes.trim() || null,
    });
    setSubmitting(false);

    if (res.success) {
      toast({ variant: "success", title: t("debts.collectSuccess") });
      handleClose();
    } else {
      toast({ variant: "error", title: res.error ?? t("common.error") });
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t("debts.collectTitle")}
      description={t("debts.collectSubtitle")}
      size="sm"
      footer={
        <div className="flex gap-2 justify-end">
          <button
            onClick={handleClose}
            type="button"
            className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
          >
            {t("common.cancel")}
          </button>
          <button
            form="collect-debt-form"
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-md text-sm bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {submitting ? t("common.loading") : t("debts.collectPayment")}
          </button>
        </div>
      }
    >
      <form
        id="collect-debt-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-1">
          <label
            htmlFor="collect-customer"
            className="text-sm font-medium text-foreground"
          >
            {t("debts.customer")}
            <span className="text-destructive ms-1">*</span>
          </label>
          <select
            id="collect-customer"
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              setAmount("");
              setErrors((prev) => ({ ...prev, customer: undefined }));
            }}
            className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            <option value="">{t("debts.selectCustomer")}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({formatJOD(c.credit)})
              </option>
            ))}
          </select>
          {errors.customer && (
            <p className="text-xs text-destructive">{errors.customer}</p>
          )}
        </div>

        {selectedCustomer && (
          <div className="px-4 py-3 rounded-lg bg-secondary/40 border border-border">
            <p className="text-xs text-muted-foreground">
              {t("debts.outstandingBalance")}
            </p>
            <p className="text-lg font-semibold text-destructive mt-0.5">
              {formatJOD(selectedCustomer.credit)}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Input
            id="collect-amount"
            label={t("debts.paymentAmount")}
            type="number"
            min={0.01}
            step={0.01}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setErrors((prev) => ({ ...prev, amount: undefined }));
            }}
            error={errors.amount}
            required
          />
          {selectedCustomer && selectedCustomer.credit > 0 && (
            <button
              type="button"
              onClick={handlePayFull}
              className="self-start text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer"
            >
              {t("debts.payFullBalance")}
            </button>
          )}
        </div>

        <Input
          id="collect-notes"
          label={t("common.notes")}
          placeholder={t("debts.notesPlaceholder")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </form>
    </Modal>
  );
}
