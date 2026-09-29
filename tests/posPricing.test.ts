import { describe, expect, it } from "vitest";

import {
  WHOLESALE_THRESHOLD,
  applyWholesalePricing,
  calcCartTotal,
  createVariantFromProduct,
  resolveRetailPrice,
} from "../src/renderer/src/lib/posPricing";
import type { CartItem, Product } from "../src/renderer/src/types/Global";

const baseProduct: Product = {
  id: 1,
  title: "Chips",
  category_id: 1,
  supplier_id: 1,
  price: 2,
  wholesale_price: 1.5,
  purchase_price: 1.2,
  taxable: true,
  image_path: null,
  created_at: "",
  flavors: [
    {
      id: 10,
      name: "BBQ",
      price: 2.5,
      wholesale_price: 1.8,
      purchase_price: 1.4,
    },
  ],
};

function makeCartItem(quantity: number, overrides: Partial<CartItem> = {}): CartItem {
  const variant = createVariantFromProduct(baseProduct, null, 0, 0.05);
  return {
    id: "line-1",
    variant,
    quantity,
    unitPrice: variant.retailPrice,
    discountAmount: 0,
    lineTotal: quantity * variant.retailPrice,
    ...overrides,
  };
}

describe("posPricing", () => {
  it("uses flavor price when set", () => {
    expect(resolveRetailPrice(baseProduct, baseProduct.flavors![0])).toBe(2.5);
    expect(resolveRetailPrice(baseProduct)).toBe(2);
  });

  it("applies wholesale when total cart quantity reaches threshold", () => {
    const items = applyWholesalePricing([makeCartItem(WHOLESALE_THRESHOLD)]);
    expect(items[0].unitPrice).toBe(1.5);
    expect(items[0].wholesaleApplied).toBe(true);
  });

  it("applies wholesale across mixed products when cart total reaches threshold", () => {
    const variantA = createVariantFromProduct(baseProduct, null, 0, 0.05);
    const productB: Product = {
      ...baseProduct,
      id: 2,
      title: "Soda",
      price: 3,
      wholesale_price: 2.2,
    };
    const variantB = createVariantFromProduct(productB, null, 0, 0.05);

    const items = applyWholesalePricing([
      {
        ...makeCartItem(3),
        id: "line-a",
        variant: variantA,
        unitPrice: variantA.retailPrice,
        lineTotal: 3 * variantA.retailPrice,
      },
      {
        ...makeCartItem(3),
        id: "line-b",
        variant: variantB,
        unitPrice: variantB.retailPrice,
        lineTotal: 3 * variantB.retailPrice,
      },
    ]);

    expect(items[0].unitPrice).toBe(1.5);
    expect(items[1].unitPrice).toBe(2.2);
    expect(items.every((item) => item.wholesaleApplied)).toBe(true);
  });

  it("keeps retail price below wholesale threshold", () => {
    const items = applyWholesalePricing([makeCartItem(WHOLESALE_THRESHOLD - 1)]);
    expect(items[0].unitPrice).toBe(2);
    expect(items[0].wholesaleApplied).toBe(false);
  });

  it("does not override manually edited prices", () => {
    const items = applyWholesalePricing([
      makeCartItem(WHOLESALE_THRESHOLD, {
        priceOverridden: true,
        unitPrice: 1.75,
      }),
    ]);
    expect(items[0].unitPrice).toBe(1.75);
    expect(items[0].wholesaleApplied).toBe(false);
  });

  it("uses default tax when product is taxable", () => {
    const variant = createVariantFromProduct(baseProduct, null, 0, 0.05);
    expect(variant.sellTax).toBe(0.05);
  });

  it("uses no tax when product is not taxable", () => {
    const variant = createVariantFromProduct(
      { ...baseProduct, taxable: false },
      null,
      0,
      0.05,
    );
    expect(variant.sellTax).toBe(0);
  });

  it("calculates cart total with tax and discount", () => {
    const item = makeCartItem(2);
    const { subtotal, taxAmount, total } = calcCartTotal([item], 0.5);
    expect(subtotal).toBe(4);
    expect(taxAmount).toBe(0.2);
    expect(total).toBe(3.7);
  });
});
