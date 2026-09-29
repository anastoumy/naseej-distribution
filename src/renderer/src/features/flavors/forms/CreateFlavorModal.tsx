import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/ui/custom/modal/Modal";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/custom/toast/useToast";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (data: { name: string }) => Promise<{ success: boolean; error?: string }>;
}

export function CreateFlavorModal({ open, onClose, onCreate }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});

  const handleClose = () => { setName(""); setErrors({}); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};
    if (!name.trim()) newErrors.name = t("common.required");
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setSubmitting(true);
    const res = await onCreate({ name: name.trim() });
    setSubmitting(false);

    if (res.success) {
      toast({ variant: "success", title: t("flavors.createSuccess") });
      handleClose();
    } else {
      toast({ variant: "error", title: res.error ?? t("common.error") });
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={t("flavors.add")} size="sm"
      footer={
        <div className="flex gap-2 justify-end">
          <button onClick={handleClose} type="button"
            className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
            {t("common.cancel")}
          </button>
          <button form="create-flavor-form" type="submit" disabled={submitting}
            className="px-4 py-2 rounded-md text-sm bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors cursor-pointer">
            {submitting ? t("common.loading") : t("common.save")}
          </button>
        </div>
      }
    >
      <form id="create-flavor-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input id="flavor-name" label={t("flavors.name")} placeholder={t("flavors.namePlaceholder")}
          value={name} onChange={e => setName(e.target.value)} error={errors.name} required autoFocus />
      </form>
    </Modal>
  );
}
