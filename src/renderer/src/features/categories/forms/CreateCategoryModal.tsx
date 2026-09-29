import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/ui/custom/modal/Modal";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/custom/toast/useToast";
import type { Category } from "@/types/Global";

interface Props {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  onCreate: (data: { title: string; parent_id?: number | null }) => Promise<{ success: boolean; error?: string }>;
}

export function CreateCategoryModal({ open, onClose, categories, onCreate }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [parentId, setParentId] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ title?: string }>({});

  const handleClose = () => { setTitle(""); setParentId(""); setErrors({}); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};
    if (!title.trim()) newErrors.title = t("common.required");
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setSubmitting(true);
    const res = await onCreate({ title: title.trim(), parent_id: parentId !== "" ? parentId : null });
    setSubmitting(false);

    if (res.success) {
      toast({ variant: "success", title: t("categories.createSuccess") });
      handleClose();
    } else {
      toast({ variant: "error", title: res.error ?? t("common.error") });
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={t("categories.add")} size="sm"
      footer={
        <div className="flex gap-2 justify-end">
          <button onClick={handleClose} type="button"
            className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
            {t("common.cancel")}
          </button>
          <button form="create-category-form" type="submit" disabled={submitting}
            className="px-4 py-2 rounded-md text-sm bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors cursor-pointer">
            {submitting ? t("common.loading") : t("common.save")}
          </button>
        </div>
      }
    >
      <form id="create-category-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input id="cat-title" label={t("categories.name")} placeholder={t("categories.namePlaceholder")}
          value={title} onChange={e => setTitle(e.target.value)} error={errors.title} required autoFocus />

        <div className="flex flex-col gap-1">
          <label htmlFor="cat-parent" className="text-sm font-medium text-foreground">
            {t("categories.parent")}
          </label>
          <select id="cat-parent" value={parentId}
            onChange={e => setParentId(e.target.value !== "" ? Number(e.target.value) : "")}
            className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/50">
            <option value="">{t("categories.noParent")}</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
      </form>
    </Modal>
  );
}
