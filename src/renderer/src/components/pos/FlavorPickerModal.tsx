import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn, formatJOD } from "@/lib/utils";
import type { Product, ProductFlavor } from "@/types/Global";

interface FlavorPickerModalProps {
  product: Product;
  onSelect: (flavor: ProductFlavor) => void;
  onSelectDefault: () => void;
  onClose: () => void;
}

export default function FlavorPickerModal({
  product,
  onSelect,
  onSelectDefault,
  onClose,
}: FlavorPickerModalProps) {
  const { t } = useTranslation();
  const flavors = product.flavors ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-slide-up">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <p className="text-sm font-semibold text-foreground">{product.title}</p>
            <p className="text-xs text-muted-foreground">{t("pos.selectFlavor")}</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t("common.close")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
          {flavors.map((flavor) => (
            <button
              key={flavor.id}
              onClick={() => onSelect(flavor)}
              className="pos-card p-3 text-start transition-colors hover:border-accent/40 hover:bg-accent/5"
            >
              <p className="text-sm font-medium text-foreground">{flavor.name}</p>
              <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                {formatJOD(flavor.price > 0 ? flavor.price : product.price)}
              </p>
            </button>
          ))}
        </div>

        <div className="px-3 pb-3">
          <button onClick={onSelectDefault} className="w-full btn-secondary text-xs h-9">
            {t("pos.addWithoutFlavor")}
          </button>
        </div>
      </div>
    </div>
  );
}
