import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../src/main/db/migrations";
import { runSchema } from "../src/main/db/schema";
import {
  computeCustomerCredit,
  getOrderCreditDelta,
  resolveCheckoutCredit,
  resolveCheckoutState,
  reverseOrderCreditEffects,
} from "../src/main/services/creditLedger";
import { reverseOrderFromPurchases, syncOrderToPurchases } from "../src/main/services/purchaseSync";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runSchema(db);
  runMigrations(db);
  return db;
}

describe("creditLedger", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    db.prepare("INSERT INTO customers (name, credit) VALUES ('Customer A', 0)").run();
  });

  afterEach(() => {
    db?.close();
  });

  it("applies stored prepayment before calculating debt", () => {
    const result = resolveCheckoutCredit(-30, 100, 60);
    expect(result.creditUsed).toBe(30);
    expect(result.debt).toBe(10);
    expect(result.prepayment).toBe(0);
    expect(result.creditDelta).toBe(40);
  });

  it("records cash overpayment as additional prepayment", () => {
    const result = resolveCheckoutCredit(-30, 100, 100);
    expect(result.creditUsed).toBe(30);
    expect(result.debt).toBe(0);
    expect(result.prepayment).toBe(30);
    expect(result.creditDelta).toBe(0);
  });

  it("marks fully covered orders as paid", () => {
    const state = resolveCheckoutState(-80, 100, 20);
    expect(state.status).toBe("paid");
    expect(state.debt).toBe(0);
    expect(state.creditUsed).toBe(80);
  });

  it("includes opening balance adjustments in customer credit", () => {
    db.prepare(
      "INSERT INTO customer_debt_adjustments (customer_id, amount, notes, effective_date) VALUES (1, 150, 'Opening balance', '2024-01-01')",
    ).run();

    expect(computeCustomerCredit(db, 1)).toBe(150);
  });

  it("computes customer credit from delivered orders and collections", () => {
    db.prepare(
      `
        INSERT INTO orders (
          customer_id, status, payment_type, total, amount_paid, credit_applied, fulfillment_status
        ) VALUES (1, 'partially_paid', 'cash', 100, 40, 0, 'delivered')
      `,
    ).run();
    db.prepare(
      "INSERT INTO debt_collections (customer_id, amount) VALUES (1, 20)",
    ).run();
    db.prepare("UPDATE customers SET credit = 40 WHERE id = 1").run();

    expect(computeCustomerCredit(db, 1)).toBe(40);
  });

  it("does not count undelivered order debt in customer credit", () => {
    db.prepare(
      `
        INSERT INTO orders (
          customer_id, status, payment_type, total, amount_paid, credit_applied, fulfillment_status
        ) VALUES (1, 'confirmed', 'credit', 100, 0, 0, 'pending')
      `,
    ).run();

    expect(computeCustomerCredit(db, 1)).toBe(0);
  });

  it("reverses checkout credit effects when an undelivered order is cancelled", () => {
    db.prepare("UPDATE customers SET credit = 10 WHERE id = 1").run();
    const order = {
      customer_id: 1,
      total: 100,
      amount_paid: 60,
      credit_applied: 30,
    };

    expect(getOrderCreditDelta(order)).toBe(40);
    reverseOrderCreditEffects(db, order, "pending");

    const row = db.prepare("SELECT credit FROM customers WHERE id = 1").get() as {
      credit: number;
    };
    expect(row.credit).toBe(-20);
  });

  it("reverses full credit effects when a delivered order is cancelled", () => {
    db.prepare("UPDATE customers SET credit = 10 WHERE id = 1").run();
    const order = {
      customer_id: 1,
      total: 100,
      amount_paid: 60,
      credit_applied: 30,
    };

    reverseOrderCreditEffects(db, order, "delivered");

    const row = db.prepare("SELECT credit FROM customers WHERE id = 1").get() as {
      credit: number;
    };
    expect(row.credit).toBe(-30);
  });
});

describe("purchaseSync orphan cleanup", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    db.prepare("INSERT INTO customers (name) VALUES ('Customer A')").run();
    db.prepare("INSERT INTO suppliers (name) VALUES ('Supplier A')").run();
    db.prepare(
      "INSERT INTO products (title, supplier_id, price, wholesale_price) VALUES ('Chips', 1, 2, 1.5)",
    ).run();
  });

  afterEach(() => {
    db?.close();
  });

  it("removes empty purchase invoices after order cancellation", () => {
    const { lastInsertRowid } = db
      .prepare(
        "INSERT INTO orders (customer_id, status, payment_type, total) VALUES (1, 'paid', 'cash', 10)",
      )
      .run();
    const orderId = Number(lastInsertRowid);
    db.prepare(
      "INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, 1, 2, 2)",
    ).run(orderId);

    db.transaction(() => syncOrderToPurchases(db, orderId))();
    expect(
      (db.prepare("SELECT COUNT(*) AS count FROM purchases").get() as { count: number })
        .count,
    ).toBe(1);

    db.transaction(() => reverseOrderFromPurchases(db, orderId))();

    expect(
      (db.prepare("SELECT COUNT(*) AS count FROM purchases").get() as { count: number })
        .count,
    ).toBe(0);
  });
});
