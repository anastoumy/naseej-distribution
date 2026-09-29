import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/ui/custom/modal/Modal";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/custom/toast/useToast";
import type { Customer } from "@/types/Global";

interface Props {
  open: boolean;
  onClose: () => void;
  customer: Customer | null;
  onUpdate: (data: { id: number; name?: string; phone?: string | null }) => Promise<{ success: boolean; error?: string }>;
}

export function EditCustomerModal({ open, onClose, customer, onUpdate }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});

  useEffect(() => {
    if (customer) { setName(customer.name); setPhone(customer.phone ?? ""); setErrors({}); }
  }, [customer]);

  const handleClose = () => { setErrors({}); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    const newErrors: typeof errors = {};
    if (!name.trim()) newErrors.name = t("common.required");
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setSubmitting(true);
    const res = await onUpdate({ id: customer.id, name: name.trim(), phone: phone.trim() || null });
    setSubmitting(false);

    if (res.success) {
      toast({ variant: "success", title: t("customers.updateSuccess") });
      handleClose();
    } else {
      toast({ variant: "error", title: res.error ?? t("common.error") });
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={t("customers.editTitle")} size="sm"
      footer={
        <div className="flex gap-2 justify-end">
          <button onClick={handleClose} type="button"
            className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
            {t("common.cancel")}
          </button>
          <button form="edit-customer-form" type="submit" disabled={submitting}
            className="px-4 py-2 rounded-md text-sm bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors cursor-pointer">
            {submitting ? t("common.loading") : t("common.save")}
          </button>
        </div>
      }
    >
      <form id="edit-customer-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input id="edit-customer-name" label={t("customers.name")}
          placeholder={t("customers.namePlaceholder")} value={name}
          onChange={e => setName(e.target.value)} error={errors.name} required autoFocus />
        <Input id="edit-customer-phone" label={t("customers.phone")}
          placeholder={t("customers.phonePlaceholder")} value={phone}
          onChange={e => setPhone(e.target.value)} type="tel" />
      </form>
    </Modal>
  );
}
