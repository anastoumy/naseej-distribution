import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { useCategories } from "../hooks/useCategories";
import { CreateCategoryModal } from "../forms/CreateCategoryModal";
import { EditCategoryModal } from "../forms/EditCategoryModal";
import { useToast } from "@/components/ui/custom/toast/useToast";
import type { Category } from "@/types/Global";

export function CategoriesScreen() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { categories, loading, create, update, remove } = useCategories();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const filtered = categories.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (c: Category) => {
    if (!confirm(`${t("categories.deleteConfirm")}\n"${c.title}"`)) return;
    setDeletingId(c.id);
    const res = await remove(c.id);
    setDeletingId(null);
    if (!res.success) toast({ variant: "error", title: res.error ?? t("common.error") });
    else toast({ variant: "success", title: t("categories.deleteSuccess") });
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("categories.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("categories.subtitle")}</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm hover:bg-accent/90 transition-colors cursor-pointer">
          <Plus size={16} />{t("categories.add")}
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t("categories.searchPlaceholder")}
          className="w-full ps-9 pe-4 py-2 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50" />
      </div>

      <div className="flex-1 overflow-auto rounded-lg border border-border">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">{t("common.loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">{t("common.noData")}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("categories.name")}</th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("categories.parent")}</th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("categories.createdAt")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{c.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.parent_title ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setEditTarget(c)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(c)} disabled={deletingId === c.id}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CreateCategoryModal open={showCreate} onClose={() => setShowCreate(false)} onCreate={create} categories={categories} />
      <EditCategoryModal open={!!editTarget} onClose={() => setEditTarget(null)} category={editTarget} onUpdate={update} categories={categories} />
    </div>
  );
}
