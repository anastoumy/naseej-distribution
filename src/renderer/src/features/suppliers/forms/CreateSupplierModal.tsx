import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/ui/custom/modal/Modal";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/custom/toast/useToast";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    phone?: string;
    opening_balance?: number;
    opening_balance_notes?: string;
    opening_balance_date?: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

export function CreateSupplierModal({ open, onClose, onCreate }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [openingBalanceDate, setOpeningBalanceDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [openingBalanceNotes, setOpeningBalanceNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});

  const handleClose = () => {
    setName("");
    setPhone("");
    setOpeningBalance("");
    setOpeningBalanceDate(new Date().toISOString().slice(0, 10));
    setOpeningBalanceNotes("");
    setErrors({});
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};
    if (!name.trim()) newErrors.name = t("common.required");
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    const parsedOpeningBalance =
      openingBalance.trim() === "" ? undefined : Number(openingBalance);

    setSubmitting(true);
    const res = await onCreate({
      name: name.trim(),
      phone: phone.trim() || undefined,
      opening_balance:
        parsedOpeningBalance !== undefined && Number.isFinite(parsedOpeningBalance)
          ? parsedOpeningBalance
          : undefined,
      opening_balance_notes: openingBalanceNotes.trim() || undefined,
      opening_balance_date: openingBalance.trim()
        ? openingBalanceDate
        : undefined,
    });
    setSubmitting(false);

    if (res.success) {
      toast({ variant: "success", title: t("suppliers.createSuccess") });
      handleClose();
    } else {
      toast({ variant: "error", title: res.error ?? t("common.error") });
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={t("suppliers.add")} size="sm"
      footer={
        <div className="flex gap-2 justify-end">
          <button onClick={handleClose} type="button"
            className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
            {t("common.cancel")}
          </button>
          <button form="create-supplier-form" type="submit" disabled={submitting}
            className="px-4 py-2 rounded-md text-sm bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors cursor-pointer">
            {submitting ? t("common.loading") : t("common.save")}
          </button>
        </div>
      }
    >
      <form id="create-supplier-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input id="supplier-name" label={t("suppliers.name")} placeholder={t("suppliers.namePlaceholder")}
          value={name} onChange={e => setName(e.target.value)} error={errors.name} required autoFocus />
        <Input id="supplier-phone" label={t("suppliers.phone")} placeholder={t("suppliers.phonePlaceholder")}
          value={phone} onChange={e => setPhone(e.target.value)} type="tel" />
        <Input
          id="supplier-opening-balance"
          label={t("suppliers.openingBalance")}
          placeholder="0.00"
          value={openingBalance}
          onChange={e => setOpeningBalance(e.target.value)}
          type="number"
          step="0.01"
        />
        {openingBalance.trim() !== "" && (
          <>
            <Input
              id="supplier-opening-balance-date"
              label={t("debts.effectiveDate")}
              value={openingBalanceDate}
              onChange={e => setOpeningBalanceDate(e.target.value)}
              type="date"
            />
            <Input
              id="supplier-opening-balance-notes"
              label={t("debts.description")}
              placeholder={t("debts.adjustmentNotesPlaceholder")}
              value={openingBalanceNotes}
              onChange={e => setOpeningBalanceNotes(e.target.value)}
            />
          </>
        )}
      </form>
    </Modal>
  );
}
