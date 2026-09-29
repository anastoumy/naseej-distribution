import { describe, expect, it } from "vitest";
import {
  calculateLineTotal,
  calculateOrderTotal,
  calculateTaxAmount,
} from "../src/renderer/src/features/orders/utils/orderCalculations";

describe("orderCalculations", () => {
  it("calculates tax from unit price, quantity, and sell tax rate", () => {
    expect(calculateTaxAmount(10, 2, 0.16)).toBe(3.2);
  });

  it("calculates line total with partial deductions", () => {
    const total = calculateLineTotal({
      quantity: 10,
      unit_price: 5,
      tax_amount: 2,
      deducted_qty: 4,
    });

    expect(total).toBe(31.2);
  });

  it("returns zero for empty or fully deducted lines", () => {
    expect(
      calculateLineTotal({
        quantity: 0,
        unit_price: 5,
        tax_amount: 1,
        deducted_qty: 0,
      }),
    ).toBe(0);

    expect(
      calculateLineTotal({
        quantity: 5,
        unit_price: 5,
        tax_amount: 1,
        deducted_qty: 5,
      }),
    ).toBe(0);
  });

  it("sums order total across lines", () => {
    const total = calculateOrderTotal([
      { quantity: 2, unit_price: 10, tax_amount: 0, deducted_qty: 0 },
      { quantity: 1, unit_price: 5, tax_amount: 0.5, deducted_qty: 0 },
    ]);

    expect(total).toBe(25.5);
  });
});
