import type { Product, ProductFlavor } from "@/types/Global";

export function resolveRegularPrice(
  product: Product,
  flavor?: ProductFlavor | null,
): number {
  if (flavor && flavor.price > 0) {
    return flavor.price;
  }
  return product.price;
}

export function resolveWholesalePrice(
  product: Product,
  flavor?: ProductFlavor | null,
): number {
  if (flavor && flavor.wholesale_price > 0) {
    return flavor.wholesale_price;
  }
  return product.wholesale_price;
}

export function resolvePurchasePrice(
  product: Product,
  flavor?: ProductFlavor | null,
): number {
  if (flavor && flavor.purchase_price > 0) {
    return flavor.purchase_price;
  }
  return product.purchase_price;
}
