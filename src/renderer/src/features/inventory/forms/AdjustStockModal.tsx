import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/ui/custom/modal/Modal";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/custom/toast/useToast";
import type { InventoryRow } from "@/types/Global";

interface Props {
  open: boolean;
  onClose: () => void;
  row: InventoryRow | null;
  onAdjust: (data: { product_id: number; flavor_id?: number | null; delta: number }) => Promise<{ success: boolean; error?: string }>;
  onSetQty: (data: { product_id: number; flavor_id?: number | null; qty: number }) => Promise<{ success: boolean; error?: string }>;
}

export function AdjustStockModal({ open, onClose, row, onAdjust, onSetQty }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [mode, setMode] = useState<"delta" | "set">("set");
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const handleClose = () => { setValue(""); setError(undefined); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!row) return;
    if (!value.trim() || isNaN(Number(value))) { setError(t("common.required")); return; }

    setSubmitting(true);
    const num = Number(value);
    const res = mode === "delta"
      ? await onAdjust({ product_id: row.product_id, flavor_id: row.flavor_id, delta: num })
      : await onSetQty({ product_id: row.product_id, flavor_id: row.flavor_id, qty: num });
    setSubmitting(false);

    if (res.success) {
      toast({ variant: "success", title: t("inventory.adjustSuccess") });
      handleClose();
    } else {
      toast({ variant: "error", title: res.error ?? t("common.error") });
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={t("inventory.adjustTitle")} size="sm"
      footer={
        <div className="flex gap-2 justify-end">
          <button onClick={handleClose} type="button"
            className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
            {t("common.cancel")}
          </button>
          <button form="adjust-stock-form" type="submit" disabled={submitting}
            className="px-4 py-2 rounded-md text-sm bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors cursor-pointer">
            {submitting ? t("common.loading") : t("common.save")}
          </button>
        </div>
      }
    >
      {row && (
        <form id="adjust-stock-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Product info */}
          <div className="p-3 rounded-md bg-secondary/50 border border-border">
            <p className="text-sm font-medium text-foreground">{row.product_title}</p>
            {row.flavor_name && (
              <p className="text-xs text-muted-foreground mt-0.5">{row.flavor_name}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {t("inventory.currentQty")}: <span className="text-foreground font-medium">{row.quantity}</span>
            </p>
          </div>

          {/* Mode selector */}
          <div className="flex rounded-md overflow-hidden border border-border">
            <button type="button" onClick={() => setMode("set")}
              className={`flex-1 py-2 text-sm transition-colors cursor-pointer ${mode === "set" ? "bg-accent/20 text-accent" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
              {t("inventory.newQty")}
            </button>
            <button type="button" onClick={() => setMode("delta")}
              className={`flex-1 py-2 text-sm transition-colors cursor-pointer ${mode === "delta" ? "bg-accent/20 text-accent" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
              {t("inventory.delta")}
            </button>
          </div>

          <Input
            id="stock-value"
            label={mode === "set" ? t("inventory.newQty") : t("inventory.delta")}
            type="number"
            step="0.01"
            value={value}
            onChange={e => { setValue(e.target.value); setError(undefined); }}
            error={error}
            autoFocus
          />
        </form>
      )}
    </Modal>
  );
}
