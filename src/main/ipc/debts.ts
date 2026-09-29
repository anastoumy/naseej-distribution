import { getDb } from "../db/database";
import {
  computeCustomerCredit,
  computeSupplierCredit,
  reconcileCustomerCredit,
  reconcileSupplierCredit,
  syncCustomerCreditFromLedger,
  syncSupplierCreditFromLedger,
} from "../services/creditLedger";
import {
  insertCustomerDebtAdjustment,
  insertSupplierDebtAdjustment,
} from "../services/debtAdjustments";
import { registerIpcHandler } from "./handler";
import {
  debtAdjustmentCreateSchema,
  debtAdjustmentUpdateSchema,
  debtCollectionCreateSchema,
  debtRepaymentCreateSchema,
  positiveId,
} from "./validation";

interface DebtCollectionRow {
  id: number;
  customer_id: number;
  customer_name: string;
  amount: number;
  notes: string | null;
  order_id: number | null;
  created_at: string;
}

interface DebtRepaymentRow {
  id: number;
  supplier_id: number;
  supplier_name: string;
  amount: number;
  notes: string | null;
  created_at: string;
}

interface DebtLedgerEntry {
  entry_type:
    | "order"
    | "collection"
    | "purchase"
    | "repayment"
    | "prepayment"
    | "prepayment_applied"
    | "opening_balance";
  reference_id: number;
  amount: number;
  description: string;
  created_at: string;
}

interface DebtAdjustmentRow {
  id: number;
  amount: number;
  notes: string | null;
  effective_date: string;
  created_at: string;
}

interface OutstandingDebtRow {
  id: number;
  name: string;
  phone: string | null;
  credit: number;
}

interface CreditReconciliationPayload {
  stored_credit: number;
  computed_credit: number;
  in_sync: boolean;
  difference: number;
}

function getCustomerCredit(customerId: number): number {
  const row = getDb()
    .prepare("SELECT credit FROM customers WHERE id = ?")
    .get(customerId) as { credit: number } | undefined;
  return row?.credit ?? 0;
}

function getSupplierCredit(supplierId: number): number {
  const row = getDb()
    .prepare("SELECT credit FROM suppliers WHERE id = ?")
    .get(supplierId) as { credit: number } | undefined;
  return row?.credit ?? 0;
}

function getOrderUnpaidBalance(orderId: number): number | null {
  const row = getDb()
    .prepare(
      `
        SELECT total, amount_paid, credit_applied, status, fulfillment_status
        FROM orders
        WHERE id = ?
      `,
    )
    .get(orderId) as
    | {
        total: number;
        amount_paid: number | null;
        credit_applied: number | null;
        status: string;
        fulfillment_status: string;
      }
    | undefined;

  if (
    !row ||
    row.status === "cancelled" ||
    row.status === "draft" ||
    row.fulfillment_status !== "delivered"
  ) {
    return null;
  }

  return Math.max(
    0,
    Number(
      (
        row.total -
        (row.credit_applied ?? 0) -
        (row.amount_paid ?? 0)
      ).toFixed(2),
    ),
  );
}

function toReconciliationPayload(
  reconciliation: ReturnType<typeof reconcileCustomerCredit>,
): CreditReconciliationPayload {
  return {
    stored_credit: reconciliation.storedCredit,
    computed_credit: reconciliation.computedCredit,
    in_sync: reconciliation.inSync,
    difference: reconciliation.difference,
  };
}

function normalizeEffectiveDate(value?: string | null): string {
  if (value?.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return new Date().toISOString();
}

function loadCustomerLedger(customerId: number): DebtLedgerEntry[] {
  const rows = getDb()
    .prepare(
      `
        SELECT entry_type, reference_id, amount, description, created_at
        FROM (
          SELECT
            'order' AS entry_type,
            o.id AS reference_id,
            CASE
              WHEN (o.total - COALESCE(o.credit_applied, 0) - COALESCE(o.amount_paid, 0)) > 0
                THEN (o.total - COALESCE(o.credit_applied, 0) - COALESCE(o.amount_paid, 0))
              ELSE 0
            END AS amount,
            'Credit order #' || o.id AS description,
            o.created_at AS created_at
          FROM orders o
          WHERE o.customer_id = ?
            AND o.fulfillment_status = 'delivered'
            AND o.status IN ('confirmed', 'partially_paid', 'paid')

          UNION ALL

          SELECT
            'prepayment_applied' AS entry_type,
            o.id AS reference_id,
            -COALESCE(o.credit_applied, 0) AS amount,
            'Prepayment applied to order #' || o.id AS description,
            o.created_at AS created_at
          FROM orders o
          WHERE o.customer_id = ?
            AND COALESCE(o.credit_applied, 0) > 0
            AND o.status IN ('confirmed', 'partially_paid', 'paid')

          UNION ALL

          SELECT
            'prepayment' AS entry_type,
            o.id AS reference_id,
            -(
              COALESCE(o.amount_paid, 0) - CASE
                WHEN (o.total - COALESCE(o.credit_applied, 0)) > 0
                  THEN (o.total - COALESCE(o.credit_applied, 0))
                ELSE 0
              END
            ) AS amount,
            'Prepayment on order #' || o.id AS description,
            o.created_at AS created_at
          FROM orders o
          WHERE o.customer_id = ?
            AND COALESCE(o.amount_paid, 0) > CASE
              WHEN (o.total - COALESCE(o.credit_applied, 0)) > 0
                THEN (o.total - COALESCE(o.credit_applied, 0))
              ELSE 0
            END
            AND o.status IN ('confirmed', 'partially_paid', 'paid')

          UNION ALL

          SELECT
            'collection' AS entry_type,
            dc.id AS reference_id,
            -dc.amount AS amount,
            CASE
              WHEN dc.order_id IS NOT NULL
                THEN COALESCE(dc.notes, 'Payment for order #' || dc.order_id)
              ELSE COALESCE(dc.notes, 'Payment collected')
            END AS description,
            dc.created_at AS created_at
          FROM debt_collections dc
          WHERE dc.customer_id = ?

          UNION ALL

          SELECT
            'opening_balance' AS entry_type,
            cda.id AS reference_id,
            cda.amount AS amount,
            COALESCE(cda.notes, 'Opening balance') AS description,
            cda.effective_date AS created_at
          FROM customer_debt_adjustments cda
          WHERE cda.customer_id = ?
        )
        WHERE amount != 0
        ORDER BY created_at DESC, reference_id DESC
      `,
    )
    .all(customerId, customerId, customerId, customerId, customerId) as DebtLedgerEntry[];

  return rows;
}

function loadSupplierLedger(supplierId: number): DebtLedgerEntry[] {
  const rows = getDb()
    .prepare(
      `
        SELECT entry_type, reference_id, amount, description, created_at
        FROM (
          SELECT
            'purchase' AS entry_type,
            p.id AS reference_id,
            (
              SELECT COALESCE(SUM(pi.received_qty * pi.unit_cost), 0)
              FROM purchase_items pi
              WHERE pi.purchase_id = p.id
            ) AS amount,
            'Purchase #' || p.id || ' received' AS description,
            p.created_at AS created_at
          FROM purchases p
          WHERE p.supplier_id = ?
            AND p.status != 'cancelled'
            AND (
              SELECT COALESCE(SUM(pi.received_qty * pi.unit_cost), 0)
              FROM purchase_items pi
              WHERE pi.purchase_id = p.id
            ) > 0

          UNION ALL

          SELECT
            'repayment' AS entry_type,
            dr.id AS reference_id,
            -dr.amount AS amount,
            COALESCE(dr.notes, 'Repayment made') AS description,
            dr.created_at AS created_at
          FROM debt_repayments dr
          WHERE dr.supplier_id = ?

          UNION ALL

          SELECT
            'opening_balance' AS entry_type,
            sda.id AS reference_id,
            sda.amount AS amount,
            COALESCE(sda.notes, 'Opening balance') AS description,
            sda.effective_date AS created_at
          FROM supplier_debt_adjustments sda
          WHERE sda.supplier_id = ?
        )
        ORDER BY created_at DESC, reference_id DESC
      `,
    )
    .all(supplierId, supplierId, supplierId) as DebtLedgerEntry[];

  return rows;
}

export function registerDebtHandlers(): void {
  registerIpcHandler("debtCollections:getAll", "void", () => {
    const rows = getDb()
      .prepare(
        `SELECT dc.id,
                  dc.customer_id,
                  c.name AS customer_name,
                  dc.amount,
                  dc.notes,
                  dc.order_id,
                  dc.created_at
             FROM debt_collections dc
             JOIN customers c ON c.id = dc.customer_id
         ORDER BY dc.created_at DESC, dc.id DESC`,
      )
      .all() as DebtCollectionRow[];
    return { success: true, data: rows };
  });

  registerIpcHandler("debtCollections:getById", positiveId, (id) => {
    const row = getDb()
      .prepare(
        `SELECT dc.id,
                  dc.customer_id,
                  c.name AS customer_name,
                  dc.amount,
                  dc.notes,
                  dc.order_id,
                  dc.created_at
             FROM debt_collections dc
             JOIN customers c ON c.id = dc.customer_id
            WHERE dc.id = ?`,
      )
      .get(id) as DebtCollectionRow | undefined;
    if (!row) return { success: false, error: "Debt collection not found" };
    return { success: true, data: row };
  });

  registerIpcHandler("debtCollections:create", debtCollectionCreateSchema, (data) => {
    const currentCredit = getCustomerCredit(data.customer_id);
    if (currentCredit <= 0) {
      return {
        success: false,
        error:
          currentCredit < 0
            ? "Customer has prepayment credit — no debt to collect"
            : "Customer has no outstanding debt",
      };
    }

    let maxAmount = currentCredit;
    if (data.order_id) {
      const orderBalance = getOrderUnpaidBalance(data.order_id);
      if (orderBalance == null) {
        return { success: false, error: "Order not found or not collectible" };
      }
      maxAmount = Math.min(maxAmount, orderBalance);
    }

    if (data.amount > maxAmount) {
      return {
        success: false,
        error: `Amount cannot exceed outstanding balance (${maxAmount.toFixed(2)})`,
      };
    }

    const db = getDb();
    const result = db.transaction(() => {
      const { lastInsertRowid } = db
        .prepare(
          "INSERT INTO debt_collections (customer_id, amount, notes, order_id) VALUES (?, ?, ?, ?)",
        )
        .run(
          data.customer_id,
          data.amount,
          data.notes ?? null,
          data.order_id ?? null,
        );

      db.prepare("UPDATE customers SET credit = credit - ? WHERE id = ?").run(
        data.amount,
        data.customer_id,
      );

      if (data.order_id) {
        db.prepare(
          "UPDATE orders SET amount_paid = amount_paid + ? WHERE id = ?",
        ).run(data.amount, data.order_id);

        const order = db
          .prepare(
            "SELECT total, amount_paid, credit_applied FROM orders WHERE id = ?",
          )
          .get(data.order_id) as {
          total: number;
          amount_paid: number;
          credit_applied: number;
        };

        const remaining = Math.max(
          0,
          Number(
            (
              order.total -
              (order.credit_applied ?? 0) -
              (order.amount_paid ?? 0)
            ).toFixed(2),
          ),
        );

        if (remaining <= 0) {
          db.prepare(
            "UPDATE orders SET status = 'paid', payment_type = 'cash' WHERE id = ?",
          ).run(data.order_id);
        } else if ((order.amount_paid ?? 0) > 0) {
          db.prepare(
            "UPDATE orders SET status = 'partially_paid', payment_type = 'cash' WHERE id = ?",
          ).run(data.order_id);
        }
      }

      return lastInsertRowid;
    })();

    return { success: true, data: { id: Number(result) } };
  });

  registerIpcHandler("debtCollections:delete", positiveId, (id) => {
    const db = getDb();
    const row = db
      .prepare(
        "SELECT customer_id, amount, order_id FROM debt_collections WHERE id = ?",
      )
      .get(id) as
      | { customer_id: number; amount: number; order_id: number | null }
      | undefined;
    if (!row) return { success: false, error: "Debt collection not found" };

    db.transaction(() => {
      if (row.order_id) {
        db.prepare(
          "UPDATE orders SET amount_paid = MAX(0, amount_paid - ?) WHERE id = ?",
        ).run(row.amount, row.order_id);
      }

      db.prepare("DELETE FROM debt_collections WHERE id = ?").run(id);
      db.prepare("UPDATE customers SET credit = credit + ? WHERE id = ?").run(
        row.amount,
        row.customer_id,
      );
    })();

    return { success: true };
  });

  registerIpcHandler("debtCollections:getCustomerLedger", positiveId, (customerId) => {
    const customer = getDb()
      .prepare("SELECT id, name, credit FROM customers WHERE id = ?")
      .get(customerId) as
      | { id: number; name: string; credit: number }
      | undefined;

    if (!customer) {
      return { success: false, error: "Customer not found" };
    }

    const reconciliation = reconcileCustomerCredit(getDb(), customerId);

    return {
      success: true,
      data: {
        id: customer.id,
        name: customer.name,
        credit: customer.credit,
        reconciliation: toReconciliationPayload(reconciliation),
        ledger: loadCustomerLedger(customerId),
      },
    };
  });

  registerIpcHandler("debtCollections:reconcileCustomer", positiveId, (customerId) => {
    const db = getDb();
    const customer = db
      .prepare("SELECT id FROM customers WHERE id = ?")
      .get(customerId) as { id: number } | undefined;

    if (!customer) {
      return { success: false, error: "Customer not found" };
    }

    const reconciliation = db.transaction(() =>
      syncCustomerCreditFromLedger(db, customerId),
    )();

    return {
      success: true,
      data: toReconciliationPayload(reconciliation),
    };
  });

  registerIpcHandler("debtCollections:getOutstanding", "void", () => {
    const rows = getDb()
      .prepare(
        `
            SELECT id, name, phone, credit
            FROM customers
            WHERE credit > 0
            ORDER BY credit DESC, name ASC
          `,
      )
      .all() as OutstandingDebtRow[];

    return { success: true, data: rows };
  });

  registerIpcHandler("debtCollections:getPrepaymentAccounts", "void", () => {
    const rows = getDb()
      .prepare(
        `
            SELECT id, name, phone, credit
            FROM customers
            WHERE credit < 0
            ORDER BY credit ASC, name ASC
          `,
      )
      .all() as OutstandingDebtRow[];

    return { success: true, data: rows };
  });

  registerIpcHandler("debtRepayments:getAll", "void", () => {
    const rows = getDb()
      .prepare(
        `SELECT dr.id,
                  dr.supplier_id,
                  s.name AS supplier_name,
                  dr.amount,
                  dr.notes,
                  dr.created_at
             FROM debt_repayments dr
             JOIN suppliers s ON s.id = dr.supplier_id
         ORDER BY dr.created_at DESC, dr.id DESC`,
      )
      .all() as DebtRepaymentRow[];
    return { success: true, data: rows };
  });

  registerIpcHandler("debtRepayments:getById", positiveId, (id) => {
    const row = getDb()
      .prepare(
        `SELECT dr.id,
                  dr.supplier_id,
                  s.name AS supplier_name,
                  dr.amount,
                  dr.notes,
                  dr.created_at
             FROM debt_repayments dr
             JOIN suppliers s ON s.id = dr.supplier_id
            WHERE dr.id = ?`,
      )
      .get(id) as DebtRepaymentRow | undefined;
    if (!row) return { success: false, error: "Debt repayment not found" };
    return { success: true, data: row };
  });

  registerIpcHandler("debtRepayments:create", debtRepaymentCreateSchema, (data) => {
    const currentCredit = getSupplierCredit(data.supplier_id);
    if (currentCredit <= 0) {
      return { success: false, error: "Supplier has no outstanding debt" };
    }

    if (data.amount > currentCredit) {
      return {
        success: false,
        error: `Amount cannot exceed outstanding balance (${currentCredit.toFixed(2)})`,
      };
    }

    const db = getDb();
    const result = db.transaction(() => {
      const { lastInsertRowid } = db
        .prepare("INSERT INTO debt_repayments (supplier_id, amount, notes) VALUES (?, ?, ?)")
        .run(data.supplier_id, data.amount, data.notes ?? null);

      db.prepare("UPDATE suppliers SET credit = credit - ? WHERE id = ?").run(
        data.amount,
        data.supplier_id,
      );

      return lastInsertRowid;
    })();

    return { success: true, data: { id: Number(result) } };
  });

  registerIpcHandler("debtRepayments:delete", positiveId, (id) => {
    const db = getDb();
    const row = db
      .prepare("SELECT supplier_id, amount FROM debt_repayments WHERE id = ?")
      .get(id) as { supplier_id: number; amount: number } | undefined;
    if (!row) return { success: false, error: "Debt repayment not found" };

    db.transaction(() => {
      db.prepare("DELETE FROM debt_repayments WHERE id = ?").run(id);
      db.prepare("UPDATE suppliers SET credit = credit + ? WHERE id = ?").run(
        row.amount,
        row.supplier_id,
      );
    })();

    return { success: true };
  });

  registerIpcHandler("debtRepayments:getSupplierLedger", positiveId, (supplierId) => {
    const supplier = getDb()
      .prepare("SELECT id, name, credit FROM suppliers WHERE id = ?")
      .get(supplierId) as
      | { id: number; name: string; credit: number }
      | undefined;

    if (!supplier) {
      return { success: false, error: "Supplier not found" };
    }

    const reconciliation = reconcileSupplierCredit(getDb(), supplierId);

    return {
      success: true,
      data: {
        id: supplier.id,
        name: supplier.name,
        credit: supplier.credit,
        reconciliation: toReconciliationPayload(reconciliation),
        ledger: loadSupplierLedger(supplierId),
      },
    };
  });

  registerIpcHandler("debtRepayments:reconcileSupplier", positiveId, (supplierId) => {
    const db = getDb();
    const supplier = db
      .prepare("SELECT id FROM suppliers WHERE id = ?")
      .get(supplierId) as { id: number } | undefined;

    if (!supplier) {
      return { success: false, error: "Supplier not found" };
    }

    const reconciliation = db.transaction(() =>
      syncSupplierCreditFromLedger(db, supplierId),
    )();

    return {
      success: true,
      data: toReconciliationPayload(reconciliation),
    };
  });

  registerIpcHandler("debtRepayments:getOutstanding", "void", () => {
    const rows = getDb()
      .prepare(
        `
            SELECT id, name, phone, credit
            FROM suppliers
            WHERE credit > 0
            ORDER BY credit DESC, name ASC
          `,
      )
      .all() as OutstandingDebtRow[];

    return { success: true, data: rows };
  });

  registerIpcHandler("debtCollections:verifyAllCustomers", "void", () => {
    const db = getDb();
    const customers = db
      .prepare("SELECT id, name, credit FROM customers")
      .all() as { id: number; name: string; credit: number }[];

    const mismatches = customers
      .map((customer) => {
        const computed = computeCustomerCredit(db, customer.id);
        const difference = Number((customer.credit - computed).toFixed(2));
        return {
          id: customer.id,
          name: customer.name,
          stored_credit: customer.credit,
          computed_credit: computed,
          difference,
          in_sync: Math.abs(difference) < 0.01,
        };
      })
      .filter((row) => !row.in_sync);

    return { success: true, data: mismatches };
  });

  registerIpcHandler("debtRepayments:verifyAllSuppliers", "void", () => {
    const db = getDb();
    const suppliers = db
      .prepare("SELECT id, name, credit FROM suppliers")
      .all() as { id: number; name: string; credit: number }[];

    const mismatches = suppliers
      .map((supplier) => {
        const computed = computeSupplierCredit(db, supplier.id);
        const difference = Number((supplier.credit - computed).toFixed(2));
        return {
          id: supplier.id,
          name: supplier.name,
          stored_credit: supplier.credit,
          computed_credit: computed,
          difference,
          in_sync: Math.abs(difference) < 0.01,
        };
      })
      .filter((row) => !row.in_sync);

    return { success: true, data: mismatches };
  });

  registerIpcHandler(
    "customerDebtAdjustments:getByCustomer",
    positiveId,
    (customerId) => {
      const customer = getDb()
        .prepare("SELECT id FROM customers WHERE id = ?")
        .get(customerId) as { id: number } | undefined;
      if (!customer) {
        return { success: false, error: "Customer not found" };
      }

      const rows = getDb()
        .prepare(
          `
            SELECT id, amount, notes, effective_date, created_at
            FROM customer_debt_adjustments
            WHERE customer_id = ?
            ORDER BY effective_date DESC, id DESC
          `,
        )
        .all(customerId) as DebtAdjustmentRow[];

      return { success: true, data: rows };
    },
  );

  registerIpcHandler(
    "customerDebtAdjustments:create",
    debtAdjustmentCreateSchema,
    (data) => {
      const customer = getDb()
        .prepare("SELECT id FROM customers WHERE id = ?")
        .get(data.account_id) as { id: number } | undefined;
      if (!customer) {
        return { success: false, error: "Customer not found" };
      }

      const db = getDb();
      const id = db.transaction(() =>
        insertCustomerDebtAdjustment(
          db,
          data.account_id,
          data.amount,
          data.notes ?? "Opening balance",
          data.effective_date,
        ),
      )();

      return { success: true, data: { id } };
    },
  );

  registerIpcHandler(
    "customerDebtAdjustments:update",
    debtAdjustmentUpdateSchema,
    (data) => {
      const db = getDb();
      const row = db
        .prepare(
          "SELECT customer_id FROM customer_debt_adjustments WHERE id = ?",
        )
        .get(data.id) as { customer_id: number } | undefined;
      if (!row) {
        return { success: false, error: "Debt adjustment not found" };
      }

      db.transaction(() => {
        db.prepare(
          `
            UPDATE customer_debt_adjustments
            SET amount = ?, notes = ?, effective_date = ?
            WHERE id = ?
          `,
        ).run(
          data.amount,
          data.notes ?? null,
          normalizeEffectiveDate(data.effective_date),
          data.id,
        );
        syncCustomerCreditFromLedger(db, row.customer_id);
      })();

      return { success: true };
    },
  );

  registerIpcHandler("customerDebtAdjustments:delete", positiveId, (id) => {
    const db = getDb();
    const row = db
      .prepare("SELECT customer_id FROM customer_debt_adjustments WHERE id = ?")
      .get(id) as { customer_id: number } | undefined;
    if (!row) {
      return { success: false, error: "Debt adjustment not found" };
    }

    db.transaction(() => {
      db.prepare("DELETE FROM customer_debt_adjustments WHERE id = ?").run(id);
      syncCustomerCreditFromLedger(db, row.customer_id);
    })();

    return { success: true };
  });

  registerIpcHandler(
    "supplierDebtAdjustments:getBySupplier",
    positiveId,
    (supplierId) => {
      const supplier = getDb()
        .prepare("SELECT id FROM suppliers WHERE id = ?")
        .get(supplierId) as { id: number } | undefined;
      if (!supplier) {
        return { success: false, error: "Supplier not found" };
      }

      const rows = getDb()
        .prepare(
          `
            SELECT id, amount, notes, effective_date, created_at
            FROM supplier_debt_adjustments
            WHERE supplier_id = ?
            ORDER BY effective_date DESC, id DESC
          `,
        )
        .all(supplierId) as DebtAdjustmentRow[];

      return { success: true, data: rows };
    },
  );

  registerIpcHandler(
    "supplierDebtAdjustments:create",
    debtAdjustmentCreateSchema,
    (data) => {
      const supplier = getDb()
        .prepare("SELECT id FROM suppliers WHERE id = ?")
        .get(data.account_id) as { id: number } | undefined;
      if (!supplier) {
        return { success: false, error: "Supplier not found" };
      }

      const db = getDb();
      const id = db.transaction(() =>
        insertSupplierDebtAdjustment(
          db,
          data.account_id,
          data.amount,
          data.notes ?? "Opening balance",
          data.effective_date,
        ),
      )();

      return { success: true, data: { id } };
    },
  );

  registerIpcHandler(
    "supplierDebtAdjustments:update",
    debtAdjustmentUpdateSchema,
    (data) => {
      const db = getDb();
      const row = db
        .prepare(
          "SELECT supplier_id FROM supplier_debt_adjustments WHERE id = ?",
        )
        .get(data.id) as { supplier_id: number } | undefined;
      if (!row) {
        return { success: false, error: "Debt adjustment not found" };
      }

      db.transaction(() => {
        db.prepare(
          `
            UPDATE supplier_debt_adjustments
            SET amount = ?, notes = ?, effective_date = ?
            WHERE id = ?
          `,
        ).run(
          data.amount,
          data.notes ?? null,
          normalizeEffectiveDate(data.effective_date),
          data.id,
        );
        syncSupplierCreditFromLedger(db, row.supplier_id);
      })();

      return { success: true };
    },
  );

  registerIpcHandler("supplierDebtAdjustments:delete", positiveId, (id) => {
    const db = getDb();
    const row = db
      .prepare("SELECT supplier_id FROM supplier_debt_adjustments WHERE id = ?")
      .get(id) as { supplier_id: number } | undefined;
    if (!row) {
      return { success: false, error: "Debt adjustment not found" };
    }

    db.transaction(() => {
      db.prepare("DELETE FROM supplier_debt_adjustments WHERE id = ?").run(id);
      syncSupplierCreditFromLedger(db, row.supplier_id);
    })();

    return { success: true };
  });
}
