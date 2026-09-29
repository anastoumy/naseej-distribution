import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/ui/custom/modal/Modal";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/custom/toast/useToast";
import type { DebtAdjustment, OutstandingDebt } from "@/types/Global";

type AccountType = "customer" | "supplier";

interface Props {
  open: boolean;
  onClose: () => void;
  accountType: AccountType;
  accounts: OutstandingDebt[];
  fixedAccountId?: number | null;
  preselectedAccountId?: number | null;
  adjustment?: DebtAdjustment | null;
  onSave: (data: {
    account_id: number;
    amount: number;
    notes?: string | null;
    effective_date?: string;
    id?: number;
  }) => Promise<{ success: boolean; error?: string }>;
}

function toDateInputValue(iso?: string | null): string {
  if (!iso) return new Date().toISOString().slice(0, 10);
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export function AdjustDebtModal({
  open,
  onClose,
  accountType,
  accounts,
  fixedAccountId,
  preselectedAccountId,
  adjustment,
  onSave,
}: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const isEdit = !!adjustment;
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    account?: string;
    amount?: string;
    date?: string;
  }>({});

  useEffect(() => {
    if (!open) return;

    const defaultAccountId =
      fixedAccountId ??
      preselectedAccountId ??
      (adjustment ? undefined : accounts[0]?.id);

    setAccountId(
      defaultAccountId !== undefined ? String(defaultAccountId) : "",
    );
    setAmount(adjustment ? String(adjustment.amount) : "");
    setEffectiveDate(toDateInputValue(adjustment?.effective_date));
    setNotes(adjustment?.notes ?? "");
    setErrors({});
  }, [open, fixedAccountId, preselectedAccountId, adjustment, accounts]);

  const handleClose = () => onClose();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};
    const resolvedAccountId = fixedAccountId ?? Number(accountId);

    if (!resolvedAccountId) {
      newErrors.account = t("common.required");
    }

    const parsedAmount = Number(amount);
    if (!amount || !Number.isFinite(parsedAmount) || parsedAmount === 0) {
      newErrors.amount = t("debts.adjustmentAmountRequired");
    }

    if (!effectiveDate) {
      newErrors.date = t("common.required");
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    const res = await onSave({
      id: adjustment?.id,
      account_id: resolvedAccountId,
      amount: parsedAmount,
      notes: notes.trim() || null,
      effective_date: effectiveDate,
    });
    setSubmitting(false);

    if (res.success) {
      toast({
        variant: "success",
        title: isEdit
          ? t("debts.adjustmentUpdateSuccess")
          : t("debts.adjustmentCreateSuccess"),
      });
      handleClose();
    } else {
      toast({ variant: "error", title: res.error ?? t("common.error") });
    }
  };

  const accountLabel =
    accountType === "customer" ? t("debts.customer") : t("debts.supplier");

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        isEdit ? t("debts.editAdjustmentTitle") : t("debts.addAdjustmentTitle")
      }
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
            form="adjust-debt-form"
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-md text-sm bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {submitting ? t("common.loading") : t("common.save")}
          </button>
        </div>
      }
    >
      <form
        id="adjust-debt-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        <p className="text-sm text-muted-foreground">
          {t("debts.adjustmentHelp")}
        </p>

        {!fixedAccountId && (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="adjust-debt-account"
              className="text-sm font-medium text-foreground"
            >
              {accountLabel}
            </label>
            <select
              id="adjust-debt-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              disabled={isEdit}
              className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-60"
            >
              <option value="">{t("debts.selectAccount")}</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
            {errors.account && (
              <p className="text-xs text-destructive">{errors.account}</p>
            )}
          </div>
        )}

        <Input
          id="adjust-debt-amount"
          label={t("debts.adjustmentAmount")}
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={errors.amount}
          type="number"
          step="0.01"
          required
          autoFocus={!!fixedAccountId}
        />

        <Input
          id="adjust-debt-date"
          label={t("debts.effectiveDate")}
          value={effectiveDate}
          onChange={(e) => setEffectiveDate(e.target.value)}
          error={errors.date}
          type="date"
          required
        />

        <Input
          id="adjust-debt-notes"
          label={t("debts.description")}
          placeholder={t("debts.adjustmentNotesPlaceholder")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </form>
    </Modal>
  );
}
