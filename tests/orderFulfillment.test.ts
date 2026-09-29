import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../src/main/db/migrations";
import { runSchema } from "../src/main/db/schema";
import {
  markOrderDelivered,
  recalculateFulfillmentForPurchase,
  recalculateOrderFulfillmentStatus,
} from "../src/main/services/orderFulfillment";
import { syncOrderToPurchases } from "../src/main/services/purchaseSync";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runSchema(db);
  runMigrations(db);
  return db;
}

function seedBaseData(db: Database.Database) {
  db.prepare("INSERT INTO customers (name) VALUES ('Customer A')").run();
  db.prepare("INSERT INTO suppliers (name) VALUES ('Supplier A')").run();
  db.prepare(
    "INSERT INTO products (title, supplier_id, price, wholesale_price) VALUES ('Chips', 1, 2, 1.5)",
  ).run();
}

function createConfirmedOrder(
  db: Database.Database,
  quantity = 2,
): { orderId: number; purchaseId: number } {
  const { lastInsertRowid } = db
    .prepare(
      "INSERT INTO orders (customer_id, status, payment_type, total) VALUES (1, 'confirmed', 'cash', 0)",
    )
    .run();
  const orderId = Number(lastInsertRowid);

  db.prepare(
    `
      INSERT INTO order_items (order_id, product_id, quantity, unit_price)
      VALUES (?, 1, ?, 2)
    `,
  ).run(orderId, quantity);

  db.transaction(() => syncOrderToPurchases(db, orderId))();

  const purchase = db
    .prepare("SELECT id FROM purchases WHERE supplier_id = 1")
    .get() as { id: number };

  return { orderId, purchaseId: purchase.id };
}

describe("orderFulfillment", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    seedBaseData(db);
  });

  afterEach(() => {
    db?.close();
  });

  it("stays pending until the linked purchase is received", () => {
    const { orderId } = createConfirmedOrder(db);

    expect(recalculateOrderFulfillmentStatus(db, orderId)).toBe("pending");
  });

  it("moves to partially_received when the linked purchase is partially received", () => {
    const { orderId, purchaseId } = createConfirmedOrder(db, 4);

    const purchaseItem = db
      .prepare("SELECT id FROM purchase_items WHERE purchase_id = ?")
      .get(purchaseId) as { id: number };

    db.prepare("UPDATE purchase_items SET received_qty = 2 WHERE id = ?").run(
      purchaseItem.id,
    );
    db.prepare("UPDATE purchases SET status = 'partially_received' WHERE id = ?").run(
      purchaseId,
    );
    recalculateFulfillmentForPurchase(db, purchaseId);

    const row = db
      .prepare("SELECT fulfillment_status FROM orders WHERE id = ?")
      .get(orderId) as { fulfillment_status: string };

    expect(row.fulfillment_status).toBe("partially_received");
  });

  it("moves to received when the linked purchase is fully received", () => {
    const { orderId, purchaseId } = createConfirmedOrder(db, 2);

    const purchaseItem = db
      .prepare("SELECT id FROM purchase_items WHERE purchase_id = ?")
      .get(purchaseId) as { id: number };

    db.prepare("UPDATE purchase_items SET received_qty = 2 WHERE id = ?").run(
      purchaseItem.id,
    );
    db.prepare("UPDATE purchases SET status = 'received' WHERE id = ?").run(
      purchaseId,
    );
    recalculateFulfillmentForPurchase(db, purchaseId);

    const row = db
      .prepare("SELECT fulfillment_status FROM orders WHERE id = ?")
      .get(orderId) as { fulfillment_status: string };

    expect(row.fulfillment_status).toBe("received");
  });

  it("allows marking delivered only when inventory has enough stock", () => {
    const { orderId } = createConfirmedOrder(db);

    expect(markOrderDelivered(db, orderId).success).toBe(false);

    db.prepare(
      "UPDATE orders SET fulfillment_status = 'received' WHERE id = ?",
    ).run(orderId);
    db.prepare(
      "INSERT INTO inventory (product_id, flavor_id, quantity) VALUES (1, NULL, 2)",
    ).run();

    expect(markOrderDelivered(db, orderId).success).toBe(true);

    const row = db
      .prepare("SELECT fulfillment_status FROM orders WHERE id = ?")
      .get(orderId) as { fulfillment_status: string };

    expect(row.fulfillment_status).toBe("delivered");
  });

  it("deducts inventory when delivered to customer", () => {
    const { orderId } = createConfirmedOrder(db, 3);

    db.prepare(
      "INSERT INTO inventory (product_id, flavor_id, quantity) VALUES (1, NULL, 10)",
    ).run();

    markOrderDelivered(db, orderId);

    const stock = db
      .prepare("SELECT quantity FROM inventory WHERE product_id = 1")
      .get() as { quantity: number };

    expect(stock.quantity).toBe(7);
  });

  it("marks inventory-only orders as received without a purchase", () => {
    db.prepare(
      "INSERT INTO inventory (product_id, flavor_id, quantity) VALUES (1, NULL, 5)",
    ).run();

    const { orderId } = createConfirmedOrder(db, 3);
    recalculateOrderFulfillmentStatus(db, orderId);

    const row = db
      .prepare("SELECT fulfillment_status FROM orders WHERE id = ?")
      .get(orderId) as { fulfillment_status: string };

    expect(row.fulfillment_status).toBe("received");

    const purchaseCount = db
      .prepare("SELECT COUNT(*) AS count FROM purchase_items WHERE product_id = 1")
      .get() as { count: number };
    expect(purchaseCount.count).toBe(0);
  });
});
