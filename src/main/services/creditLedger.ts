import type Database from "better-sqlite3";

export type OrderPaymentType = "cash" | "credit";
export type OrderStatus =
  | "draft"
  | "confirmed"
  | "partially_paid"
  | "paid"
  | "cancelled";

const ACTIVE_ORDER_STATUSES = ["confirmed", "partially_paid", "paid"] as const;

export interface CheckoutCreditBreakdown {
  creditUsed: number;
  debt: number;
  prepayment: number;
  creditDelta: number;
}

export interface CheckoutState extends CheckoutCreditBreakdown {
  status: OrderStatus;
  payment_type: OrderPaymentType;
}

export interface CreditReconciliation {
  storedCredit: number;
  computedCredit: number;
  inSync: boolean;
  difference: number;
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

export function getOrderDebtAmount(order: {
  total: number;
  amount_paid?: number | null;
  credit_applied?: number | null;
}): number {
  const total = order.total ?? 0;
  const paid = order.amount_paid ?? 0;
  const creditApplied = order.credit_applied ?? 0;
  return Math.max(0, roundMoney(total - creditApplied - paid));
}

export function getOrderPrepaymentAmount(order: {
  total: number;
  amount_paid?: number | null;
  credit_applied?: number | null;
}): number {
  const total = order.total ?? 0;
  const paid = order.amount_paid ?? 0;
  const creditApplied = order.credit_applied ?? 0;
  const remainingAfterCredit = roundMoney(total - creditApplied);
  return Math.max(0, roundMoney(paid - remainingAfterCredit));
}

export function getOrderCheckoutCreditDelta(order: {
  total: number;
  amount_paid?: number | null;
  credit_applied?: number | null;
}): number {
  const creditApplied = order.credit_applied ?? 0;
  const prepayment = getOrderPrepaymentAmount(order);
  return roundMoney(creditApplied - prepayment);
}

export function getOrderDeliveryDebtDelta(order: {
  total: number;
  amount_paid?: number | null;
  credit_applied?: number | null;
}): number {
  return getOrderDebtAmount(order);
}

export function getOrderCreditDelta(order: {
  total: number;
  amount_paid?: number | null;
  credit_applied?: number | null;
}): number {
  return roundMoney(
    getOrderCheckoutCreditDelta(order) + getOrderDeliveryDebtDelta(order),
  );
}

/**
 * Resolves how checkout cash and stored prepayment affect customer credit.
 * Positive credit = customer owes; negative credit = prepayment on account.
 */
export function resolveCheckoutCredit(
  currentCredit: number,
  total: number,
  amountPaid: number,
): CheckoutCreditBreakdown {
  const paid = Math.max(0, amountPaid);
  const prepaymentAvailable = Math.max(0, roundMoney(-currentCredit));
  const creditUsed = Math.min(prepaymentAvailable, roundMoney(total));
  const remainingAfterCredit = roundMoney(total - creditUsed);
  const debt = Math.max(0, roundMoney(remainingAfterCredit - paid));
  const prepayment = Math.max(0, roundMoney(paid - remainingAfterCredit));
  const creditDelta = roundMoney(creditUsed + debt - prepayment);

  return { creditUsed, debt, prepayment, creditDelta };
}

export function resolveCheckoutState(
  currentCredit: number,
  total: number,
  amountPaid: number,
): CheckoutState {
  const breakdown = resolveCheckoutCredit(currentCredit, total, amountPaid);
  const { creditUsed, debt, prepayment } = breakdown;

  if (debt <= 0) {
    return {
      ...breakdown,
      status: "paid",
      payment_type: "cash",
      debt: 0,
    };
  }

  if (amountPaid <= 0 && creditUsed <= 0) {
    return {
      ...breakdown,
      status: "confirmed",
      payment_type: "credit",
      prepayment: 0,
    };
  }

  return {
    ...breakdown,
    status: "partially_paid",
    payment_type: "cash",
    prepayment: 0,
  };
}

export function computeCustomerCredit(
  db: Database.Database,
  customerId: number,
): number {
  const orders = db
    .prepare(
      `
        SELECT total, amount_paid, credit_applied, fulfillment_status
        FROM orders
        WHERE customer_id = ?
          AND status IN ('confirmed', 'partially_paid', 'paid')
      `,
    )
    .all(customerId) as {
    total: number;
    amount_paid: number | null;
    credit_applied: number | null;
    fulfillment_status: string;
  }[];

  const orderNet = roundMoney(
    orders.reduce((sum, order) => {
      const checkoutDelta = getOrderCheckoutCreditDelta(order);
      const deliveryDebt =
        order.fulfillment_status === "delivered"
          ? getOrderDeliveryDebtDelta(order)
          : 0;
      return sum + checkoutDelta + deliveryDebt;
    }, 0),
  );

  const collectionsRow = db
    .prepare(
      `
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM debt_collections
        WHERE customer_id = ?
      `,
    )
    .get(customerId) as { total: number };

  const adjustmentsRow = db
    .prepare(
      `
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM customer_debt_adjustments
        WHERE customer_id = ?
      `,
    )
    .get(customerId) as { total: number };

  return roundMoney(
    orderNet - collectionsRow.total + adjustmentsRow.total,
  );
}

export function computeSupplierCredit(
  db: Database.Database,
  supplierId: number,
): number {
  const purchaseRow = db
    .prepare(
      `
        SELECT COALESCE(SUM(pi.received_qty * pi.unit_cost), 0) AS total
        FROM purchases p
        JOIN purchase_items pi ON pi.purchase_id = p.id
        WHERE p.supplier_id = ?
          AND p.status != 'cancelled'
      `,
    )
    .get(supplierId) as { total: number };

  const repaymentsRow = db
    .prepare(
      `
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM debt_repayments
        WHERE supplier_id = ?
      `,
    )
    .get(supplierId) as { total: number };

  const adjustmentsRow = db
    .prepare(
      `
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM supplier_debt_adjustments
        WHERE supplier_id = ?
      `,
    )
    .get(supplierId) as { total: number };

  return roundMoney(
    purchaseRow.total - repaymentsRow.total + adjustmentsRow.total,
  );
}

export function reconcileCustomerCredit(
  db: Database.Database,
  customerId: number,
): CreditReconciliation {
  const row = db
    .prepare("SELECT credit FROM customers WHERE id = ?")
    .get(customerId) as { credit: number } | undefined;

  const storedCredit = row?.credit ?? 0;
  const computedCredit = computeCustomerCredit(db, customerId);
  const difference = roundMoney(storedCredit - computedCredit);

  return {
    storedCredit,
    computedCredit,
    difference,
    inSync: Math.abs(difference) < 0.01,
  };
}

export function reconcileSupplierCredit(
  db: Database.Database,
  supplierId: number,
): CreditReconciliation {
  const row = db
    .prepare("SELECT credit FROM suppliers WHERE id = ?")
    .get(supplierId) as { credit: number } | undefined;

  const storedCredit = row?.credit ?? 0;
  const computedCredit = computeSupplierCredit(db, supplierId);
  const difference = roundMoney(storedCredit - computedCredit);

  return {
    storedCredit,
    computedCredit,
    difference,
    inSync: Math.abs(difference) < 0.01,
  };
}

export function syncCustomerCreditFromLedger(
  db: Database.Database,
  customerId: number,
): CreditReconciliation {
  const reconciliation = reconcileCustomerCredit(db, customerId);
  db.prepare("UPDATE customers SET credit = ? WHERE id = ?").run(
    reconciliation.computedCredit,
    customerId,
  );
  return {
    ...reconciliation,
    storedCredit: reconciliation.computedCredit,
    difference: 0,
    inSync: true,
  };
}

export function syncSupplierCreditFromLedger(
  db: Database.Database,
  supplierId: number,
): CreditReconciliation {
  const reconciliation = reconcileSupplierCredit(db, supplierId);
  db.prepare("UPDATE suppliers SET credit = ? WHERE id = ?").run(
    reconciliation.computedCredit,
    supplierId,
  );
  return {
    ...reconciliation,
    storedCredit: reconciliation.computedCredit,
    difference: 0,
    inSync: true,
  };
}

export function applyCustomerCreditDelta(
  db: Database.Database,
  customerId: number,
  creditDelta: number,
): void {
  if (creditDelta === 0) return;
  db.prepare("UPDATE customers SET credit = credit + ? WHERE id = ?").run(
    creditDelta,
    customerId,
  );
}

export function reverseOrderCreditEffects(
  db: Database.Database,
  order: {
    customer_id: number;
    total: number;
    amount_paid?: number | null;
    credit_applied?: number | null;
  },
  fulfillmentStatus: string,
): void {
  const checkoutDelta = getOrderCheckoutCreditDelta(order);
  const deliveryDebt =
    fulfillmentStatus === "delivered" ? getOrderDeliveryDebtDelta(order) : 0;
  const creditDelta = roundMoney(checkoutDelta + deliveryDebt);
  if (creditDelta === 0) return;

  db.prepare("UPDATE customers SET credit = credit - ? WHERE id = ?").run(
    creditDelta,
    order.customer_id,
  );
}

export function applyOrderDeliveryDebt(
  db: Database.Database,
  order: {
    customer_id: number;
    total: number;
    amount_paid?: number | null;
    credit_applied?: number | null;
  },
): void {
  const debt = getOrderDeliveryDebtDelta(order);
  applyCustomerCreditDelta(db, order.customer_id, debt);
}

export { ACTIVE_ORDER_STATUSES };
