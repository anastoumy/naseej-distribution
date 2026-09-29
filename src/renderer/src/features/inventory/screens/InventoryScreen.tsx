import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SlidersHorizontal } from "lucide-react";
import { useInventory } from "../hooks/useInventory";
import { AdjustStockModal } from "../forms/AdjustStockModal";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventoryStock";
import type { InventoryRow } from "@/types/Global";

export function InventoryScreen() {
  const { t } = useTranslation();
  const { inventory, loading, adjust, setQty } = useInventory();
  const [adjustTarget, setAdjustTarget] = useState<InventoryRow | null>(null);

  const lowStock = inventory.filter(
    (r) => r.quantity > 0 && r.quantity <= LOW_STOCK_THRESHOLD,
  ).length;

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("inventory.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("inventory.subtitle")}</p>
        </div>
        {lowStock > 0 && (
          <div className="px-3 py-1.5 rounded-md bg-destructive/10 text-destructive text-sm border border-destructive/30">
            {t("inventory.lowStock")}: {lowStock}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto rounded-lg border border-border">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">{t("common.loading")}</div>
        ) : inventory.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">{t("common.noData")}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("inventory.product")}</th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("inventory.flavor")}</th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("inventory.quantity")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {inventory.map(row => (
                <tr key={`${row.product_id}-${row.flavor_id ?? "none"}`}
                  className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{row.product_title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.flavor_name ?? "—"}</td>
                  <td className="px-4 py-3 text-foreground">{row.quantity}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <button onClick={() => setAdjustTarget(row)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer border border-border">
                        <SlidersHorizontal size={12} />{t("inventory.adjust")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AdjustStockModal open={!!adjustTarget} onClose={() => setAdjustTarget(null)} row={adjustTarget}
        onAdjust={adjust} onSetQty={setQty} />
    </div>
  );
}
