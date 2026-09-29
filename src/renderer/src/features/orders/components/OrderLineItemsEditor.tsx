import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import type { Product } from "@/types/Global";
import { productsController } from "@/features/products/controllers/productsController";
import { Input } from "@/components/ui/Input";
import { formatJOD } from "@/lib/utils";
import { resolveProductTaxRate } from "@/lib/tax";
import { resolveRegularPrice } from "@/lib/productPricing";
import {
  calculateLineTotal,
  calculateOrderTotal,
  calculateTaxAmount,
  type LineDraft,
} from "../utils/orderCalculations";

interface Props {
  lines: LineDraft[];
  onChange: (lines: LineDraft[]) => void;
  products: Product[];
  defaultTaxRate?: number;
  disabled?: boolean;
}

export function OrderLineItemsEditor({
  lines,
  onChange,
  products,
  defaultTaxRate = 0.05,
  disabled = false,
}: Props) {
  const { t } = useTranslation();
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedFlavorId, setSelectedFlavorId] = useState("");
  const [productFlavors, setProductFlavors] = useState<
    {
      id: number;
      name: string;
      price: number;
      wholesale_price: number;
      purchase_price: number;
    }[]
  >([]);
  const [loadingFlavors, setLoadingFlavors] = useState(false);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === Number(selectedProductId)),
    [products, selectedProductId],
  );

  const orderTotal = useMemo(() => calculateOrderTotal(lines), [lines]);

  const handleProductChange = async (productId: string) => {
    setSelectedProductId(productId);
    setSelectedFlavorId("");
    setProductFlavors([]);

    if (!productId) return;

    setLoadingFlavors(true);
    const res = await productsController.getById(Number(productId));
    setLoadingFlavors(false);

    if (res.success && res.data?.flavors) {
      setProductFlavors(res.data.flavors);
    }
  };

  const handleAddLine = () => {
    if (!selectedProduct) return;

    const flavorId = selectedFlavorId ? Number(selectedFlavorId) : null;
    const flavor = productFlavors.find((f) => f.id === flavorId);
    const unitPrice = flavor
      ? resolveRegularPrice(selectedProduct, flavor)
      : selectedProduct.price;
    const quantity = 1;
    const sellTax = resolveProductTaxRate(selectedProduct.taxable, defaultTaxRate);

    if (productFlavors.length > 0 && !flavorId) return;

    const newLine: LineDraft = {
      product_id: selectedProduct.id,
      product_title: selectedProduct.title,
      flavor_id: flavorId,
      flavor_name: flavor?.name ?? null,
      quantity,
      unit_price: unitPrice,
      tax_amount: calculateTaxAmount(unitPrice, quantity, sellTax),
      deducted_qty: 0,
      sell_tax: sellTax,
    };

    onChange([...lines, newLine]);
    setSelectedProductId("");
    setSelectedFlavorId("");
    setProductFlavors([]);
  };

  const updateLine = (index: number, patch: Partial<LineDraft>) => {
    onChange(
      lines.map((line, i) => {
        if (i !== index) return line;
        const next = { ...line, ...patch };
        if ("quantity" in patch || "unit_price" in patch) {
          next.tax_amount = calculateTaxAmount(
            next.unit_price,
            next.quantity,
            next.sell_tax,
          );
        }
        return next;
      }),
    );
  };

  const removeLine = (index: number) => {
    onChange(lines.filter((_, i) => i !== index));
  };

  const canAdd =
    !!selectedProduct &&
    !disabled &&
    (productFlavors.length === 0 || !!selectedFlavorId);

  return (
    <div className="flex flex-col gap-4">
      {!disabled && (
        <div className="rounded-lg border border-border bg-secondary/20 p-4 flex flex-col gap-3">
          <p className="text-sm font-medium text-foreground">
            {t("orders.addLineItem")}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="order-product"
                className="text-sm font-medium text-foreground"
              >
                {t("orders.product")}
              </label>
              <select
                id="order-product"
                value={selectedProductId}
                onChange={(e) => void handleProductChange(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                <option value="">{t("orders.selectProduct")}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            {selectedProductId && productFlavors.length > 0 && (
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="order-flavor"
                  className="text-sm font-medium text-foreground"
                >
                  {t("orders.flavor")}
                </label>
                <select
                  id="order-flavor"
                  value={selectedFlavorId}
                  onChange={(e) => setSelectedFlavorId(e.target.value)}
                  disabled={loadingFlavors}
                  className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50"
                >
                  <option value="">{t("orders.selectFlavor")}</option>
                  {productFlavors.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({formatJOD(f.price)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleAddLine}
                disabled={!canAdd}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm hover:bg-accent/90 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Plus size={16} />
                {t("orders.addItem")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        {lines.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
            {t("orders.noLineItems")}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                  {t("orders.product")}
                </th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                  {t("orders.flavor")}
                </th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                  {t("orders.quantity")}
                </th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                  {t("orders.unitPrice")}
                </th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                  {t("orders.tax")}
                </th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">
                  {t("orders.lineTotal")}
                </th>
                {!disabled && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr
                  key={`${line.product_id}-${line.flavor_id ?? "base"}-${index}`}
                  className="border-b border-border/50"
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    {line.product_title}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {line.flavor_name ?? t("inventory.noFlavor")}
                  </td>
                  <td className="px-4 py-3">
                    {disabled ? (
                      <span>{line.quantity}</span>
                    ) : (
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(index, {
                            quantity: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        className="w-20 px-2 py-1 rounded-md bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {disabled ? (
                      <span>{line.unit_price.toFixed(2)}</span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={line.unit_price}
                        onChange={(e) =>
                          updateLine(index, {
                            unit_price: Math.max(
                              0,
                              Number(e.target.value) || 0,
                            ),
                          })
                        }
                        className="w-24 px-2 py-1 rounded-md bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {line.tax_amount.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {calculateLineTotal(line).toFixed(2)}
                  </td>
                  {!disabled && (
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                        aria-label={t("common.remove")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex justify-end">
        <div className="px-4 py-3 rounded-lg bg-card border border-border min-w-[180px]">
          <p className="text-xs text-muted-foreground">{t("common.total")}</p>
          <p className="text-xl font-semibold text-foreground mt-0.5">
            {formatJOD(orderTotal)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function orderItemsToLineDrafts(
  items: Array<{
    product_id: number;
    product_title?: string | null;
    flavor_id: number | null;
    flavor_name?: string | null;
    quantity: number;
    unit_price: number;
    tax_amount: number;
    deducted_qty: number;
  }>,
  products: Product[],
  defaultTaxRate = 0.05,
): LineDraft[] {
  return items.map((item) => {
    const product = products.find((p) => p.id === item.product_id);
    return {
      product_id: item.product_id,
      product_title: item.product_title ?? product?.title ?? `#${item.product_id}`,
      flavor_id: item.flavor_id,
      flavor_name: item.flavor_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      tax_amount: item.tax_amount,
      deducted_qty: item.deducted_qty,
      sell_tax: resolveProductTaxRate(product?.taxable ?? true, defaultTaxRate),
    };
  });
}
