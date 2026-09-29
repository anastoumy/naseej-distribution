import type { InventoryRow, Product, ProductVariant } from "@/types/Global";

export const LOW_STOCK_THRESHOLD = 5;

export function stockKey(productId: number, flavorId?: number | null): string {
  return `${productId}:${flavorId ?? "null"}`;
}

export function buildStockMap(rows: InventoryRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(stockKey(row.product_id, row.flavor_id), row.quantity);
  }
  return map;
}

export function getStock(
  stockMap: Map<string, number>,
  productId: number,
  flavorId?: number | null,
): number {
  return stockMap.get(stockKey(productId, flavorId)) ?? 0;
}

export function getProductTotalStock(
  stockMap: Map<string, number>,
  product: Product,
): number {
  if (product.flavors && product.flavors.length > 0) {
    return product.flavors.reduce(
      (sum, flavor) => sum + getStock(stockMap, product.id, flavor.id),
      0,
    );
  }

  return getStock(stockMap, product.id, null);
}

export function getAvailableStock(
  stockMap: Map<string, number>,
  variant: ProductVariant,
  cartQtyForVariant = 0,
): number {
  if (!variant.productId) {
    return Number.MAX_SAFE_INTEGER;
  }

  const total = getStock(stockMap, variant.productId, variant.flavorId);
  return Math.max(0, total - cartQtyForVariant);
}

export function isOutOfStock(
  stockMap: Map<string, number>,
  product: Product,
): boolean {
  return getProductTotalStock(stockMap, product) <= 0;
}

export function isLowStock(
  stockMap: Map<string, number>,
  product: Product,
): boolean {
  const total = getProductTotalStock(stockMap, product);
  return total > 0 && total <= LOW_STOCK_THRESHOLD;
}
