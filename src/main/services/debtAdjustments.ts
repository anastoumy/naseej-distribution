import type Database from "better-sqlite3";
import {
  syncCustomerCreditFromLedger,
  syncSupplierCreditFromLedger,
} from "./creditLedger";

function normalizeEffectiveDate(value?: string | null): string {
  if (value?.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return new Date().toISOString();
}

export function insertCustomerDebtAdjustment(
  db: Database.Database,
  customerId: number,
  amount: number,
  notes: string | null,
  effectiveDate?: string | null,
): number {
  if (amount === 0) return 0;

  const { lastInsertRowid } = db
    .prepare(
      `
        INSERT INTO customer_debt_adjustments (
          customer_id, amount, notes, effective_date
        ) VALUES (?, ?, ?, ?)
      `,
    )
    .run(customerId, amount, notes, normalizeEffectiveDate(effectiveDate));

  syncCustomerCreditFromLedger(db, customerId);
  return Number(lastInsertRowid);
}

export function insertSupplierDebtAdjustment(
  db: Database.Database,
  supplierId: number,
  amount: number,
  notes: string | null,
  effectiveDate?: string | null,
): number {
  if (amount === 0) return 0;

  const { lastInsertRowid } = db
    .prepare(
      `
        INSERT INTO supplier_debt_adjustments (
          supplier_id, amount, notes, effective_date
        ) VALUES (?, ?, ?, ?)
      `,
    )
    .run(supplierId, amount, notes, normalizeEffectiveDate(effectiveDate));

  syncSupplierCreditFromLedger(db, supplierId);
  return Number(lastInsertRowid);
}
