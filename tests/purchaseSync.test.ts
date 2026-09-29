import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../src/main/db/migrations";
import { runSchema } from "../src/main/db/schema";
import {
  reconcileUnfulfilledOrders,
  reverseOrderFromPurchases,
  syncOrderToPurchases,
} from "../src/main/services/purchaseSync";

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
  db.prepare("INSERT INTO suppliers (name) VALUES ('Supplier B')").run();
  db.prepare(
    "INSERT INTO products (title, supplier_id, price, wholesale_price) VALUES ('Chips', 1, 2, 1.5)",
  ).run();
  db.prepare(
    "INSERT INTO products (title, supplier_id, price, wholesale_price) VALUES ('Juice', 1, 3, 2)",
  ).run();
  db.prepare(
    "INSERT INTO products (title, supplier_id, price, wholesale_price) VALUES ('Cola', 2, 2.5, 1.8)",
  ).run();
}

function createOrder(
  db: Database.Database,
  status: string,
  items: { product_id: number; quantity: number; flavor_id?: number | null }[],
): number {
  const { lastInsertRowid } = db
    .prepare(
      "INSERT INTO orders (customer_id, status, payment_type, total) VALUES (1, ?, 'cash', 0)",
    )
    .run(status);

  const orderId = Number(lastInsertRowid);
  const insertItem = db.prepare(
    `
      INSERT INTO order_items (order_id, product_id, flavor_id, quantity, unit_price)
      VALUES (?, ?, ?, ?, 1)
    `,
  );

  for (const item of items) {
    insertItem.run(orderId, item.product_id, item.flavor_id ?? null, item.quantity);
  }

  return orderId;
}

describe("purchaseSync", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    seedBaseData(db);
  });

  afterEach(() => {
    db?.close();
  });

  it("creates a purchase invoice per supplier on first order checkout", () => {
    const orderId = createOrder(db, "paid", [
      { product_id: 1, quantity: 2 },
      { product_id: 2, quantity: 1 },
      { product_id: 3, quantity: 4 },
    ]);

    const result = db.transaction(() => syncOrderToPurchases(db, orderId))();

    expect(result.itemsSynced).toBe(3);
    expect(result.purchaseIds).toHaveLength(2);

    const supplierAPurchase = db
      .prepare("SELECT * FROM purchases WHERE supplier_id = 1")
      .get() as { total: number; status: string; submitted_at: string | null };

    expect(supplierAPurchase.status).toBe("pending");
    expect(supplierAPurchase.submitted_at).toBeNull();
    expect(supplierAPurchase.total).toBe(5);

    const supplierAItems = db
      .prepare("SELECT product_id, quantity, unit_cost FROM purchase_items WHERE purchase_id = 1")
      .all() as { product_id: number; quantity: number; unit_cost: number }[];

    expect(supplierAItems).toHaveLength(2);
    expect(supplierAItems.find((item) => item.product_id === 1)?.quantity).toBe(2);
    expect(supplierAItems.find((item) => item.product_id === 2)?.quantity).toBe(1);
  });

  it("merges a second order into the same open supplier invoice", () => {
    const firstOrderId = createOrder(db, "paid", [{ product_id: 1, quantity: 2 }]);
    db.transaction(() => syncOrderToPurchases(db, firstOrderId))();

    const secondOrderId = createOrder(db, "confirmed", [{ product_id: 2, quantity: 3 }]);
    db.transaction(() => syncOrderToPurchases(db, secondOrderId))();

    const purchases = db.prepare("SELECT id FROM purchases WHERE supplier_id = 1").all();
    expect(purchases).toHaveLength(1);

    const chips = db
      .prepare("SELECT quantity FROM purchase_items WHERE product_id = 1")
      .get() as { quantity: number };
    const juice = db
      .prepare("SELECT quantity FROM purchase_items WHERE product_id = 2")
      .get() as { quantity: number };

    expect(chips.quantity).toBe(2);
    expect(juice.quantity).toBe(3);
  });

  it("creates a new invoice after the current one is submitted", () => {
    const firstOrderId = createOrder(db, "paid", [{ product_id: 1, quantity: 1 }]);
    db.transaction(() => syncOrderToPurchases(db, firstOrderId))();

    db.prepare(
      "UPDATE purchases SET submitted_at = CURRENT_TIMESTAMP WHERE supplier_id = 1",
    ).run();

    const secondOrderId = createOrder(db, "partially_paid", [{ product_id: 1, quantity: 5 }]);
    db.transaction(() => syncOrderToPurchases(db, secondOrderId))();

    const purchases = db
      .prepare("SELECT id, submitted_at FROM purchases WHERE supplier_id = 1 ORDER BY id")
      .all() as { id: number; submitted_at: string | null }[];

    expect(purchases).toHaveLength(2);
    expect(purchases[0].submitted_at).not.toBeNull();
    expect(purchases[1].submitted_at).toBeNull();

    const latestQty = db
      .prepare("SELECT quantity FROM purchase_items WHERE purchase_id = ? AND product_id = 1")
      .get(purchases[1].id) as { quantity: number };

    expect(latestQty.quantity).toBe(5);
  });

  it("does not sync draft or cancelled orders", () => {
    const draftOrderId = createOrder(db, "draft", [{ product_id: 1, quantity: 1 }]);
    const cancelledOrderId = createOrder(db, "cancelled", [{ product_id: 2, quantity: 1 }]);

    expect(syncOrderToPurchases(db, draftOrderId).itemsSynced).toBe(0);
    expect(syncOrderToPurchases(db, cancelledOrderId).itemsSynced).toBe(0);

    const purchaseCount = db.prepare("SELECT COUNT(*) AS count FROM purchases").get() as {
      count: number;
    };
    expect(purchaseCount.count).toBe(0);
  });

  it("is idempotent when re-processing the same order", () => {
    const orderId = createOrder(db, "paid", [{ product_id: 1, quantity: 2 }]);

    db.transaction(() => syncOrderToPurchases(db, orderId))();
    const secondPass = db.transaction(() => syncOrderToPurchases(db, orderId))();

    expect(secondPass.itemsSynced).toBe(0);

    const line = db
      .prepare("SELECT quantity FROM purchase_items WHERE product_id = 1")
      .get() as { quantity: number };
    expect(line.quantity).toBe(2);
  });

  it("reverses synced quantities when an order is cancelled", () => {
    const orderId = createOrder(db, "paid", [
      { product_id: 1, quantity: 2 },
      { product_id: 2, quantity: 3 },
    ]);

    db.transaction(() => syncOrderToPurchases(db, orderId))();
    db.transaction(() => reverseOrderFromPurchases(db, orderId))();

    const items = db.prepare("SELECT quantity FROM purchase_items").all() as {
      quantity: number;
    }[];
    expect(items).toHaveLength(0);

    const fulfilled = db
      .prepare("SELECT fulfilled_to_purchase FROM order_items WHERE order_id = ?")
      .all(orderId) as { fulfilled_to_purchase: number }[];
    expect(fulfilled.every((row) => row.fulfilled_to_purchase === 0)).toBe(true);
  });

  it("reconciles only unfulfilled orders via generate helper", () => {
    const syncedOrderId = createOrder(db, "paid", [{ product_id: 1, quantity: 1 }]);
    const pendingOrderId = createOrder(db, "confirmed", [{ product_id: 2, quantity: 4 }]);

    db.transaction(() => syncOrderToPurchases(db, syncedOrderId))();

    const results = db.transaction(() => reconcileUnfulfilledOrders(db))();

    expect(results).toHaveLength(1);
    expect(results[0].itemsSynced).toBe(1);

    const juice = db
      .prepare("SELECT quantity FROM purchase_items WHERE product_id = 2")
      .get() as { quantity: number };
    expect(juice.quantity).toBe(4);
  });

  it("uses warehouse stock before adding to purchase orders", () => {
    db.prepare(
      "INSERT INTO inventory (product_id, flavor_id, quantity) VALUES (1, NULL, 3)",
    ).run();

    const orderId = createOrder(db, "paid", [{ product_id: 1, quantity: 5 }]);
    db.transaction(() => syncOrderToPurchases(db, orderId))();

    const purchaseQty = db
      .prepare("SELECT quantity FROM purchase_items WHERE product_id = 1")
      .get() as { quantity: number } | undefined;

    expect(purchaseQty?.quantity).toBe(2);

    const allocated = db
      .prepare("SELECT inventory_allocated FROM order_items WHERE order_id = ?")
      .get(orderId) as { inventory_allocated: number };

    expect(allocated.inventory_allocated).toBe(3);
  });

  it("keeps inventory when reversing a synced order after supplier delivery", () => {
    const orderId = createOrder(db, "paid", [{ product_id: 1, quantity: 4 }]);
    db.transaction(() => syncOrderToPurchases(db, orderId))();

    const purchaseItem = db
      .prepare("SELECT id, purchase_id FROM purchase_items WHERE product_id = 1")
      .get() as { id: number; purchase_id: number };

    db.prepare("UPDATE purchase_items SET received_qty = 4 WHERE id = ?").run(
      purchaseItem.id,
    );
    db.prepare(
      "INSERT INTO inventory (product_id, flavor_id, quantity) VALUES (1, NULL, 4)",
    ).run();

    db.transaction(() => reverseOrderFromPurchases(db, orderId))();

    const stock = db
      .prepare("SELECT quantity FROM inventory WHERE product_id = 1")
      .get() as { quantity: number };

    expect(stock.quantity).toBe(4);

    const purchaseLine = db
      .prepare("SELECT quantity FROM purchase_items WHERE id = ?")
      .get(purchaseItem.id) as { quantity: number } | undefined;

    expect(purchaseLine).toBeUndefined();
  });

  it("allocates leftover stock to a second order after the first is reduced", () => {
    db.prepare(
      "INSERT INTO inventory (product_id, flavor_id, quantity) VALUES (1, NULL, 3)",
    ).run();

    const firstOrderId = createOrder(db, "paid", [{ product_id: 1, quantity: 5 }]);
    db.transaction(() => syncOrderToPurchases(db, firstOrderId))();

    db.transaction(() => {
      reverseOrderFromPurchases(db, firstOrderId);
      db.prepare("DELETE FROM order_items WHERE order_id = ?").run(firstOrderId);
      db.prepare(
        `
          INSERT INTO order_items (order_id, product_id, quantity, unit_price)
          VALUES (?, 1, 2, 1)
        `,
      ).run(firstOrderId);
      syncOrderToPurchases(db, firstOrderId);
    })();

    const secondOrderId = createOrder(db, "confirmed", [{ product_id: 1, quantity: 4 }]);
    db.transaction(() => syncOrderToPurchases(db, secondOrderId))();

    const secondPurchaseQty = db
      .prepare(
        "SELECT quantity FROM purchase_items WHERE purchase_id = (SELECT MAX(id) FROM purchases)",
      )
      .get() as { quantity: number };

    expect(secondPurchaseQty.quantity).toBe(3);
  });
});
