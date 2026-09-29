import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { useFlavors } from "../hooks/useFlavors";
import { CreateFlavorModal } from "../forms/CreateFlavorModal";
import { EditFlavorModal } from "../forms/EditFlavorModal";
import { useToast } from "@/components/ui/custom/toast/useToast";
import type { Flavor } from "@/types/Global";

export function FlavorsScreen() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { flavors, loading, create, update, remove } = useFlavors();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Flavor | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const filtered = flavors.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  const handleDelete = async (f: Flavor) => {
    if (!confirm(`${t("flavors.deleteConfirm")}\n"${f.name}"`)) return;
    setDeletingId(f.id);
    const res = await remove(f.id);
    setDeletingId(null);
    if (!res.success) toast({ variant: "error", title: res.error ?? t("common.error") });
    else toast({ variant: "success", title: t("flavors.deleteSuccess") });
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("flavors.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("flavors.subtitle")}</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm hover:bg-accent/90 transition-colors cursor-pointer">
          <Plus size={16} />{t("flavors.add")}
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t("flavors.searchPlaceholder")}
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
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("flavors.name")}</th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("flavors.createdAt")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => (
                <tr key={f.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{f.name}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(f.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setEditTarget(f)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(f)} disabled={deletingId === f.id}
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

      <CreateFlavorModal open={showCreate} onClose={() => setShowCreate(false)} onCreate={create} />
      <EditFlavorModal open={!!editTarget} onClose={() => setEditTarget(null)} flavor={editTarget} onUpdate={update} />
    </div>
  );
}
