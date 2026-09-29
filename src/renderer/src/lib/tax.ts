/** Tax rates are stored as decimals (0.05 = 5%). */

export function resolveProductTaxRate(
  taxable: boolean,
  defaultTaxRate: number,
): number {
  return taxable ? defaultTaxRate : 0;
}

/** @deprecated Use resolveProductTaxRate with product.taxable */
export function resolveSellTaxRate(
  productSellTax: number,
  defaultTaxRate: number,
): number {
  return productSellTax > 0 ? productSellTax : defaultTaxRate;
}

export function taxRateToPercent(rate: number): number {
  return Number((rate * 100).toFixed(4));
}

export function percentToTaxRate(percent: number): number {
  if (!Number.isFinite(percent) || percent < 0) return 0;
  return Number((percent / 100).toFixed(6));
}

export function calculateLineTaxAmount(
  unitPrice: number,
  quantity: number,
  taxRate: number,
): number {
  return Number((unitPrice * quantity * taxRate).toFixed(2));
}
