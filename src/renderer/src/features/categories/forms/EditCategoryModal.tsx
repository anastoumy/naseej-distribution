import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/ui/custom/modal/Modal";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/custom/toast/useToast";
import type { Category } from "@/types/Global";

interface Props {
  open: boolean;
  onClose: () => void;
  category: Category | null;
  categories: Category[];
  onUpdate: (data: { id: number; title?: string; parent_id?: number | null }) => Promise<{ success: boolean; error?: string }>;
}

export function EditCategoryModal({ open, onClose, category, categories, onUpdate }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [parentId, setParentId] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ title?: string }>({});

  useEffect(() => {
    if (category) { setTitle(category.title); setParentId(category.parent_id ?? ""); setErrors({}); }
  }, [category]);

  const handleClose = () => { setErrors({}); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) return;
    const newErrors: typeof errors = {};
    if (!title.trim()) newErrors.title = t("common.required");
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setSubmitting(true);
    const res = await onUpdate({ id: category.id, title: title.trim(), parent_id: parentId !== "" ? Number(parentId) : null });
    setSubmitting(false);

    if (res.success) {
      toast({ variant: "success", title: t("categories.updateSuccess") });
      handleClose();
    } else {
      toast({ variant: "error", title: res.error ?? t("common.error") });
    }
  };

  // Exclude the current category from parent options to avoid circular reference
  const parentOptions = categories.filter(c => c.id !== category?.id);

  return (
    <Modal open={open} onClose={handleClose} title={t("categories.editTitle")} size="sm"
      footer={
        <div className="flex gap-2 justify-end">
          <button onClick={handleClose} type="button"
            className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
            {t("common.cancel")}
          </button>
          <button form="edit-category-form" type="submit" disabled={submitting}
            className="px-4 py-2 rounded-md text-sm bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors cursor-pointer">
            {submitting ? t("common.loading") : t("common.save")}
          </button>
        </div>
      }
    >
      <form id="edit-category-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input id="edit-cat-title" label={t("categories.name")} placeholder={t("categories.namePlaceholder")}
          value={title} onChange={e => setTitle(e.target.value)} error={errors.title} required autoFocus />

        <div className="flex flex-col gap-1">
          <label htmlFor="edit-cat-parent" className="text-sm font-medium text-foreground">{t("categories.parent")}</label>
          <select id="edit-cat-parent" value={parentId}
            onChange={e => setParentId(e.target.value !== "" ? Number(e.target.value) : "")}
            className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/50">
            <option value="">{t("categories.noParent")}</option>
            {parentOptions.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
      </form>
    </Modal>
  );
}
