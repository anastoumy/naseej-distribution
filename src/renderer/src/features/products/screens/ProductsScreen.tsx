import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { useProducts } from "../hooks/useProducts";
import { useCategories } from "@/features/categories/hooks/useCategories";
import { useSuppliers } from "@/features/suppliers/hooks/useSuppliers";
import { useFlavors } from "@/features/flavors/hooks/useFlavors";
import { ProductImage } from "@/components/ui/ProductImage";
import { CreateProductModal } from "../forms/CreateProductModal";
import { EditProductModal } from "../forms/EditProductModal";
import { useToast } from "@/components/ui/custom/toast/useToast";
import type { Product } from "@/types/Global";

export function ProductsScreen() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { products, loading, create, update, remove } = useProducts();
  const { categories } = useCategories();
  const { suppliers } = useSuppliers();
  const { flavors } = useFlavors();

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const filtered = products.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    (p.category_title ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (p: Product) => {
    if (!confirm(`${t("products.deleteConfirm")}\n"${p.title}"`)) return;
    setDeletingId(p.id);
    const res = await remove(p.id);
    setDeletingId(null);
    if (!res.success) toast({ variant: "error", title: res.error ?? t("common.error") });
    else toast({ variant: "success", title: t("products.deleteSuccess") });
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("products.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("products.subtitle")}</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm hover:bg-accent/90 transition-colors cursor-pointer">
          <Plus size={16} />{t("products.add")}
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t("products.searchPlaceholder")}
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
                <th className="px-4 py-3" />
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("products.name")}</th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("products.category")}</th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("products.supplier")}</th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("products.regularPrice")}</th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("products.wholesalePrice")}</th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("products.purchasePrice")}</th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("products.flavors")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <ProductImage imagePath={p.image_path} alt={p.title} />
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{p.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.category_title ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.supplier_name ?? "—"}</td>
                  <td className="px-4 py-3 text-foreground">{p.price.toFixed(2)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.wholesale_price.toFixed(2)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.purchase_price.toFixed(2)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {p.flavor_names ? p.flavor_names : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setEditTarget(p)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(p)} disabled={deletingId === p.id}
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

      <CreateProductModal open={showCreate} onClose={() => setShowCreate(false)} onCreate={create}
        categories={categories} suppliers={suppliers} flavors={flavors} />
      <EditProductModal open={!!editTarget} onClose={() => setEditTarget(null)} product={editTarget} onUpdate={update}
        categories={categories} suppliers={suppliers} flavors={flavors} />
    </div>
  );
}
