import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/ui/custom/modal/Modal";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/custom/toast/useToast";
import type { Supplier } from "@/types/Global";

interface Props {
  open: boolean;
  onClose: () => void;
  supplier: Supplier | null;
  onUpdate: (data: { id: number; name?: string; phone?: string | null }) => Promise<{ success: boolean; error?: string }>;
}

export function EditSupplierModal({ open, onClose, supplier, onUpdate }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});

  useEffect(() => {
    if (supplier) { setName(supplier.name); setPhone(supplier.phone ?? ""); setErrors({}); }
  }, [supplier]);

  const handleClose = () => { setErrors({}); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier) return;
    const newErrors: typeof errors = {};
    if (!name.trim()) newErrors.name = t("common.required");
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setSubmitting(true);
    const res = await onUpdate({ id: supplier.id, name: name.trim(), phone: phone.trim() || null });
    setSubmitting(false);

    if (res.success) {
      toast({ variant: "success", title: t("suppliers.updateSuccess") });
      handleClose();
    } else {
      toast({ variant: "error", title: res.error ?? t("common.error") });
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={t("suppliers.editTitle")} size="sm"
      footer={
        <div className="flex gap-2 justify-end">
          <button onClick={handleClose} type="button"
            className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
            {t("common.cancel")}
          </button>
          <button form="edit-supplier-form" type="submit" disabled={submitting}
            className="px-4 py-2 rounded-md text-sm bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors cursor-pointer">
            {submitting ? t("common.loading") : t("common.save")}
          </button>
        </div>
      }
    >
      <form id="edit-supplier-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input id="edit-supplier-name" label={t("suppliers.name")} placeholder={t("suppliers.namePlaceholder")}
          value={name} onChange={e => setName(e.target.value)} error={errors.name} required autoFocus />
        <Input id="edit-supplier-phone" label={t("suppliers.phone")} placeholder={t("suppliers.phonePlaceholder")}
          value={phone} onChange={e => setPhone(e.target.value)} type="tel" />
      </form>
    </Modal>
  );
}
