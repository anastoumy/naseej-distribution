import i18n from "./i18n";
import {
  resolveRegularPrice,
  resolveWholesalePrice,
} from "./productPricing";
import { resolveProductTaxRate } from "./tax";
import type { CartItem, Product, ProductFlavor, ProductVariant } from "@/types/Global";

export const WHOLESALE_THRESHOLD = 6;

const FLAVOR_COLORS = [
  "#0f766e",
  "#7c3aed",
  "#b45309",
  "#be123c",
  "#0369a1",
  "#4d7c0f",
];

export function resolveRetailPrice(
  product: Product,
  flavor?: ProductFlavor | null,
): number {
  return resolveRegularPrice(product, flavor);
}

export function createVariantFromProduct(
  product: Product,
  flavor?: ProductFlavor | null,
  stockQty = 0,
  defaultTaxRate = 0,
): ProductVariant {
  const retailPrice = resolveRetailPrice(product, flavor);
  const wholesalePrice = resolveWholesalePrice(product, flavor);
  const flavorIndex = flavor
    ? (product.flavors?.findIndex((entry) => entry.id === flavor.id) ?? 0)
    : 0;

  return {
    id: flavor ? `product-${product.id}-flavor-${flavor.id}` : `product-${product.id}`,
    productId: product.id,
    flavorId: flavor?.id ?? null,
    productName: flavor ? `${product.title} (${flavor.name})` : product.title,
    sku: flavor ? `PRD-${product.id}-F${flavor.id}` : `PRD-${product.id}`,
    price: retailPrice,
    retailPrice,
    wholesalePrice,
    sellTax: resolveProductTaxRate(product.taxable, defaultTaxRate),
    size: flavor?.name ?? product.category_title ?? i18n.t("pos.defaultSize"),
    color: flavor?.name ?? product.supplier_name ?? i18n.t("pos.defaultColor"),
    colorHex: FLAVOR_COLORS[Math.abs(flavorIndex) % FLAVOR_COLORS.length],
    stockQty,
    flavorName: flavor?.name ?? null,
  };
}

export function countCartQuantity(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function calcLineTotal(item: Pick<CartItem, "quantity" | "unitPrice" | "discountAmount">): number {
  return Number((item.quantity * item.unitPrice - item.discountAmount).toFixed(2));
}

export function applyWholesalePricing(items: CartItem[]): CartItem[] {
  const useWholesale = countCartQuantity(items) >= WHOLESALE_THRESHOLD;

  return items.map((item) => {
    if (item.priceOverridden) {
      return {
        ...item,
        wholesaleApplied: false,
        lineTotal: calcLineTotal(item),
      };
    }

    const unitPrice = useWholesale
      ? item.variant.wholesalePrice
      : item.variant.retailPrice;

    return {
      ...item,
      unitPrice,
      wholesaleApplied: useWholesale,
      lineTotal: calcLineTotal({ ...item, unitPrice }),
    };
  });
}

export function calcCartSubtotal(items: CartItem[]): number {
  return Number(
    items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toFixed(2),
  );
}

export function calcCartTax(items: CartItem[]): number {
  return Number(
    items
      .reduce(
        (sum, item) =>
          sum + item.unitPrice * item.quantity * item.variant.sellTax,
        0,
      )
      .toFixed(2),
  );
}

export function calcCartTotal(
  items: CartItem[],
  discountTotal = 0,
): { subtotal: number; taxAmount: number; total: number } {
  const subtotal = calcCartSubtotal(items);
  const taxAmount = calcCartTax(items);
  const total = Math.max(0, Number((subtotal + taxAmount - discountTotal).toFixed(2)));
  return { subtotal, taxAmount, total };
}
