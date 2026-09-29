import { useCallback, useMemo, useState } from "react";

import { orderController } from "@/lib/controllers";
import { getAvailableStock } from "@/lib/inventoryStock";
import {
  applyWholesalePricing,
  calcCartSubtotal,
  calcCartTax,
  calcCartTotal,
  calcLineTotal,
  createVariantFromProduct,
} from "@/lib/posPricing";
import { calculateLineTaxAmount } from "@/lib/tax";
import { generateId } from "@/lib/utils";
import type { CartItem, Product, ProductFlavor, ProductVariant } from "@/types/Global";

type CheckoutInput = {
  customerId: number;
  amountPaid: number;
  cartItems: CartItem[];
  discountTotal: number;
  notes?: string | null;
};

type CheckoutResult =
  | {
      success: true;
      orderId: number;
      status: "confirmed" | "partially_paid" | "paid";
      debt: number;
      prepayment: number;
      creditUsed: number;
      amountPaid: number;
      total: number;
    }
  | { success: false; error: string };

function normalizeOrderItems(cartItems: CartItem[]) {
  return cartItems.map((item) => {
    const productId = item.variant.productId ?? Number(item.variant.id);
    if (!Number.isFinite(productId) || productId <= 0) {
      throw new Error("Cart item is missing a product id");
    }

    const lineTax = calculateLineTaxAmount(
      item.unitPrice,
      item.quantity,
      item.variant.sellTax,
    );

    return {
      product_id: productId,
      flavor_id: item.variant.flavorId ?? null,
      quantity: item.quantity,
      price: item.unitPrice,
      tax_amount: lineTax,
      deducted_qty: 0,
    };
  });
}

function withPricing(items: CartItem[]): CartItem[] {
  return applyWholesalePricing(items);
}

export function useOrder(
  stockMap: Map<string, number> | null = null,
  defaultTaxRate = 0.05,
) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = useMemo(() => calcCartSubtotal(cartItems), [cartItems]);
  const taxAmount = useMemo(() => calcCartTax(cartItems), [cartItems]);

  const cartCountByProductId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of cartItems) {
      const productKey = String(item.variant.productId ?? item.variant.id);
      map[productKey] = (map[productKey] ?? 0) + item.quantity;
    }
    return map;
  }, [cartItems]);

  const getCartQtyForVariant = useCallback(
    (variantId: string, excludeItemId?: string) =>
      cartItems
        .filter((item) => item.variant.id === variantId && item.id !== excludeItemId)
        .reduce((sum, item) => sum + item.quantity, 0),
    [cartItems],
  );

  const getRemainingStock = useCallback(
    (variant: ProductVariant, excludeItemId?: string) => {
      if (!stockMap || !variant.productId) {
        return Number.MAX_SAFE_INTEGER;
      }

      return getAvailableStock(
        stockMap,
        variant,
        getCartQtyForVariant(variant.id, excludeItemId),
      );
    },
    [stockMap, getCartQtyForVariant],
  );

  const addVariantToCart = useCallback(
    (variant: ProductVariant): boolean => {
      if (getRemainingStock(variant) <= 0) {
        return false;
      }

      setCartItems((prev) => {
        const existing = prev.find((item) => item.variant.id === variant.id);
        const next = existing
          ? prev.map((item) =>
              item.variant.id === variant.id
                ? {
                    ...item,
                    quantity: item.quantity + 1,
                    lineTotal: calcLineTotal({
                      ...item,
                      quantity: item.quantity + 1,
                    }),
                  }
                : item,
            )
          : [
              ...prev,
              {
                id: generateId(),
                variant,
                quantity: 1,
                unitPrice: variant.retailPrice,
                discountAmount: 0,
                lineTotal: variant.retailPrice,
                wholesaleApplied: false,
                priceOverridden: false,
              },
            ];

        return withPricing(next);
      });

      return true;
    },
    [getRemainingStock],
  );

  const addProductToCart = useCallback(
    (product: Product, flavor?: ProductFlavor | null, stockQty = 0): boolean => {
      return addVariantToCart(
        createVariantFromProduct(product, flavor, stockQty, defaultTaxRate),
      );
    },
    [addVariantToCart, defaultTaxRate],
  );

  const updateQty = useCallback(
    (itemId: string, delta: number): boolean => {
      const target = cartItems.find((item) => item.id === itemId);
      if (!target) return false;

      if (delta > 0 && getRemainingStock(target.variant, itemId) <= 0) {
        return false;
      }

      setCartItems((prev) => {
        const next = prev
          .map((item) => {
            if (item.id !== itemId) return item;
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            return {
              ...item,
              quantity: newQty,
              lineTotal: calcLineTotal({ ...item, quantity: newQty }),
            };
          })
          .filter(Boolean) as CartItem[];

        return withPricing(next);
      });

      return true;
    },
    [cartItems, getRemainingStock],
  );

  const updateUnitPrice = useCallback(
    (itemId: string, unitPrice: number, priceNote?: string) => {
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return;
      }

      setCartItems((prev) =>
        prev.map((item) => {
          if (item.id !== itemId) return item;
          const updated = {
            ...item,
            unitPrice: Number(unitPrice.toFixed(2)),
            priceOverridden: true,
            priceNote: priceNote?.trim() || undefined,
            wholesaleApplied: false,
          };
          return {
            ...updated,
            lineTotal: calcLineTotal(updated),
          };
        }),
      );
    },
    [],
  );

  const removeItem = useCallback((itemId: string) => {
    setCartItems((prev) => withPricing(prev.filter((item) => item.id !== itemId)));
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
    setError(null);
  }, []);

  const checkoutOrder = useCallback(
    async (input: CheckoutInput): Promise<CheckoutResult> => {
      setLoading(true);
      setError(null);

      try {
        if (!input.customerId) {
          throw new Error("Attach a customer before creating an order");
        }

        if (input.cartItems.length === 0) {
          throw new Error("Add at least one item before checkout");
        }

        if (!Number.isFinite(input.amountPaid) || input.amountPaid < 0) {
          throw new Error("Amount paid must be zero or greater");
        }

        const discountTotal = Math.max(0, Number(input.discountTotal.toFixed(2)));
        const { total } = calcCartTotal(input.cartItems, discountTotal);
        const items = normalizeOrderItems(input.cartItems);

        const checkoutResult = await orderController.checkout({
          customer_id: input.customerId,
          amount_paid: input.amountPaid,
          items,
          total_price: total,
          discount_total: discountTotal,
          notes: input.notes ?? null,
        });

        if (!checkoutResult.success || !checkoutResult.data) {
          const message = checkoutResult.error ?? "Failed to complete sale";
          throw new Error(message);
        }

        return {
          success: true,
          orderId: checkoutResult.data.id,
          status: checkoutResult.data.status,
          debt: checkoutResult.data.debt,
          prepayment: checkoutResult.data.prepayment ?? 0,
          creditUsed: checkoutResult.data.creditUsed ?? 0,
          amountPaid: checkoutResult.data.amount_paid,
          total: checkoutResult.data.total,
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not create order";
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    cartItems,
    subtotal,
    taxAmount,
    cartCountByProductId,
    addVariantToCart,
    addProductToCart,
    updateQty,
    updateUnitPrice,
    removeItem,
    clearCart,
    checkoutOrder,
    getRemainingStock,
    calcCartTotal: (discountTotal = 0) => calcCartTotal(cartItems, discountTotal),
    loading,
    error,
  };
}
