import { useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { formatJOD } from "@/lib/utils";
import type { CartItem } from "@/types/Global";

interface CartPriceEditModalProps {
  item: CartItem;
  onSave: (unitPrice: number, note?: string) => void;
  onClose: () => void;
}

export default function CartPriceEditModal({
  item,
  onSave,
  onClose,
}: CartPriceEditModalProps) {
  const { t } = useTranslation();
  const [priceInput, setPriceInput] = useState(item.unitPrice.toFixed(2));
  const [note, setNote] = useState(item.priceNote ?? "");

  const parsedPrice = parseFloat(priceInput);
  const isValid = Number.isFinite(parsedPrice) && parsedPrice >= 0;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {item.variant.productName}
            </p>
            <p className="text-xs text-muted-foreground">{t("pos.editPrice")}</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              {t("pos.unitPrice")}
            </label>
            <input
              autoFocus
              type="number"
              min={0}
              step="0.01"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              className="pos-input text-sm tabular-nums"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              {t("pos.retailWholesale", {
                retail: formatJOD(item.variant.retailPrice),
                wholesale: formatJOD(item.variant.wholesalePrice),
              })}
            </p>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              {t("pos.priceNote")}
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("pos.priceNotePlaceholder")}
              className="pos-input text-xs"
            />
          </div>
        </div>

        <div className="px-4 pb-4 flex gap-2">
          <button onClick={onClose} className="flex-1 btn-ghost h-9 text-xs">
            {t("common.cancel")}
          </button>
          <button
            disabled={!isValid}
            onClick={() => onSave(parsedPrice, note)}
            className="flex-1 btn-primary h-9 text-xs"
          >
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
