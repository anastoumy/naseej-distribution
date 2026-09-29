import { describe, expect, it } from "vitest";
import {
  calculateLineTaxAmount,
  percentToTaxRate,
  resolveProductTaxRate,
  taxRateToPercent,
} from "../src/renderer/src/lib/tax";

describe("tax", () => {
  it("applies default tax when product is taxable", () => {
    expect(resolveProductTaxRate(true, 0.05)).toBe(0.05);
  });

  it("skips tax when product is not taxable", () => {
    expect(resolveProductTaxRate(false, 0.05)).toBe(0);
  });

  it("converts between percent and decimal rate", () => {
    expect(taxRateToPercent(0.05)).toBe(5);
    expect(percentToTaxRate(5)).toBe(0.05);
  });

  it("calculates line tax from unit price, quantity, and rate", () => {
    expect(calculateLineTaxAmount(10, 2, 0.05)).toBe(1);
  });
});
