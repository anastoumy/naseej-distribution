import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { useCustomers } from "../hooks/useCustomers";
import { CreateCustomerModal } from "../forms/CreateCustomerModal";
import { EditCustomerModal } from "../forms/EditCustomerModal";
import { useToast } from "@/components/ui/custom/toast/useToast";
import type { Customer } from "@/types/Global";

export function CustomersScreen() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { customers, loading, create, update, remove } = useCustomers();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? "").includes(search)
  );

  const totalCredit = customers.reduce((s, c) => s + c.credit, 0);

  const handleDelete = async (c: Customer) => {
    if (!confirm(`${t("customers.deleteConfirm")}\n"${c.name}"`)) return;
    setDeletingId(c.id);
    const res = await remove(c.id);
    setDeletingId(null);
    if (!res.success) toast({ variant: "error", title: res.error ?? t("common.error") });
    else toast({ variant: "success", title: t("customers.deleteSuccess") });
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("customers.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("customers.subtitle")}</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm hover:bg-accent/90 transition-colors cursor-pointer">
          <Plus size={16} />
          {t("customers.add")}
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4">
        <div className="px-4 py-3 rounded-lg bg-card border border-border">
          <p className="text-xs text-muted-foreground">{t("customers.totalCredit")}</p>
          <p className="text-lg font-semibold text-destructive mt-0.5">{totalCredit.toFixed(2)}</p>
        </div>
        <div className="px-4 py-3 rounded-lg bg-card border border-border">
          <p className="text-xs text-muted-foreground">{t("customers.title")}</p>
          <p className="text-lg font-semibold text-foreground mt-0.5">{customers.length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t("customers.searchPlaceholder")}
          className="w-full ps-9 pe-4 py-2 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-lg border border-border">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">{t("common.loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">{t("common.noData")}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("customers.name")}</th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("customers.phone")}</th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("customers.credit")}</th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("customers.createdAt")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        c.credit > 0
                          ? "text-destructive font-medium"
                          : c.credit < 0
                            ? "text-success font-medium"
                            : "text-muted-foreground"
                      }
                    >
                      {c.credit < 0
                        ? `-${Math.abs(c.credit).toFixed(2)}`
                        : c.credit.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setEditTarget(c)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer" title={t("common.edit")}>
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(c)} disabled={deletingId === c.id}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50" title={t("common.delete")}>
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

      <CreateCustomerModal open={showCreate} onClose={() => setShowCreate(false)} onCreate={create} />
      <EditCustomerModal open={!!editTarget} onClose={() => setEditTarget(null)} customer={editTarget} onUpdate={update} />
    </div>
  );
}
