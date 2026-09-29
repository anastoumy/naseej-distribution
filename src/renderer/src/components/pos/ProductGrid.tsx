import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Plus, Package } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ProductImage } from "@renderer/components/ui/ProductImage";
import { useColumnCount } from "@/hooks/useColumnCount";
import { cn, formatJOD } from "@/lib/utils";
import type { Product } from "@/types/Global";
import {
  getProductTotalStock,
  isLowStock,
  isOutOfStock,
} from "@/lib/inventoryStock";

const ROW_HEIGHT = 248;

interface ProductGridProps {
  products: Product[];
  cartCountByProductId: Record<string, number>;
  onProductClick: (product: Product) => void;
  stockMap?: Map<string, number>;
  showStock?: boolean;
}

export function ProductGrid({
  products,
  cartCountByProductId,
  onProductClick,
  stockMap,
  showStock = false,
}: ProductGridProps) {
  const { t } = useTranslation();
  const parentRef = useRef<HTMLDivElement>(null);
  const columnCount = useColumnCount();
  const rowCount = Math.ceil(products.length / columnCount);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 2,
  });

  return (
    <div ref={parentRef} className="h-full overflow-y-auto">
      <div
        className="relative w-full p-6"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const rowStart = virtualRow.index * columnCount;
          const rowProducts = products.slice(
            rowStart,
            rowStart + columnCount,
          );

          return (
            <div
              key={virtualRow.key}
              className="absolute inset-x-0 grid gap-6 px-6"
              style={{
                top: `${virtualRow.start}px`,
                height: `${virtualRow.size}px`,
                gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
              }}
            >
              {rowProducts.map((product) => {
                const cartCount =
                  cartCountByProductId[String(product.id)] ?? 0;
                const isInCart = cartCount > 0;
                const totalStock =
                  showStock && stockMap
                    ? getProductTotalStock(stockMap, product)
                    : null;
                const outOfStock =
                  showStock && stockMap ? isOutOfStock(stockMap, product) : false;
                const lowStock =
                  showStock && stockMap ? isLowStock(stockMap, product) : false;

                return (
                  <button
                    key={product.id}
                    onClick={() => onProductClick(product)}
                    className={cn(
                      "pos-card relative flex flex-col items-start p-3 text-start transition-all duration-150 cursor-pointer group h-[13.5rem]",
                      outOfStock
                        ? "opacity-60 border-destructive/30"
                        : "hover:border-accent/40 hover:bg-accent/5 active:scale-[0.98]",
                      isInCart && "border-accent/30 bg-accent/5",
                    )}
                  >
                    {isInCart && (
                      <span className="absolute top-2 end-2 w-5 h-5 bg-accent text-accent-foreground text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                        {cartCount}
                      </span>
                    )}

                    {!isInCart && showStock && totalStock !== null && (
                      <span
                        className={cn(
                          "absolute top-2 end-2 px-1.5 py-0.5 rounded text-[9px] font-semibold tabular-nums",
                          outOfStock
                            ? "bg-destructive/15 text-destructive"
                            : lowStock
                              ? "bg-orange-500/15 text-orange-400"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {outOfStock
                          ? t("pos.outOfStock")
                          : t("pos.stock", { count: totalStock })}
                      </span>
                    )}

                    {product.image_path ? (
                      <ProductImage
                        imagePath={product.image_path}
                        alt={product.title}
                        className="w-full h-28 object-cover mb-2 rounded shrink-0"
                      />
                    ) : (
                      <Package className="w-8 h-8 text-muted-foreground/30 shrink-0" />
                    )}

                    <p className="text-xs font-medium text-foreground leading-tight line-clamp-2 mb-1 w-full">
                      {product.title}
                    </p>

                    {product.flavors && product.flavors.length > 0 && (
                      <p className="text-[10px] text-muted-foreground mb-1">
                        {product.flavors.length} {t("pos.flavors")}
                      </p>
                    )}

                    <p className="text-sm font-bold text-foreground tabular-nums mt-auto">
                      {formatJOD(product.price)}
                    </p>

                    <div className="absolute inset-0 rounded-[inherit] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="w-8 h-8 rounded-full bg-accent/90 flex items-center justify-center shadow-lg">
                        <Plus className="w-4 h-4 text-accent-foreground" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
