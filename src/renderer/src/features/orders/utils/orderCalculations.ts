import type { OrderItem } from "@/types/Global";

export type LineDraft = {
  product_id: number;
  product_title: string;
  flavor_id: number | null;
  flavor_name?: string | null;
  quantity: number;
  unit_price: number;
  tax_amount: number;
  deducted_qty: number;
  sell_tax: number;
};

export function calculateTaxAmount(
  unitPrice: number,
  quantity: number,
  sellTax: number,
): number {
  return Number((unitPrice * quantity * sellTax).toFixed(2));
}

export function calculateLineTotal(
  line: Pick<
    LineDraft | OrderItem,
    "quantity" | "unit_price" | "tax_amount" | "deducted_qty"
  >,
): number {
  const effectiveQty = Math.max(0, line.quantity - line.deducted_qty);
  if (line.quantity <= 0) return 0;

  const taxRatio = effectiveQty / line.quantity;
  return Number(
    (effectiveQty * line.unit_price + line.tax_amount * taxRatio).toFixed(2),
  );
}

export function calculateOrderTotal(
  lines: Array<
    Pick<
      LineDraft | OrderItem,
      "quantity" | "unit_price" | "tax_amount" | "deducted_qty"
    >
  >,
): number {
  return Number(
    lines.reduce((sum, line) => sum + calculateLineTotal(line), 0).toFixed(2),
  );
}

export function toOrderItemInput(line: LineDraft) {
  return {
    product_id: line.product_id,
    flavor_id: line.flavor_id,
    quantity: line.quantity,
    price: line.unit_price,
    tax_amount: line.tax_amount,
    deducted_qty: line.deducted_qty,
  };
}
