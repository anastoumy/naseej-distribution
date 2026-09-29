import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { useSuppliers } from "../hooks/useSuppliers";
import { CreateSupplierModal } from "../forms/CreateSupplierModal";
import { EditSupplierModal } from "../forms/EditSupplierModal";
import { useToast } from "@/components/ui/custom/toast/useToast";
import type { Supplier } from "@/types/Global";

export function SuppliersScreen() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { suppliers, loading, create, update, remove } = useSuppliers();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplier | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) || (s.phone ?? "").includes(search)
  );
  const totalCredit = suppliers.reduce((s, sup) => s + sup.credit, 0);

  const handleDelete = async (s: Supplier) => {
    if (!confirm(`${t("suppliers.deleteConfirm")}\n"${s.name}"`)) return;
    setDeletingId(s.id);
    const res = await remove(s.id);
    setDeletingId(null);
    if (!res.success) toast({ variant: "error", title: res.error ?? t("common.error") });
    else toast({ variant: "success", title: t("suppliers.deleteSuccess") });
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("suppliers.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("suppliers.subtitle")}</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm hover:bg-accent/90 transition-colors cursor-pointer">
          <Plus size={16} />{t("suppliers.add")}
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="px-4 py-3 rounded-lg bg-card border border-border">
          <p className="text-xs text-muted-foreground">{t("suppliers.totalCredit")}</p>
          <p className="text-lg font-semibold text-warning mt-0.5">{totalCredit.toFixed(2)}</p>
        </div>
        <div className="px-4 py-3 rounded-lg bg-card border border-border">
          <p className="text-xs text-muted-foreground">{t("suppliers.title")}</p>
          <p className="text-lg font-semibold text-foreground mt-0.5">{suppliers.length}</p>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t("suppliers.searchPlaceholder")}
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
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("suppliers.name")}</th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("suppliers.phone")}</th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("suppliers.credit")}</th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("suppliers.createdAt")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={s.credit > 0 ? "text-warning font-medium" : "text-muted-foreground"}>
                      {s.credit.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(s.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setEditTarget(s)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(s)} disabled={deletingId === s.id}
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

      <CreateSupplierModal open={showCreate} onClose={() => setShowCreate(false)} onCreate={create} />
      <EditSupplierModal open={!!editTarget} onClose={() => setEditTarget(null)} supplier={editTarget} onUpdate={update} />
    </div>
  );
}
